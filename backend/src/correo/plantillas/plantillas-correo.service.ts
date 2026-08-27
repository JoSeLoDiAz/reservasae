/** Las plantillas, y mandar una a un participante. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CorreoService } from '../correo.service';
import {
  resolver,
  valoresDe,
  variablesUsadas,
  VARIABLES,
  type DatosDelParticipante,
} from './variables';

/// Cuánto texto se le deja poner a una plantilla. Un correo
/// no es un documento: si necesita más, va un adjunto o un
/// enlace.
const LARGO_MAXIMO = 8000;

@Injectable()
export class PlantillasCorreoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /** El catálogo de variables, para quien escribe. */
  variables() {
    return VARIABLES;
  }

  /**
   * Las que puede usar este gremio.
   *
   * Las de `convenioId` nulo sirven para todos; las de un
   * gremio, solo en el suyo. El tono de BRITCHAM no tiene por
   * qué ser el de ADECOPRIA.
   */
  async listar(convenios: string[], soloActivas = false) {
    return this.prisma.plantillaCorreo.findMany({
      where: {
        ...(soloActivas ? { activa: true } : {}),
        OR: [{ convenioId: null }, { convenioId: { in: convenios } }],
      },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        asunto: true,
        cuerpo: true,
        activa: true,
        convenioId: true,
        actualizadoEn: true,
        convenio: { select: { sigla: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
      },
    });
  }

  async crear(
    datos: {
      nombre: string;
      asunto: string;
      cuerpo: string;
      convenioId?: string | null;
    },
    adminId: string,
  ) {
    this.revisar(datos.asunto, datos.cuerpo);
    return this.prisma.plantillaCorreo.create({
      data: {
        nombre: datos.nombre.trim(),
        asunto: datos.asunto.trim(),
        cuerpo: datos.cuerpo,
        convenioId: datos.convenioId ?? null,
        creadoPorId: adminId,
      },
    });
  }

  async editar(
    id: string,
    datos: Partial<{
      nombre: string;
      asunto: string;
      cuerpo: string;
      convenioId: string | null;
      activa: boolean;
    }>,
  ) {
    const antes = await this.prisma.plantillaCorreo.findUnique({
      where: { id },
    });
    if (!antes) throw new NotFoundException('Esa plantilla ya no existe.');

    this.revisar(datos.asunto ?? antes.asunto, datos.cuerpo ?? antes.cuerpo);

    return this.prisma.plantillaCorreo.update({ where: { id }, data: datos });
  }

  /**
   * Una plantilla no se borra: se apaga.
   *
   * Ya se usó para escribirle a gente. Borrarla dejaría
   * correos enviados sin forma de saber qué decían.
   */
  async apagar(id: string) {
    return this.prisma.plantillaCorreo.update({
      where: { id },
      data: { activa: false },
    });
  }

  /// Que no se guarde una plantilla con una variable que no
  /// existe. Se ve al escribirla, no cuando ya salió mal a
  /// cuarenta personas.
  private revisar(asunto: string, cuerpo: string) {
    if (!asunto.trim())
      throw new BadRequestException('El asunto no puede ir vacío.');
    if (!cuerpo.trim())
      throw new BadRequestException('El cuerpo no puede ir vacío.');
    if (cuerpo.length > LARGO_MAXIMO) {
      throw new BadRequestException(
        `El cuerpo pasa de ${LARGO_MAXIMO} caracteres. Para algo más largo, ` +
          'mejor un enlace o un adjunto.',
      );
    }

    const conocidas = new Set(VARIABLES.map((v) => v.clave));
    const malas = [...variablesUsadas(`${asunto} ${cuerpo}`)].filter(
      (v) => !conocidas.has(v),
    );

    if (malas.length > 0) {
      throw new BadRequestException(
        `Estas variables no existen: ${malas.map((v) => `{{${v}}}`).join(', ')}. ` +
          'Si se guarda así, van a salir literales en el correo.',
      );
    }
  }

  /**
   * Cómo le quedaría a ESTA persona, antes de mandarlo.
   *
   * Es el paso que hace que esto sea usable: quien manda ve
   * el texto ya con el nombre puesto, y ve qué huecos no se
   * pudieron llenar. Nadie manda a ciegas.
   */
  async vistaPrevia(participanteId: string, plantillaId: string) {
    const [plantilla, datos] = await Promise.all([
      this.prisma.plantillaCorreo.findUnique({ where: { id: plantillaId } }),
      this.datosDe(participanteId),
    ]);

    if (!plantilla) throw new NotFoundException('Esa plantilla ya no existe.');

    const valores = valoresDe(datos.datos);
    const asunto = resolver(plantilla.asunto, valores);
    const cuerpo = resolver(plantilla.cuerpo, valores);

    /// Los faltantes de los dos, juntos y sin repetir: a quien
    /// manda le da igual si el hueco estaba en el asunto o en
    /// el cuerpo, lo que necesita saber es qué le falta.
    const faltantes = [...new Set([...asunto.faltantes, ...cuerpo.faltantes])];

    return {
      para: datos.correo,
      nombre: datos.nombre,
      asunto: asunto.texto,
      cuerpo: cuerpo.texto,
      faltantes,
      desconocidas: [
        ...new Set([...asunto.desconocidas, ...cuerpo.desconocidas]),
      ],
      /// Se puede mandar si hay a dónde y no quedó ningún
      /// hueco sin llenar.
      sePuede: Boolean(datos.correo) && faltantes.length === 0,
    };
  }

  async enviar(participanteId: string, plantillaId: string) {
    const vista = await this.vistaPrevia(participanteId, plantillaId);

    if (!vista.para) {
      throw new BadRequestException(
        `${vista.nombre} no tiene correo en la ficha. Sin correo no hay a dónde mandarlo.`,
      );
    }

    /// No se manda con huecos, y no es una manía.
    ///
    /// «Estimado {{saludo}}, su curso empieza el
    /// {{fechaInicio}}» sale una sola vez y ya no se puede
    /// recoger. Se dice qué falta y se arregla la ficha.
    if (vista.faltantes.length > 0) {
      throw new BadRequestException(
        'Faltan datos de esta persona para llenar la plantilla: ' +
          `${vista.faltantes.map((f) => `{{${f}}}`).join(', ')}. ` +
          'Complételos en la ficha, o use otra plantilla.',
      );
    }

    const r = await this.correo.enviar({
      para: vista.para,
      asunto: vista.asunto,
      texto: vista.cuerpo,
      html: aHtml(vista.cuerpo),
    });

    if (r.estado === 'FALLO') throw new BadRequestException(r.error);
    if (r.estado === 'APAGADO') {
      throw new BadRequestException(
        'El correo está apagado en el servidor. Revise Configuración > Correo.',
      );
    }

    /// Se devuelve a dónde fue DE VERDAD, no a dónde iba.
    ///
    /// En pruebas todo se desvía a un buzón nuestro. Decirle
    /// al asesor «se envió a camilapruebas@gmail.com» cuando
    /// eso no pasó es peor que no decir nada: se queda creyendo
    /// que la persona ya está avisada, y no lo está.
    return {
      enviado: true,
      /// A quién iba dirigido.
      para: vista.para,
      /// Dónde cayó. Distinto solo cuando hay desvío.
      entregadoA: r.para,
      desviado: r.desviado,
      asunto: vista.asunto,
      id: r.id,
    };
  }

  /**
   * Todo lo que una plantilla puede necesitar de un lead.
   *
   * Una sola consulta: la vista previa se pide cada vez que
   * alguien cambia de plantilla en el desplegable, y no vale
   * la pena ir cinco veces a la base por cada clic.
   */
  private async datosDe(participanteId: string) {
    const p = await this.prisma.participante.findUnique({
      where: { id: participanteId },
      select: {
        persona: {
          select: {
            primerNombre: true,
            segundoNombre: true,
            primerApellido: true,
            segundoApellido: true,
            generoSepId: true,
            numeroDocumento: true,
            correo: true,
            celular: true,
          },
        },
        empresa: { select: { razonSocial: true } },
        reserva: { select: { empresa: { select: { razonSocial: true } } } },
        accionFormacion: {
          select: { codigo: true, nombre: true, modalidad: true },
        },
        cobertura: {
          select: {
            modalidad: true,
            ubicacion: { select: { nombre: true } },
            grupo: { select: { numero: true, fechaInicio: true } },
          },
        },
        asesor: { select: { nombre: true } },
        convenio: { select: { sigla: true, nombre: true } },
      },
    });

    if (!p) throw new NotFoundException('Ese lead ya no existe.');

    const persona = p.persona;
    /// La empresa propia y si no la de la reserva: `empresaId`
    /// se llena en el formulario largo, pero quien llegó por
    /// una reserva la tiene colgando de ahí.
    const empresa =
      p.empresa?.razonSocial ?? p.reserva?.empresa?.razonSocial ?? null;

    const datos: DatosDelParticipante = {
      primerNombre: persona.primerNombre,
      segundoNombre: persona.segundoNombre,
      primerApellido: persona.primerApellido,
      segundoApellido: persona.segundoApellido,
      generoSepId: persona.generoSepId,
      numeroDocumento: persona.numeroDocumento,
      correo: persona.correo,
      celular: persona.celular,
      empresa,
      accionFormacion: p.accionFormacion
        ? `${p.accionFormacion.codigo} · ${p.accionFormacion.nombre}`
        : null,
      grupo: p.cobertura?.grupo.numero ?? null,
      fechaInicio: p.cobertura?.grupo.fechaInicio ?? null,
      ubicacion: p.cobertura?.ubicacion.nombre ?? null,
      modalidad: enBonito(
        p.cobertura?.modalidad ?? p.accionFormacion?.modalidad,
      ),
      asesor: p.asesor?.nombre ?? null,
      gremio: p.convenio?.sigla ?? p.convenio?.nombre ?? null,
    };

    const nombre =
      [persona.primerNombre, persona.primerApellido]
        .filter(Boolean)
        .join(' ') || 'Este lead';

    return { datos, correo: persona.correo, nombre };
  }
}

/// PRESENCIAL -> Presencial. En un correo no se le grita a
/// nadie.
function enBonito(m: string | null | undefined): string | null {
  if (!m) return null;
  return m[0] + m.slice(1).toLocaleLowerCase('es-CO');
}

/**
 * El mismo texto, servible como HTML.
 *
 * Se escapa TODO antes de tocar nada: el cuerpo lo escribe
 * una persona y puede llevar `<`, `&` o comillas sin querer
 * decir nada de HTML. Después los saltos de línea se vuelven
 * párrafos, que es lo que quien escribió esperaba ver.
 */
export function aHtml(texto: string): string {
  const escapado = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const parrafos = escapado
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return (
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#161a26">' +
    parrafos +
    '</div>'
  );
}
