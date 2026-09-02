/** Lo que llegó por los webhooks, para poder mirarlo. */

/**
 * Sin esto la mesa de entrada era invisible: los leads entraban,
 * se guardaban bien, y la única forma de verlos era abrir la
 * base. Un buzón que nadie puede abrir es un buzón donde los
 * leads se mueren de viejos.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import {
  DOCUMENTOS_DE_PERSONA,
  motivoDeIdInvalido,
  siglaDocumento,
} from '../crm/catalogos-sep';
import { documentoValido, normalizarDocumento } from '../comun/documento';
import { PrismaService } from '../prisma/prisma.service';

import { AQuienSeParece } from './a-quien-se-parece';
import { puedoContactar } from './puedo-contactar';
import { ArreglarLeadDto } from './dto';
import {
  autorizoAlRegistrarse,
  loQueLeFaltaAlLead,
} from './listo-para-ficha';

/// Cuántos por página. La mesa se mira, no se estudia.
const POR_PAGINA = 50;
const TOPE = 200;

export type FiltrosDeLaMesa = {
  estado?: string;
  convenioId?: string;
  /// Documento, nombre, correo o celular.
  buscar?: string;
  pagina?: number;
  limite?: number;
};

@Injectable()
export class MesaDeEntrada {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seParece: AQuienSeParece,
  ) {}

  async listar(filtros: FiltrosDeLaMesa, ambito: string[]) {
    /// El ámbito ACOTA, nunca lo sustituye el filtro pedido.
    ///
    /// Con `convenioId` de fuera del ámbito la lista sale vacía,
    /// no completa: pedir uno que no es suyo no puede devolverlo
    /// todo. Es la misma regla que en tableros, y el defecto que
    /// ya apareció dos veces por escribirla con un spread.
    const donde: Prisma.LeadEntranteWhereInput = {
      AND: [
        { convenioId: { in: ambito } },
        ...(filtros.convenioId ? [{ convenioId: filtros.convenioId }] : []),
        ...(filtros.estado ? [{ estado: filtros.estado as never }] : []),
        ...(filtros.buscar?.trim() ? [this.comoSeBusca(filtros.buscar)] : []),
      ],
    };

    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(filtros.limite ?? POR_PAGINA, TOPE);

    const [total, filas, porEstado] = await Promise.all([
      this.prisma.leadEntrante.count({ where: donde }),
      this.prisma.leadEntrante.findMany({
        where: donde,
        orderBy: { recibidoEn: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          externoId: true,
          origenSistema: true,
          estado: true,
          motivo: true,
          origen: true,
          nombreCompleto: true,
          primerNombre: true,
          segundoNombre: true,
          primerApellido: true,
          segundoApellido: true,
          tipoDocumentoSepId: true,
          numeroDocumento: true,
          correo: true,
          celular: true,
          interes: true,
          recibidoEn: true,
          participanteId: true,
          accionFormacionId: true,
          departamentoSepId: true,
          municipioSepId: true,
          generoSepId: true,
          /// Lo que marco la persona: manda sobre el origen.
          aceptaHabeasData: true,
          /// De quien es y cuando se toco por ultima vez.
          asesorId: true,
          ultimaGestionEn: true,
          asesor: { select: { id: true, nombre: true } },
          /// Cuantas veces se ha gestionado. Es el numero que
          /// dice a quien hay que insistirle hoy.
          _count: { select: { notas: true } },
          convenio: { select: { slug: true, sigla: true } },
          accionFormacion: { select: { codigo: true, nombre: true } },
        },
      }),
      /// El recuento por estado, con el MISMO ámbito.
      ///
      /// Sin el ámbito, las cifras de arriba contarían los dos
      /// gremios mientras la tabla enseña uno — que es la clase
      /// de número que parece exacto y no lo es.
      this.prisma.leadEntrante.groupBy({
        by: ['estado'],
        where: { convenioId: { in: ambito } },
        _count: { _all: true },
      }),
    ]);

    /// Quién puede llevar estos leads.
    ///
    /// Va en la MISMA llamada que la lista: pedirla aparte serían
    /// dos viajes para pintar una pantalla, y este panel ya tiene
    /// escrito por qué eso no se hace.
    ///
    /// Misma regla que usa la ficha (`opciones`): concesión en
    /// alguno de los convenios del ámbito y un rol que atienda
    /// inscripciones. Los de solo consulta no llevan leads.
    const asesores = await this.prisma.admin.findMany({
      where: {
        activo: true,
        convenios: {
          some: {
            convenioId: { in: ambito },
            rol: {
              in: ['GESTOR_INSCRIPCION', 'LIDER_INSCRIPCION', 'LIDER_SISTEMAS'],
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, correo: true },
    });

    /// Quiénes revocaron, en UNA consulta para toda la página.
    ///
    /// La regla de si se puede llamar es la MISMA que aplica el
    /// `POST :id/notas`. Si la pantalla se lo inventara, pintaría
    /// el botón de llamar a alguien a quien el servidor va a
    /// rechazar -- o peor, lo pintaría y el servidor lo aceptaría.
    const revocaron = await this.seParece.cualesRevocaron(
      filas.map((l) => ({
        id: l.id,
        tipoDocumentoSepId: l.tipoDocumentoSepId,
        numeroDocumento: l.numeroDocumento,
        correo: l.correo,
        celular: l.celular,
      })),
    );

    /// Los cursos con los que se arregla un lead sin curso.
    ///
    /// Van los del ambito y visibles: ofrecer los del otro gremio
    /// dejaria elegir uno que el servidor va a rechazar, y los
    /// ocultos pondrian gente en algo que no esta abierto.
    const cursos = await this.prisma.accionFormacion.findMany({
      where: { convenioId: { in: ambito }, visible: true },
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, nombre: true, convenioId: true },
    });

    return {
      asesores,
      cursos,
      total,
      pagina,
      paginas: Math.max(1, Math.ceil(total / porPagina)),
      resumen: Object.fromEntries(
        porEstado.map((e) => [e.estado, e._count._all]),
      ),
      leads: filas.map((l) => ({
        id: l.id,
        estado: l.estado,
        motivo: l.motivo,
        /// El nombre armado, con las piezas si las hay.
        nombre:
          [l.primerNombre, l.segundoNombre, l.primerApellido, l.segundoApellido]
            .filter(Boolean)
            .join(' ') ||
          l.nombreCompleto ||
          '(sin nombre)',
        /// La SIGLA, no el número del catálogo.
        ///
        /// Salía «1 · 1020304050» y el 1 es el id del SEP, que no
        /// significa nada para quien atiende. El resto del panel
        /// ya lo hace así —crm.service.ts:740— y ese es el
        /// formato que el asesor reconoce: «CC 1020304050».
        documento: l.numeroDocumento
          ? `${l.tipoDocumentoSepId != null ? siglaDocumento(l.tipoDocumentoSepId) : '?'} ${l.numeroDocumento}`
          : null,
        correo: l.correo,
        celular: l.celular,
        origen: l.origen,
        /// De qué sistema entró: el orquestador, Meta, Postman.
        porDonde: l.origenSistema,
        gremio: l.convenio.sigla ?? l.convenio.slug,
        /// Lo que PIDIÓ y lo que se RESOLVIÓ, que son dos cosas.
        pidio: l.interes,
        curso: l.accionFormacion
          ? `${l.accionFormacion.codigo} · ${l.accionFormacion.nombre}`
          : null,
        recibidoEn: l.recibidoEn,
        /// Si ya tiene ficha, para poder saltar a ella.
        participanteId: l.participanteId,
        /// Los valores EN CRUDO, para poder rellenar el
        /// formulario que los corrige.
        ///
        /// Arriba van compuestos --«Ana María Ruiz», «C.C.
        /// 1020304050»-- que es lo que se lee en la tabla y lo
        /// que NO se puede meter en un campo: descomponerlos en
        /// el navegador seria adivinar dónde acaba el nombre.
        crudo: {
          tipoDocumentoSepId: l.tipoDocumentoSepId,
          numeroDocumento: l.numeroDocumento,
          primerNombre: l.primerNombre,
          primerApellido: l.primerApellido,
          segundoApellido: l.segundoApellido,
          correo: l.correo,
          celular: l.celular,
          accionFormacionId: l.accionFormacionId,
          departamentoSepId: l.departamentoSepId,
          municipioSepId: l.municipioSepId,
          generoSepId: l.generoSepId,
        },
        /// Qué le falta para poder ser ficha. Vacío: está listo.
        ///
        /// Lo calcula el SERVIDOR con la misma función que usa el
        /// lote al convertir. Si la pantalla se lo inventara por
        /// su cuenta serían dos verdades: encendería la casilla de
        /// un lead que el servidor va a rechazar, o la apagaría en
        /// uno perfectamente convertible.
        falta: loQueLeFaltaAlLead(l),
        /// Y si autorizó al registrarse, porque cambia lo que
        /// pasa al convertirlo: sin esto la ficha nace sin
        /// autorización y no se puede matricular ni reportar.
        autorizoAlRegistrarse: autorizoAlRegistrarse(l.origen, l.aceptaHabeasData),
        /// De quién es, para poder trabajar la cola propia.
        asesor: l.asesor,
        /// Cuándo se tocó y cuántas veces: es lo que ordena «a
        /// quién hay que insistirle hoy».
        ultimaGestionEn: l.ultimaGestionEn,
        gestiones: l._count.notas,
        /// Si se puede llamar, con la MISMA regla del servidor.
        puedoContactar: puedoContactar({
          estado: l.estado,
          participanteId: l.participanteId,
          revoco: revocaron.has(l.id),
        }),
      })),
    };
  }

  /// Documento, nombre, correo o celular, sin pedir cuál.
  ///
  /// Quien busca a alguien en la mesa tiene UN dato suelto y no
  /// sabe en qué columna vive. Obligarle a elegir el campo es
  /// hacerle adivinar antes de buscar.
  private comoSeBusca(texto: string): Prisma.LeadEntranteWhereInput {
    const t = texto.trim();
    const soloDigitos = t.replace(/\D/g, '');

    return {
      OR: [
        { numeroDocumento: { contains: soloDigitos || t } },
        { celular: { contains: soloDigitos || t } },
        { correo: { contains: t, mode: 'insensitive' } },
        { nombreCompleto: { contains: t, mode: 'insensitive' } },
        { primerNombre: { contains: t, mode: 'insensitive' } },
        { primerApellido: { contains: t, mode: 'insensitive' } },
        { externoId: { contains: t, mode: 'insensitive' } },
      ],
    };
  }

  /**
   * Arregla un lead que llegó mal.
   *
   * Es la otra mitad de «recibir todos los leads»: si entran
   * todos, alguien tiene que poder componer los que llegaron
   * incompletos. El curso que no se reconoció, la ciudad mal
   * escrita, el documento que no venía.
   *
   * Sin esta puerta, la mesa dice qué falta y no da por dónde
   * arreglarlo — que es exactamente el callejón que este proyecto
   * ya se comió con el enlace de completado.
   */
  async arreglar(id: string, dto: ArreglarLeadDto, ambito: string[]) {
    /// Fuera del ámbito la fila NO EXISTE: 404 y no 403.
    const lead = await this.prisma.leadEntrante.findFirst({
      where: { id, convenioId: { in: ambito } },
      select: { id: true, convenioId: true, estado: true, participanteId: true },
    });
    if (!lead) throw new NotFoundException('Ese lead no existe.');

    /// Uno ya convertido no se toca.
    ///
    /// Su ficha ya existe y es la que manda: cambiar el lead
    /// dejaría los dos diciendo cosas distintas sobre la misma
    /// persona, y el que nadie mira sería el lead. Lo que haya
    /// que corregir se corrige en la ficha.
    if (lead.participanteId || lead.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Este lead ya se atendió. Corrija los datos en su ficha, que es la ' +
          'que vale.',
      );
    }

    /// El curso tiene que ser de SU convenio.
    ///
    /// AF1 existe en los dos gremios y es un curso distinto en
    /// cada uno: aceptar el de fuera dejaría la ficha contando
    /// contra la cobertura de quien no es.
    if (dto.accionFormacionId) {
      const suya = await this.prisma.accionFormacion.findFirst({
        where: { id: dto.accionFormacionId, convenioId: lead.convenioId },
        select: { id: true },
      });
      if (!suya) {
        throw new BadRequestException(
          'Esa acción de formación no es de este convenio.',
        );
      }
    }

    /// El par departamento/municipio se juzga como quedará al
    /// terminar, no como llegó: es la misma regla del panel y del
    /// enlace de completado, y comprobar solo lo que se manda
    /// deja pasar un municipio que ya no cuadra con el
    /// departamento nuevo.
    const antes = await this.prisma.leadEntrante.findUnique({
      where: { id },
      select: { departamentoSepId: true, municipioSepId: true },
    });
    const dep =
      dto.departamentoSepId === undefined
        ? antes?.departamentoSepId
        : dto.departamentoSepId;
    const mun =
      dto.municipioSepId === undefined
        ? antes?.municipioSepId
        : dto.municipioSepId;

    const malo = motivoDeIdInvalido({
      departamentoSepId: dep ?? undefined,
      municipioSepId: mun ?? undefined,
      generoSepId: dto.generoSepId ?? undefined,
    });
    if (malo) throw new BadRequestException(malo);

    /// El tipo de documento se valida aparte: tiene que servir
    /// para una PERSONA. `motivoDeIdInvalido` no lo cubre porque
    /// el catalogo mezcla los de empresa (NIT) con los de
    /// persona, y un NIT en una ficha de alguien es un cargue
    /// falso al SENA.
    if (
      dto.tipoDocumentoSepId != null &&
      !DOCUMENTOS_DE_PERSONA.some((t) => t.id === dto.tipoDocumentoSepId)
    ) {
      throw new BadRequestException(
        'Ese tipo de documento no se admite para una persona.',
      );
    }

    /// El documento se NORMALIZA antes de guardarlo, como en las
    /// otras siete puertas.
    ///
    /// `@Transform(recortar)` del DTO solo quita espacios: deja
    /// pasar «1.020.304.050», que es una `Persona` distinta de
    /// «1020304050» porque el `@@unique` compara el texto. Es el
    /// mismo agujero que tenía la preinscripción pública, y esta
    /// puerta es peor: aquí se compone a mano justo el lead al
    /// que le faltaba el documento, así que es donde MÁS se
    /// teclea con puntos.
    let numeroDocumento = dto.numeroDocumento;
    if (numeroDocumento != null && numeroDocumento !== '') {
      const limpio = normalizarDocumento(numeroDocumento);
      if (!limpio) {
        throw new BadRequestException(
          'Ese número de documento no tiene forma de documento.',
        );
      }
      /// Y que sirva para ESE tipo: los numéricos no admiten letras.
      const tipo = dto.tipoDocumentoSepId;
      if (tipo != null && !documentoValido(tipo, limpio)) {
        throw new BadRequestException(
          'Ese número no corresponde con el tipo de documento elegido.',
        );
      }
      numeroDocumento = limpio;
    }

    return this.prisma.leadEntrante.update({
      where: { id },
      data: {
        accionFormacionId: dto.accionFormacionId,
        departamentoSepId: dto.departamentoSepId,
        municipioSepId: dto.municipioSepId,
        generoSepId: dto.generoSepId,
        tipoDocumentoSepId: dto.tipoDocumentoSepId,
        numeroDocumento,
        primerNombre: dto.primerNombre,
        primerApellido: dto.primerApellido,
        segundoApellido: dto.segundoApellido,
        correo: dto.correo,
        celular: dto.celular,
      },
      select: { id: true },
    });
  }
}
