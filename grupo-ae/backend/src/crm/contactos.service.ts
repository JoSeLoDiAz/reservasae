/** Crear un contacto a mano: la persona y su negocio, de una vez. */

/**
 * El porqué de esta puerta está en `contacto-nuevo.ts`. Aquí está el
 * CÓMO, y el orden de la función `crear` ES la función, como en la
 * captación: primero se comprueba todo y después se escribe, porque
 * rechazar a mitad de camino deja dentro la mitad de los datos.
 *
 * Lo que se reusa, y por qué no se copia:
 *
 *  - `OportunidadesService.crear` numera el negocio (`OP-2026-0001`),
 *    escribe la bitácora y pasa por la escalera. Crear la fila aquí a
 *    mano sería un segundo generador de códigos —dos altas a la vez
 *    sacando el mismo número— y una entrada que se salta las
 *    compuertas.
 *  - `queHacerCon` decide si esto ya lo teníamos. Es la regla de la
 *    captación, y tiene que ser la misma: el cliente que escribe por
 *    el formulario y al que luego el asesor apunta a mano no puede
 *    acabar con dos negocios en el mismo embudo.
 *  - `dejarConstancia` escribe la autorización de la Ley 1581 contra
 *    la versión vigente de la política, igual que la conversión de
 *    un lead.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  CanalAutorizacion,
  OrigenParticipante,
  TipoEmbudo,
  TipoGestion,
  type Admin,
} from '../../generated/prisma';
import type { Ambito } from '../admin/admin.guard';
import { queHacerCon } from '../captacion/no-duplicar';
import {
  documentoValido,
  nombreCompleto,
  normalizarDocumento,
} from '../comun/documento';
import { normalizarNit } from '../comun/nit';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENTOS_DEL_FORMULARIO,
  DOCUMENTOS_DE_PERSONA,
} from './catalogos-sep';
import { dejarConstancia } from './constancia-de-autorizacion';
import {
  esLaMismaPersona,
  notaDelContacto,
  revisarContacto,
  tituloDelNegocio,
  type LoQueSeSupo,
} from './contacto-nuevo';
import type { CrearContactoDto } from './contactos.dto';
import { llevanFichasEn } from './quien-lleva-fichas';

/// Qué pasó, para que la pantalla lo diga con sus palabras.
export type ResultadoDelContacto = {
  /// CREADO: negocio nuevo. YA_ESTABA: el mismo envío de hace un
  /// momento, no se hizo nada. ANOTADO: ya había un negocio vivo
  /// con este cliente y se le anotó ahí.
  que: 'CREADO' | 'YA_ESTABA' | 'ANOTADO';
  oportunidad: { id: string; codigo: string; embudo: TipoEmbudo };
  personaYaExistia: boolean;
  /// Lo que escribió y no reemplazó a lo guardado.
  loQueNoSePiso: string[];
  /// Si el negocio quedó a su nombre o sin dueño.
  asignadoAQuienLoCreo: boolean;
  constancia: LoQueSeSupo['constancia'];
};

@Injectable()
export class ContactosService {
  private readonly log = new Logger('Contactos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly oportunidades: OportunidadesService,
  ) {}

  /**
   * Lo que el formulario necesita para pintarse.
   *
   * Los tipos de documento son los seis del formulario público y no
   * los diez del catálogo: los otros cuatro son de otros países y un
   * desplegable con opciones que nadie elige se contesta mal. El
   * servidor sigue ACEPTANDO los diez —ver `crear`—, así que quien
   * llegue con un DNI no se queda fuera.
   */
  async opciones(ambito: Ambito) {
    const lineas = await this.prisma.convenio.findMany({
      where: { id: { in: ambito.convenios }, activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, sigla: true },
    });
    return {
      lineas,
      tiposDeDocumento: DOCUMENTOS_DEL_FORMULARIO.map((t) => ({
        id: t.id,
        etiqueta: t.etiqueta,
        sigla: t.sigla,
      })),
    };
  }

  async crear(
    dto: CrearContactoDto,
    admin: Admin,
    ambito: Ambito,
    ip?: string,
  ): Promise<ResultadoDelContacto> {
    const embudo = dto.embudo ?? TipoEmbudo.PERSONA;

    /// 1. La línea de negocio, contra el ámbito y no contra lo que
    /// diga el cuerpo. Y activa: una línea apagada no recibe
    /// negocios nuevos, igual que su formulario deja de recibirlos.
    if (!ambito.convenios.includes(dto.convenioId)) {
      throw new BadRequestException('No tiene acceso a esa línea de negocio.');
    }
    const linea = await this.prisma.convenio.findFirst({
      where: { id: dto.convenioId, activo: true },
      select: { id: true },
    });
    if (!linea) {
      throw new BadRequestException('Esa línea de negocio no está activa.');
    }

    /// 2. El documento: es la identidad con la que esta persona ya
    /// existe —o no— en todo el CRM.
    if (!DOCUMENTOS_DE_PERSONA.some((t) => t.id === dto.tipoDocumentoSepId)) {
      throw new BadRequestException(
        'Ese tipo de documento no se admite para una persona.',
      );
    }
    const numero = normalizarDocumento(dto.numeroDocumento);
    if (!numero || !documentoValido(dto.tipoDocumentoSepId, numero)) {
      throw new BadRequestException(
        'El número de documento no corresponde al tipo que eligió. Revíselo: ' +
          'es con lo que esta persona se reconoce en todo el CRM.',
      );
    }

    /// 3. Cómo se le contacta.
    const contacto = revisarContacto(dto.correo, dto.celular);
    if (!contacto.puede) throw new BadRequestException(contacto.porque);

    /// 4. La organización. El NIT se valida siempre que venga,
    /// aunque se le venda a la persona: guardarlo mal en la nota es
    /// el mismo error, solo que más difícil de ver.
    const nit = dto.nit ? normalizarNit(dto.nit) : null;
    if (dto.nit && !nit) {
      throw new BadRequestException(
        'Ese NIT no tiene un formato válido: son de 5 a 15 dígitos, con o sin ' +
          'dígito de verificación.',
      );
    }
    if (embudo === TipoEmbudo.EMPRESA && !nit) {
      throw new BadRequestException(
        'Para venderle a la organización escriba su NIT: es con lo que se ' +
          'identifica en todo el sistema, y sin él no hay a nombre de quién ' +
          'abrir el negocio.',
      );
    }
    const empresaYa =
      embudo === TipoEmbudo.EMPRESA && nit
        ? await this.prisma.empresa.findUnique({
            where: { nit: nit.nit },
            select: {
              id: true,
              razonSocial: true,
              digitoVerificacion: true,
              contactoNombre: true,
              contactoCargo: true,
              contactoCorreo: true,
            },
          })
        : null;
    if (embudo === TipoEmbudo.EMPRESA && !empresaYa && !dto.organizacion) {
      throw new BadRequestException(
        'Escriba el nombre de la organización: ese NIT todavía no está en el ' +
          'CRM y sin su nombre no sabríamos cómo llamarla.',
      );
    }

    /// 5. ¿Ya existe esa persona? Y si existe, ¿es la que se
    /// escribió? Ver `esLaMismaPersona`: un dígito mal tecleado le
    /// cuelga el negocio a otra persona.
    const llave = {
      tipoDocumentoSepId_numeroDocumento: {
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento: numero,
      },
    };
    const ya = await this.prisma.persona.findUnique({
      where: llave,
      select: {
        id: true,
        primerApellido: true,
        segundoApellido: true,
        correo: true,
        celular: true,
      },
    });
    if (ya && !esLaMismaPersona(ya, dto)) {
      /// No se dice a nombre de quién está: el asesor no necesita
      /// saberlo para corregir su número, y decirlo le enseñaría el
      /// nombre de cualquiera a quien pruebe cédulas.
      throw new ConflictException(
        'Ese documento ya está registrado con otros apellidos. Revise el ' +
          'número; si es la misma persona, escriba los apellidos como aparecen ' +
          'en su documento.',
      );
    }

    // ── de aquí en adelante se escribe ──

    /// 6. La persona. SOLO SE RELLENAN HUECOS, la misma regla de la
    /// captación: si ya tenía un correo, lo que se escribió hoy no lo
    /// reemplaza en silencio. Se dice en la nota y en la pantalla, y
    /// el asesor lo confirma con ella.
    const comoSeLlama = nombreCompleto(dto);
    const persona = await this.prisma.persona.upsert({
      where: llave,
      create: {
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento: numero,
        primerNombre: dto.primerNombre,
        segundoNombre: dto.segundoNombre || null,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido || null,
        correo: contacto.correo,
        celular: contacto.celular,
      },
      update: {
        correo: ya?.correo ?? contacto.correo ?? undefined,
        celular: ya?.celular ?? contacto.celular ?? undefined,
      },
      select: { id: true },
    });

    const loQueNoSePiso: string[] = [];
    if (ya?.correo && contacto.correo && ya.correo !== contacto.correo) {
      loQueNoSePiso.push(`el correo «${contacto.correo}»`);
    }
    if (ya?.celular && contacto.celular && ya.celular !== contacto.celular) {
      loQueNoSePiso.push(`el celular «${contacto.celular}»`);
    }

    /// 7. La organización, cuando el negocio es suyo. Mismo trato que
    /// en la captación: una empresa es única en toda la base y lo que
    /// ya se sabía de ella no se pisa. El contacto de la empresa —
    /// nombre, cargo, correo— se llena si estaba vacío, porque es
    /// justo lo que el asesor acaba de averiguar.
    let empresa: { id: string; razonSocial: string } | null = null;
    if (embudo === TipoEmbudo.EMPRESA && nit) {
      if (
        empresaYa &&
        dto.organizacion &&
        empresaYa.razonSocial.trim().toLowerCase() !==
          dto.organizacion.trim().toLowerCase()
      ) {
        loQueNoSePiso.push(
          `el nombre de organización «${dto.organizacion}» (ese NIT ya tenía otro)`,
        );
      }
      empresa = await this.prisma.empresa.upsert({
        where: { nit: nit.nit },
        create: {
          nit: nit.nit,
          digitoVerificacion: nit.digitoVerificacion,
          razonSocial: dto.organizacion as string,
          contactoNombre: comoSeLlama,
          contactoCargo: dto.cargo || null,
          contactoCorreo: contacto.correo,
        },
        update: {
          digitoVerificacion:
            empresaYa?.digitoVerificacion ?? nit.digitoVerificacion,
          contactoNombre: empresaYa?.contactoNombre ?? comoSeLlama,
          contactoCargo: empresaYa?.contactoCargo ?? (dto.cargo || undefined),
          contactoCorreo:
            empresaYa?.contactoCorreo ?? contacto.correo ?? undefined,
        },
        select: { id: true, razonSocial: true },
      });
    }

    /// 8. La constancia de la Ley 1581, si la persona la dio.
    const canal = dto.canalAutorizacion ?? CanalAutorizacion.VERBAL_ASESOR;
    const constancia: LoQueSeSupo['constancia'] = dto.autorizo
      ? await dejarConstancia(this.prisma, {
          personaId: persona.id,
          convenioId: dto.convenioId,
          canal,
          evidencia: `Registrada a mano en el panel por ${admin.nombre} al crear el contacto`,
          ip: ip ?? null,
        })
      : 'NO_DIJO';

    const nota = notaDelContacto({
      registradoPor: admin.nombre,
      organizacion: empresa?.razonSocial ?? dto.organizacion,
      nit: nit?.nit ?? null,
      cargo: dto.cargo,
      loQueNoSePiso,
      constancia,
      canal,
      nota: dto.nota,
    });

    /// 9. ¿Esto ya lo teníamos? El filtro del titular se arma
    /// explícito: `{ personaId: undefined }` no acota nada y
    /// devolvería el negocio de cualquiera.
    const suyo = empresa
      ? { empresaId: empresa.id }
      : { personaId: persona.id };
    const anteriores = await this.prisma.oportunidad.findMany({
      where: { convenioId: dto.convenioId, embudo, ...suyo },
      orderBy: { creadoEn: 'desc' },
      take: 20,
      select: {
        id: true,
        codigo: true,
        etapa: true,
        creadoEn: true,
        ultimoToqueEn: true,
      },
    });
    const veredicto = queHacerCon(anteriores, new Date());

    /// El asesor se queda con lo que crea, si puede llevarlo.
    ///
    /// Se pregunta con `llevanFichasEn`, que es la regla de «Asignar
    /// asesor»: sin ella, un superadmin sin rol comercial quedaría de
    /// dueño de un negocio que después nadie le puede reasignar desde
    /// el desplegable, porque no sale en él.
    const puedeLlevarlo = await this.prisma.admin.findFirst({
      where: { id: admin.id, ...llevanFichasEn(dto.convenioId) },
      select: { id: true },
    });
    const asesorId = puedeLlevarlo ? admin.id : null;

    const base = {
      personaYaExistia: !!ya,
      loQueNoSePiso,
      asignadoAQuienLoCreo: !!asesorId,
      constancia,
    };

    if (veredicto.que === 'EL_MISMO_ENVIO') {
      /// El doble clic, o el reintento tras una red lenta. Ni fila
      /// ni nota: fue el mismo acto.
      return {
        ...base,
        que: 'YA_ESTABA',
        oportunidad: { id: veredicto.id, codigo: veredicto.codigo, embudo },
      };
    }

    if (veredicto.que === 'EL_MISMO_NEGOCIO') {
      /// Ya se trabaja un negocio vivo con este cliente. No se abre
      /// otro —serían dos asesores llamando a la misma persona—, pero
      /// lo que se supo hoy se anota en el que hay.
      await this.oportunidades.dejarNota(
        veredicto.id,
        `Se volvió a registrar como contacto nuevo.\n${nota}`,
        admin,
        ambito,
      );
      return {
        ...base,
        que: 'ANOTADO',
        oportunidad: { id: veredicto.id, codigo: veredicto.codigo, embudo },
      };
    }

    /// 10. El negocio, en «Solicitud de negocio».
    const creada = await this.oportunidades.crear(
      {
        embudo,
        titulo: tituloDelNegocio(
          dto.interes,
          empresa?.razonSocial ?? comoSeLlama,
        ),
        convenioId: dto.convenioId,
        personaId: persona.id,
        empresaId: empresa?.id ?? null,
        asesorId,
        origen: dto.origen ?? OrigenParticipante.ASESOR,
      },
      admin,
    );

    /// 11. La primera tarea, con lo que se sabe.
    ///
    /// Una oportunidad sin próximo paso es una oportunidad abandonada,
    /// y la nota es el único sitio donde caben la organización y el
    /// cargo cuando se le vende a la persona.
    ///
    /// Si esto falla, el contacto NO se cae con ello: la persona y su
    /// negocio ya existen. La nota entera va al registro para que no
    /// se pierda lo que se escribió.
    try {
      await this.prisma.gestion.create({
        data: {
          oportunidadId: creada.id,
          tipo: TipoGestion.TAREA,
          titulo: `Contactar a ${
            empresa ? `${comoSeLlama}, de ${empresa.razonSocial}` : comoSeLlama
          }`.slice(0, 200),
          nota,
          venceEn: new Date(),
          asesorId,
          creadaPorId: admin.id,
        },
      });
    } catch (e) {
      this.log.error(
        `No se pudo anotar la primera tarea de ${creada.codigo}: ` +
          (e instanceof Error ? e.message : String(e)) +
          `\n${nota}`,
      );
    }

    return {
      ...base,
      que: 'CREADO',
      oportunidad: { id: creada.id, codigo: creada.codigo, embudo },
    };
  }
}
