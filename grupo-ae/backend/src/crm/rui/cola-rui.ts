/** Poner y mover cosas en la cola del RUI. */

/// Vive aparte de `RuiService` a proposito. Encolar no es mas
/// que escribir una fila: no necesita el navegador ni el
/// proveedor. Separarlo deja que el formulario publico pida
/// una consulta sin arrastrar el modulo entero del CRM --
/// que a su vez importa al de preinscripcion, y ese circulo
/// no deja arrancar a Nest.

import { Injectable, Logger, Module } from '@nestjs/common';

import { EstadoConsultaRui } from '../../../generated/prisma';
import { nombreCompleto } from '../../comun/documento';
import { PrismaService } from '../../prisma/prisma.service';
import { taparDocumento } from '../../comun/tapar';

/// Lo que todavia no tiene respuesta.
const SIN_RESOLVER = [EstadoConsultaRui.PENDIENTE, EstadoConsultaRui.EN_CURSO];

@Injectable()
export class ColaRui {
  private readonly log = new Logger('ColaRui');

  constructor(private readonly prisma: PrismaService) {}

  /// Encolar no espera a nada: guardar nunca se bloquea por
  /// el RUI. Si ya hay una pendiente para esa persona se
  /// reusa, y solo se le sube la prioridad.
  async encolar(personaId: string, prioridad = 0): Promise<void> {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        id: true,
        tipoDocumentoSepId: true,
        numeroDocumento: true,
        esDePrueba: true,
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
    });
    if (!persona) return;

    // Una cedula inventada le pertenece a alguien. La siembra
    // reparte numeros desde 1.010.200.000, que es rango real:
    // consultarlos le pide al Estado la identidad de un
    // ciudadano que no pidio nada, y la guarda aqui. Ya paso
    // una vez. No se consulta y no se calla.
    if (persona.esDePrueba) {
      this.log.warn(
        `No se consulta el RUI de ${taparDocumento(persona.numeroDocumento)}: ` +
          'esta marcada como dato de prueba. Ese numero puede ser ' +
          'la cedula de una persona real que no pidio nada.',
      );
      return;
    }

    const pendiente = await this.prisma.consultaRui.findFirst({
      where: { personaId, estado: { in: SIN_RESOLVER } },
      select: { id: true, prioridad: true },
    });

    if (pendiente) {
      if (prioridad > pendiente.prioridad) {
        await this.prisma.consultaRui.update({
          where: { id: pendiente.id },
          data: { prioridad },
        });
      }
      return;
    }

    await this.prisma.consultaRui.create({
      data: {
        personaId,
        tipoDocumentoSepId: persona.tipoDocumentoSepId,
        numeroDocumento: persona.numeroDocumento,
        nombreTecleado: nombreCompleto(persona),
        prioridad,
      },
    });
  }

  /**
   * Encola solo si hace falta de verdad.
   *
   * Quien se inscribe dos veces no debe mandar dos veces al
   * portal del DNP por lo mismo. Pero si volvio y corrigio su
   * nombre, la respuesta vieja ya no sirve para compararla:
   * eso si se vuelve a preguntar.
   */
  async encolarSiHaceFalta(personaId: string, prioridad = 0): Promise<void> {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      select: {
        primerNombre: true,
        segundoNombre: true,
        primerApellido: true,
        segundoApellido: true,
      },
    });
    if (!persona) return;

    const ultima = await this.prisma.consultaRui.findFirst({
      where: { personaId },
      orderBy: { creadoEn: 'desc' },
      select: { estado: true, nombreTecleado: true },
    });

    if (ultima && ultima.nombreTecleado === nombreCompleto(persona)) return;

    await this.encolar(personaId, prioridad);
  }

  /// Sube al frente lo de la ficha que alguien esta mirando.
  /// Sin esto, el asesor que espera queda detras de todo lo
  /// que se encolo en segundo plano.
  async priorizar(personaId: string): Promise<void> {
    await this.prisma.consultaRui.updateMany({
      where: { personaId, estado: EstadoConsultaRui.PENDIENTE },
      data: { prioridad: 100 },
    });
  }
}

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  providers: [ColaRui],
  exports: [ColaRui],
})
export class ColaRuiModule {}
