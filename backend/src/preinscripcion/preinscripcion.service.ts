/** Quien se inscribe por su cuenta, y completa sus datos. */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { GENEROS_SEP } from '../crm/catalogos-sep.generado';
import {
  DEPARTAMENTOS_SEP,
  DOCUMENTOS_DE_PERSONA,
  edadCumplida,
  municipioCuadra,
  MUNICIPIOS_SEP,
} from '../crm/catalogos-sep';
import { CrearPreinscripcionDto, DatosEmpresaDto, DatosPersonaDto } from './dto';

/// Cuánto vale un enlace antes de caducar solo.
const DIAS_DE_VIDA = 15;
/// La menor edad que el SENA admite en estos programas.
const EDAD_MINIMA = 18;

@Injectable()
export class PreinscripcionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lo que el formulario necesita para dibujarse. */
  async catalogo(slug: string) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug, activo: true },
      select: { id: true, slug: true, nombre: true, sigla: true },
    });
    if (!convenio) throw new NotFoundException('No hay una convocatoria con ese nombre.');

    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: convenio.id, visible: true },
      orderBy: { orden: 'asc' },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        horas: true,
        modalidad: true,
        ofertas: {
          where: { abierta: true },
          orderBy: { ubicacion: { nombre: 'asc' } },
          select: {
            id: true,
            modalidad: true,
            cuposMaximos: true,
            cuposOcupados: true,
            ubicacion: { select: { nombre: true, tipo: true } },
          },
        },
      },
    });

    return {
      convenio,
      // sin ofertas abiertas no hay dónde inscribirse
      acciones: acciones
        .filter((a) => a.ofertas.length > 0)
        .map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          horas: a.horas,
          modalidad: a.modalidad,
          ofertas: a.ofertas.map((o) => ({
            id: o.id,
            ubicacion: o.ubicacion.nombre,
            tipo: o.ubicacion.tipo,
            modalidad: o.modalidad,
            libres: Math.max(0, o.cuposMaximos - o.cuposOcupados),
          })),
        })),
      documentos: DOCUMENTOS_DE_PERSONA,
      generos: GENEROS_SEP,
    };
  }

  /**
   * El registro mínimo. Devuelve el enlace con el que la
   * persona puede seguir completando su ficha, para que
   * pueda parar aquí y continuar después.
   */
  async registrar(slug: string, dto: CrearPreinscripcionDto) {
    const convenio = await this.prisma.convenio.findFirst({
      where: { slug, activo: true },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException('No hay una convocatoria con ese nombre.');

    const oferta = await this.prisma.oferta.findFirst({
      where: { id: dto.ofertaId, abierta: true, accionFormacion: { convenioId: convenio.id, visible: true } },
      select: { id: true, accionFormacionId: true },
    });
    if (!oferta) {
      throw new BadRequestException('Esa opción ya no está disponible.');
    }

    this.exigirDocumentoValido(dto.tipoDocumentoSepId);
    const documento = dto.numeroDocumento.trim();

    // la misma cedula es la misma persona en todo el
    // sistema, venga por donde venga
    const persona = await this.prisma.persona.upsert({
      where: {
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId: dto.tipoDocumentoSepId,
          numeroDocumento: documento,
        },
      },
      create: {
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento: documento,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido,
        generoSepId: dto.generoSepId,
        celular: dto.celular,
        correo: dto.correo,
      },
      // no se pisa lo que ya hay: solo se rellenan huecos
      update: {
        celular: dto.celular ?? undefined,
        correo: dto.correo ?? undefined,
        generoSepId: dto.generoSepId ?? undefined,
      },
      select: { id: true },
    });

    // ya inscrita en esta misma acción: se le devuelve su
    // enlace en vez de decirle que no, que es lo mismo
    // que echarla
    const yaEsta = await this.prisma.participante.findFirst({
      where: { personaId: persona.id, accionFormacionId: oferta.accionFormacionId },
      select: { id: true },
    });

    const participante =
      yaEsta ??
      (await this.prisma.participante.create({
        data: {
          personaId: persona.id,
          convenioId: convenio.id,
          ofertaId: oferta.id,
          accionFormacionId: oferta.accionFormacionId,
          origen: 'AUTOGESTION',
          etapa: 'INTERESADO',
          movimientos: {
            create: { etapaDespues: 'INTERESADO', motivo: 'Se inscribió por su cuenta' },
          },
        },
        select: { id: true },
      }));

    const enlace = await this.emitirEnlace(participante.id, null);

    return {
      registrado: true,
      yaEstaba: Boolean(yaEsta),
      token: enlace.token,
      expiraEn: enlace.expiraEn,
    };
  }

  /** Un enlace nuevo. Los anteriores dejan de valer. */
  async emitirEnlace(participanteId: string, emitidoPorId: string | null) {
    const ahora = new Date();
    await this.prisma.enlaceCompletado.updateMany({
      where: { participanteId, usadoEn: null },
      data: { usadoEn: ahora },
    });

    const expiraEn = new Date(ahora.getTime() + DIAS_DE_VIDA * 86_400_000);
    return this.prisma.enlaceCompletado.create({
      data: {
        // 32 bytes: no se adivina probando
        token: randomBytes(32).toString('base64url'),
        participanteId,
        expiraEn,
        emitidoPorId,
      },
      select: { token: true, expiraEn: true },
    });
  }

  /** Lo que ve quien abre el enlace. */
  async abrir(token: string) {
    const enlace = await this.exigirEnlaceVivo(token);

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: {
        id: true,
        convenio: { select: { nombre: true, sigla: true } },
        accionFormacion: { select: { codigo: true, nombre: true, horas: true } },
        oferta: { select: { ubicacion: { select: { nombre: true } } } },
        convenioId: true,
        cargoEnEmpresa: true,
        reserva: { select: { empresa: { select: { nit: true, razonSocial: true } } } },
        empresa: { select: { nit: true, razonSocial: true } },
        persona: {
          include: {
            autorizaciones: { where: { revocadaEn: null }, select: { id: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');

    // el texto que tiene que aceptar, si el convenio lo tiene
    const politica = await this.prisma.politicaDatos.findFirst({
      where: {
        convenioId: p.convenioId,
        destinatario: 'PARTICIPANTE',
        vigenteDesde: { lte: new Date() },
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, titulo: true, contenido: true },
    });

    // la de la reserva manda: es la que la nominó
    const suya = p.reserva?.empresa ?? p.empresa ?? null;
    const { autorizaciones, ...persona } = p.persona;

    return {
      expiraEn: enlace.expiraEn,
      convenio: p.convenio,
      formacion: p.accionFormacion
        ? {
            codigo: p.accionFormacion.codigo,
            nombre: p.accionFormacion.nombre,
            horas: p.accionFormacion.horas,
            ubicacion: p.oferta?.ubicacion.nombre ?? null,
          }
        : null,
      empresa: suya?.razonSocial ?? null,
      nitEmpresa: suya?.nit ?? null,
      /// Si la nominó una empresa, no la cambia ella.
      empresaFijada: p.reserva !== null,
      cargoEnEmpresa: p.cargoEnEmpresa,
      persona,
      yaAutorizo: autorizaciones.length > 0,
      politica,
      documentos: DOCUMENTOS_DE_PERSONA,
      generos: GENEROS_SEP,
      departamentos: DEPARTAMENTOS_SEP.filter((d) => d.seleccionable),
      // [id, departamentoId, nombre]: el navegador filtra
      // sin pedir nada. Son 1.126, no 1.126 viajes
      municipios: MUNICIPIOS_SEP.filter((m) => m[3]).map((m) => [m[0], m[1], m[2]]),
    };
  }

  /** Guarda los datos de la persona. El enlace sigue vivo. */
  async guardarPersona(token: string, dto: DatosPersonaDto, ip?: string) {
    const enlace = await this.exigirEnlaceVivo(token);

    if (dto.fechaNacimiento) {
      const edad = edadCumplida(new Date(dto.fechaNacimiento));
      if (edad < EDAD_MINIMA) {
        throw new BadRequestException(
          `Esta formación es para mayores de ${EDAD_MINIMA} años.`,
        );
      }
    }

    if (dto.departamentoSepId && dto.municipioSepId) {
      if (!municipioCuadra(dto.departamentoSepId, dto.municipioSepId)) {
        throw new BadRequestException('Ese municipio no es del departamento indicado.');
      }
    }

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: { personaId: true },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');

    // el nivel educativo y el cargo son de la participación,
    // no de la persona: cambian entre un curso y el siguiente
    if (dto.nivelEducativo !== undefined || dto.cargoEnEmpresa !== undefined) {
      await this.prisma.participante.update({
        where: { id: enlace.participanteId },
        data: {
          nivelEducativo: dto.nivelEducativo,
          cargoEnEmpresa: dto.cargoEnEmpresa,
        },
      });
    }

    // aceptar la politica es lo que hay que poder demostrar:
    // se guarda contra la version exacta que leyo, no como
    // un booleano suelto que no prueba nada
    if (dto.aceptaPolitica) {
      const politica = await this.prisma.politicaDatos.findFirst({
        where: {
          convenio: { participantes: { some: { id: enlace.participanteId } } },
          destinatario: 'PARTICIPANTE',
          vigenteDesde: { lte: new Date() },
        },
        orderBy: { version: 'desc' },
        select: { id: true },
      });

      if (politica) {
        const ya = await this.prisma.autorizacionDatos.findFirst({
          where: {
            personaId: p.personaId,
            politicaDatosId: politica.id,
            revocadaEn: null,
          },
          select: { id: true },
        });
        if (!ya) {
          await this.prisma.autorizacionDatos.create({
            data: {
              personaId: p.personaId,
              politicaDatosId: politica.id,
              canal: 'FORMULARIO_WEB',
              evidencia: `Enlace de completado ${enlace.id}`,
              ip: ip ?? null,
            },
          });
        }
      }
    }

    await this.prisma.persona.update({
      where: { id: p.personaId },
      data: {
        primerNombre: dto.primerNombre ?? undefined,
        segundoNombre: dto.segundoNombre,
        primerApellido: dto.primerApellido ?? undefined,
        segundoApellido: dto.segundoApellido,
        celular: dto.celular,
        correo: dto.correo,
        generoSepId: dto.generoSepId,
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
        estrato: dto.estrato,
        departamentoSepId: dto.departamentoSepId,
        municipioSepId: dto.municipioSepId,
        barrio: dto.barrio,
        direccion: dto.direccion,
      },
    });

    return { guardado: true };
  }

  /**
   * Los datos de su empresa, que son los que el F7 pide y
   * nadie más puede dar. Al guardarlos se cierra el enlace.
   *
   * Quien se inscribió por su cuenta también trabaja en
   * algún sitio: antes esto se negaba si no venía de una
   * reserva, así que sus datos de empresa no tenían dónde
   * ir y su fila del F7 nacía incompleta. Si trae NIT se
   * busca o se crea la organización y se le engancha.
   */
  async guardarEmpresa(token: string, dto: DatosEmpresaDto) {
    const enlace = await this.exigirEnlaceVivo(token);

    const p = await this.prisma.participante.findUnique({
      where: { id: enlace.participanteId },
      select: { id: true, reserva: { select: { empresaId: true } }, empresaId: true },
    });
    if (!p) throw new NotFoundException('Ese enlace ya no apunta a nadie.');

    if (dto.departamentoSepId && dto.municipioSepId) {
      if (!municipioCuadra(dto.departamentoSepId, dto.municipioSepId)) {
        throw new BadRequestException('Ese municipio no es del departamento indicado.');
      }
    }

    const datos = {
      direccion: dto.direccion,
      telefono: dto.telefono,
      departamentoSepId: dto.departamentoSepId,
      municipioSepId: dto.municipioSepId,
      sectorEconomico: dto.sectorEconomico,
      numeroTrabajadores: dto.numeroTrabajadores,
      contactoNombre: dto.contactoNombre,
      contactoCargo: dto.contactoCargo,
      contactoCorreo: dto.contactoCorreo,
    };

    // la de la reserva manda y no se cambia: la nominó ella
    const suya = p.reserva?.empresaId ?? p.empresaId ?? null;

    if (suya) {
      await this.prisma.empresa.update({ where: { id: suya }, data: datos });
    } else if (dto.nit) {
      const nit = dto.nit.replace(/\D/g, '');
      if (!nit) throw new BadRequestException('Ese NIT no tiene ningún dígito.');

      const empresa = await this.prisma.empresa.upsert({
        where: { nit },
        create: {
          nit,
          digitoVerificacion: dto.digitoVerificacion ?? null,
          razonSocial: dto.razonSocial ?? `Organización ${nit}`,
          ...datos,
        },
        // lo que ya se sabía no se pisa con un hueco
        update: Object.fromEntries(
          Object.entries(datos).filter(([, v]) => v !== undefined && v !== null),
        ),
        select: { id: true },
      });

      await this.prisma.participante.update({
        where: { id: p.id },
        data: { empresaId: empresa.id },
      });
    }

    // aquí acaba: el enlace era de un solo uso
    await this.prisma.enlaceCompletado.update({
      where: { id: enlace.id },
      data: { usadoEn: new Date() },
    });

    return { guardado: true, enlaceCerrado: true };
  }

  /** Termina sin llenar lo de la empresa. */
  async cerrar(token: string) {
    const enlace = await this.exigirEnlaceVivo(token);
    await this.prisma.enlaceCompletado.update({
      where: { id: enlace.id },
      data: { usadoEn: new Date() },
    });
    return { cerrado: true };
  }

  private async exigirEnlaceVivo(token: string) {
    const enlace = await this.prisma.enlaceCompletado.findUnique({
      where: { token },
      select: { id: true, participanteId: true, expiraEn: true, usadoEn: true },
    });
    // el mismo mensaje para los tres casos: decir "ya se
    // usó" confirma que existió, y eso es un oráculo
    if (!enlace || enlace.usadoEn || enlace.expiraEn < new Date()) {
      throw new NotFoundException(
        'Este enlace ya no está disponible. Pida uno nuevo a quien lo atendió.',
      );
    }
    return enlace;
  }

  private exigirDocumentoValido(id: number) {
    if (!DOCUMENTOS_DE_PERSONA.some((d) => d.id === id)) {
      throw new BadRequestException('Ese tipo de documento no está permitido.');
    }
  }
}
