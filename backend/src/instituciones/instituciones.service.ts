/** El maestro de organizaciones: consultar, corregir, verificar. */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, type FuenteDato } from '../../generated/prisma';
import { ENTIDADES, AuditoriaService } from '../comun/auditoria.service';
import { calcularDigitoVerificacion } from '../comun/nit';
import { PrismaService } from '../prisma/prisma.service';
import { AplicarPropuestaDto, EditarInstitucionDto } from './dto';
import { filasDeDescarte, recordarDescartes } from './web/descartes';

/// Lo obligatorio de una empresa. Si falta alguno, la ficha
/// no se puede dar por aprobada y hay que ir a buscarlo.
///
/// Fecha de fundación, correo, página web y número de
/// empleados quedan fuera a propósito: son útiles, pero no
/// bloquean.
const CAMPOS_OBLIGATORIOS = [
  'razonSocial',
  'nombreComercial',
  'direccion',
  'telefono',
  'ciudadNombre',
  'departamentoNombre',
  'sectorEconomico',
  'codigoCiiu',
  'clasificacion',
  'tamano',
] as const;

const POR_PAGINA = 50;

@Injectable()
export class InstitucionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * El listado, con lo que le falta a cada una.
   *
   * `verificada` no es cosmético: una ficha que nadie ha
   * mirado no debería salir en un reporte al SENA por muy
   * completa que se vea.
   */
  async listar(opciones: {
    buscar?: string;
    soloIncompletas?: boolean;
    soloSinVerificar?: boolean;
    soloSugeridos?: boolean;
    /// Las QUITADAS del listado, para poder deshacerlo.
    ///
    /// Ocultar es `activo: false`, así que las ocultas son justo las
    /// que este listado nunca enseña. Sin una forma de pedirlas, la
    /// acción de quitar no tendría vuelta atrás: la fila seguiría en
    /// la base pero no habría ninguna pantalla desde la que verla.
    soloOcultas?: boolean;
    pagina?: number;
  }) {
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const buscar = opciones.buscar?.trim();

    /// Lo uno o lo otro, nunca las dos a la vez: mezclar activas y
    /// ocultas en una misma tabla haría que la acción de cada fila
    /// dependiera de una columna que no se está mirando.
    const where: Prisma.InstitucionWhereInput = {
      activo: !opciones.soloOcultas,
    };

    if (buscar) {
      // por NIT si lo que teclearon son dígitos, por nombre si no
      const digitos = buscar.replace(/\D/g, '');
      where.OR = [
        { razonSocial: { contains: buscar, mode: 'insensitive' } },
        { nombreComercial: { contains: buscar, mode: 'insensitive' } },
        ...(digitos ? [{ nit: { startsWith: digitos } }] : []),
      ];
    }

    if (opciones.soloSinVerificar) where.verificadaEn = null;

    /// «Incompleta» y «sugerido» salen de mirar campo a campo
    /// y del JSON de procedencia: no son una columna que SQL
    /// pueda filtrar. Cuando se piden, se traen todas las que
    /// cumplen el `where` y se pagina despues -- si no, el
    /// total mentiria y habria paginas vacias en medio.
    const enMemoria = Boolean(
      opciones.soloIncompletas || opciones.soloSugeridos,
    );

    const consulta = {
      where,
      orderBy: [{ razonSocial: 'asc' as const }],
      include: {
        verificadaPor: { select: { nombre: true } },
        _count: { select: { empresas: true, propuestas: true } },
      },
    };

    if (!enMemoria) {
      const [filas, total] = await this.prisma.$transaction([
        this.prisma.institucion.findMany({
          ...consulta,
          skip: (pagina - 1) * POR_PAGINA,
          take: POR_PAGINA,
        }),
        this.prisma.institucion.count({ where }),
      ]);

      const leads = await this.leadsPorInstitucion(filas);

      return {
        instituciones: filas.map((f) => this.conFaltantes(f, leads)),
        total,
        pagina,
        porPagina: POR_PAGINA,
      };
    }

    const crudas = await this.prisma.institucion.findMany(consulta);
    const leads = await this.leadsPorInstitucion(crudas);
    const todas = crudas.map((f) => this.conFaltantes(f, leads));

    const filtradas = todas.filter(
      (x) =>
        (!opciones.soloIncompletas || x.falta.length > 0) &&
        (!opciones.soloSugeridos || x.sinConfirmar.length > 0),
    );

    return {
      instituciones: filtradas.slice(
        (pagina - 1) * POR_PAGINA,
        pagina * POR_PAGINA,
      ),
      total: filtradas.length,
      pagina,
      porPagina: POR_PAGINA,
    };
  }

  /**
   * Cuántas caen en cada filtro.
   *
   * «Incompleta» y «sugerido» salen de mirar campo a campo y
   * del JSON de procedencia, así que se cuentan en memoria.
   * Con unos cientos de filas no cuesta nada, y así la pantalla
   * puede decir al lado de cada casilla a cuántas afecta.
   */
  async resumen() {
    const [filas, propuestas] = await this.prisma.$transaction([
      this.prisma.institucion.findMany({
        where: { activo: true },
        select: {
          verificadaEn: true,
          fuentePorCampo: true,
          razonSocial: true,
          nombreComercial: true,
          direccion: true,
          telefono: true,
          ciudadNombre: true,
          departamentoNombre: true,
          sectorEconomico: true,
          codigoCiiu: true,
          clasificacion: true,
          tamano: true,
        },
      }),
      this.prisma.propuestaInstitucion.count({
        where: { estado: 'PENDIENTE' },
      }),
    ]);

    const revisadas = filas.map((f) => this.conFaltantes(f));

    return {
      total: filas.length,
      verificadas: revisadas.filter((x) => x.verificadaEn !== null).length,
      sinVerificar: revisadas.filter((x) => x.verificadaEn === null).length,
      incompletas: revisadas.filter((x) => x.falta.length > 0).length,
      sugeridas: revisadas.filter((x) => x.sinConfirmar.length > 0).length,
      propuestas,
    };
  }

  /** Una ficha entera, con sus propuestas sin resolver. */
  async ver(id: string) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      include: {
        verificadaPor: { select: { nombre: true } },
        empresas: {
          select: {
            id: true,
            razonSocial: true,
            _count: { select: { participantes: true } },
          },
        },
        propuestas: {
          where: { estado: 'PENDIENTE' },
          orderBy: { creadoEn: 'desc' },
          select: { id: true, campos: true, fuente: true, creadoEn: true },
        },
        /// LOS DESCARTES, PARA PODER DESHACERLOS.
        ///
        /// Van en la ficha y no en una pantalla propia porque la
        /// pregunta que trae a alguien aquí es la de al lado: «esta
        /// organización tiene un teléfono raro, ¿por qué el buscador
        /// no lo corrige?». La respuesta ---porque alguien descartó
        /// el bueno--- tiene que estar donde se hace la pregunta, al
        /// lado de las propuestas y del control de cambios, no en
        /// otro sitio al que habría que saber ir.
        ///
        /// Sin `take`: son catorce campos como máximo, así que la
        /// lista no puede crecer tanto como para pedir paginación, y
        /// cortarla esconderia justo la fila que alguien busca.
        descartes: {
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            campo: true,
            /// El valor TAL COMO LLEGÓ, no el normalizado: lo que hay
            /// que poder reconocer es el teléfono que se descartó, y
            /// `valor` está en minúscula y sin tildes para comparar.
            valorMostrado: true,
            fuente: true,
            creadoEn: true,
            descartadoPor: { select: { nombre: true } },
          },
        },
        consultas: {
          orderBy: { creadoEn: 'desc' },
          take: 5,
          select: {
            id: true,
            estado: true,
            ultimoError: true,
            resueltaEn: true,
            creadoEn: true,
          },
        },
      },
    });
    if (!f)
      throw new NotFoundException('No hay ninguna institución con ese id.');

    /// CON `ENTIDADES.INSTITUCION` Y NO CON LA CADENA 'Institucion'.
    ///
    /// Era el único sitio del backend que seguía escribiendo el
    /// nombre de la entidad a mano, y con otra mayúscula: todo lo que
    /// se audita de una organización se guarda como 'institucion'
    /// ---`editar`, `ocultar`, `mostrar`--- así que esta consulta no
    /// encontraba NADA y el «Control de cambios» de la ficha salía
    /// siempre vacío sin que pareciera un fallo, porque una lista
    /// vacía se ve igual que una organización que nadie ha tocado.
    /// Es justo lo que avisa el comentario de `ENTIDADES`.
    /// (30 sep 2026, al dejar auditado el deshacer de un descarte:
    /// sin esto la traza existía pero no se podía leer.)
    const historial = await this.auditoria.historial(
      ENTIDADES.INSTITUCION,
      id,
      50,
    );

    return {
      ...this.conFaltantes(f),
      historial,
      digitoVerificacion: calcularDigitoVerificacion(f.nit),
      empresas: f.empresas,
      propuestas: f.propuestas,
      descartes: f.descartes,
      consultas: f.consultas,
    };
  }

  /**
   * Corregir a mano.
   *
   * Lo que toca una persona queda con fuente HUMANO campo a
   * campo. No marca la ficha como verificada: corregir un
   * teléfono no es haber revisado los otros nueve datos.
   */
  async editar(
    id: string,
    dto: EditarInstitucionDto,
    admin: { id: string; nombre: string },
  ) {
    const antes = await this.prisma.institucion.findUnique({ where: { id } });
    if (!antes)
      throw new NotFoundException('No hay ninguna institución con ese id.');

    const puestos = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (puestos.length === 0) {
      throw new BadRequestException('No mandó ningún campo para cambiar.');
    }

    const fuentes: Record<string, string> = {
      ...this.aObjeto(antes.fuentePorCampo),
    };
    for (const [campo] of puestos) fuentes[campo] = 'HUMANO';

    const datos: Prisma.InstitucionUpdateInput = {
      ...Object.fromEntries(puestos),
      fuentePorCampo: fuentes,
    };
    if (dto.fechaFundacion) datos.fechaFundacion = new Date(dto.fechaFundacion);

    const f = await this.prisma.institucion.update({
      where: { id },
      data: datos,
      include: { verificadaPor: { select: { nombre: true } } },
    });

    /// Guardar es aprobar: quien corrige la ficha responde por
    /// ella. Pero solo si esta completa -- una ficha a la que
    /// le faltan datos no se puede dar por buena, y decirlo es
    /// mas util que apagar un boton sin explicar por que.
    /// Que cambio y desde que valor. Son datos de empresa,
    /// no de una persona: aqui si se puede guardar el valor,
    /// que es lo que hace util un control de cambios.
    const previo = antes as unknown as Record<string, unknown>;
    const cambios = puestos
      .filter(
        ([campo, valor]) => String(previo[campo] ?? '') !== String(valor ?? ''),
      )
      .map(
        ([campo, valor]) =>
          `${campo}: ${this.legible(previo[campo])} → ${this.legible(valor)}`,
      );

    if (cambios.length > 0) {
      await this.auditoria.registrar({
        actor: { id: admin.id, nombre: admin.nombre },
        accion: 'EMPRESA_EDITADA',
        entidad: ENTIDADES.INSTITUCION,
        entidadId: id,
        camposTocados: puestos.map(([campo]) => campo),
        resumen: cambios.join(' · ').slice(0, 900),
      });
    }

    const revisada = this.conFaltantes(f);
    if (revisada.falta.length > 0) return revisada;

    const aprobada = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: admin.id, verificadaEn: new Date() },
      include: { verificadaPor: { select: { nombre: true } } },
    });

    return this.conFaltantes(aprobada);
  }

  /** Alguien la miró y responde por ella. */
  async verificar(id: string, adminId: string) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!f)
      throw new NotFoundException('No hay ninguna institución con ese id.');

    const puesta = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: adminId, verificadaEn: new Date() },
      include: { verificadaPor: { select: { nombre: true } } },
    });

    return this.conFaltantes(puesta);
  }

  /** Se deja de verificar: lo que trajo el robot cambió. */
  async desverificar(id: string) {
    const f = await this.prisma.institucion.update({
      where: { id },
      data: { verificadaPorId: null, verificadaEn: null },
      include: { verificadaPor: { select: { nombre: true } } },
    });
    return this.conFaltantes(f);
  }

  /**
   * QUITAR DEL LISTADO: SE OCULTA, NO SE BORRA.
   *
   * «No tengo la opción de eliminar, ¿dónde se elimina el que no tiene
   * leads asociados?» (cliente, 30 sep 2026). Quitar del listado es
   * poner `activo: false`, que es justo por lo que ya filtra `listar`.
   *
   * LA FILA SE QUEDA ENTERA, y no por prudencia genérica: el NIT de
   * esta organización ya viajó al SENA dentro de informes entregados.
   * Borrar la fila deja esos informes sin nada detrás que los explique,
   * y el SENA puede volver a preguntar por ellos meses después.
   *
   * LA COMPROBACIÓN LA HACE EL SERVIDOR, no la pantalla. La columna
   * «Leads asociados» existe para que la persona sepa ANTES de pulsar,
   * pero no es la autoridad: entre que se pintó la tabla y que se pulsa
   * el botón, alguien pudo mover un lead a esta organización. Y se
   * cuenta con la MISMA función que alimenta esa columna
   * ---`leadsPorInstitucion`--- a propósito: una segunda forma de
   * contar acabaría discrepando de la que se ve en pantalla, y entonces
   * el sistema se negaría enseñando «sin nadie».
   */
  async ocultar(id: string, admin: { id: string; nombre: string }) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true, nit: true, razonSocial: true, activo: true },
    });
    if (!f)
      throw new NotFoundException('No hay ninguna institución con ese id.');

    /// Ya estaba oculta. No es un fallo que haya que enseñarle a
    /// nadie ---dos personas pueden estar limpiando el mismo
    /// listado--- pero tampoco se audita un cambio que no ocurrió.
    if (!f.activo) {
      return { id: f.id, razonSocial: f.razonSocial, activo: false };
    }

    const leads = (await this.leadsPorInstitucion([f])).get(f.id) ?? 0;
    if (leads > 0) {
      /// Dice CUÁNTOS. «No se puede» a secas obliga a ir a buscar el
      /// motivo; con el número, quien lo lee ya sabe que la columna
      /// que miró estaba vieja y cuánto le falta por mover.
      throw new BadRequestException(
        leads === 1
          ? 'No se puede quitar del listado: todavía tiene 1 lead asociado. ' +
              'Muévalo a otra organización primero.'
          : `No se puede quitar del listado: todavía tiene ${leads} leads ` +
              'asociados. Muévalos a otra organización primero.',
      );
    }

    await this.prisma.institucion.update({
      where: { id },
      data: { activo: false },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'EMPRESA_OCULTADA',
      entidad: ENTIDADES.INSTITUCION,
      entidadId: id,
      camposTocados: ['activo'],
      /// Con el NIT dentro: es lo que identifica a la organización en
      /// los informes ya entregados, y es por lo que se la buscaría
      /// si alguien pregunta por qué dejó de salir.
      resumen: `Quitada del listado sin leads asociados: ${f.razonSocial} (NIT ${f.nit})`,
    });

    return { id: f.id, razonSocial: f.razonSocial, activo: false };
  }

  /**
   * DEVOLVERLA AL LISTADO.
   *
   * Sin condiciones: si se quitó por error, lo que hay que poder hacer
   * es desandarlo. Mostrar no compromete nada ---la fila nunca dejó de
   * existir--- así que la única regla es que quede escrito quién la
   * devolvió, igual que quedó escrito quién la quitó.
   */
  async mostrar(id: string, admin: { id: string; nombre: string }) {
    const f = await this.prisma.institucion.findUnique({
      where: { id },
      select: { id: true, nit: true, razonSocial: true, activo: true },
    });
    if (!f)
      throw new NotFoundException('No hay ninguna institución con ese id.');

    if (f.activo) {
      return { id: f.id, razonSocial: f.razonSocial, activo: true };
    }

    await this.prisma.institucion.update({
      where: { id },
      data: { activo: true },
    });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'EMPRESA_MOSTRADA',
      entidad: ENTIDADES.INSTITUCION,
      entidadId: id,
      camposTocados: ['activo'],
      resumen: `Devuelta al listado: ${f.razonSocial} (NIT ${f.nit})`,
    });

    return { id: f.id, razonSocial: f.razonSocial, activo: true };
  }

  /** Lo que un robot propuso, esperando que alguien decida. */
  async pendientes() {
    return this.prisma.propuestaInstitucion.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'asc' },
      select: {
        id: true,
        campos: true,
        fuente: true,
        creadoEn: true,
        institucion: { select: { id: true, nit: true, razonSocial: true } },
      },
    });
  }

  /**
   * El asesor deja entrar unos campos y descarta el resto.
   *
   * Cada campo aceptado se queda con la fuente de la propuesta
   * -- RUES o WEB -- no con HUMANO: la persona autorizó que
   * entrara, no verificó el dato uno por uno.
   */
  async aplicarPropuesta(
    id: string,
    dto: AplicarPropuestaDto,
    adminId: string,
  ) {
    const propuesta = await this.prisma.propuestaInstitucion.findUnique({
      where: { id },
      select: {
        id: true,
        estado: true,
        campos: true,
        fuente: true,
        institucion: { select: { id: true, fuentePorCampo: true } },
      },
    });
    if (!propuesta) throw new NotFoundException('Esa propuesta ya no existe.');
    if (propuesta.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esa propuesta ya se resolvió.');
    }

    const traidos = this.aObjeto(propuesta.campos);
    const aceptados = dto.campos.filter((c) => c in traidos);

    if (aceptados.length > 0) {
      const fuentes: Record<string, string> = {
        ...this.aObjeto(propuesta.institucion.fuentePorCampo),
      };
      const datos: Record<string, unknown> = {};

      for (const campo of aceptados) {
        datos[campo] =
          campo === 'fechaFundacion' && typeof traidos[campo] === 'string'
            ? this.aFecha(traidos[campo])
            : traidos[campo];
        fuentes[campo] = propuesta.fuente;
      }

      try {
        await this.prisma.institucion.update({
          where: { id: propuesta.institucion.id },
          data: {
            ...datos,
            fuentePorCampo: fuentes,
          },
        });
      } catch (e) {
        /// Ya existe otra ficha con ese NIT y ese nombre.
        ///
        /// Pasa cuando el buscador devuelve la razón social
        /// bien escrita y alguien ya la había creado a mano:
        /// son la misma organización, dos veces. Fundirlas no
        /// lo puede decidir este código -- se dice qué pasó y
        /// la propuesta se queda pendiente.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          /// El mensaje hablaba de «ese NIT y esa razón social»,
          /// que era la llave vieja. Hoy la llave es `[nit]` a
          /// secas, así que el choque solo puede ser por NIT --y
          /// el aviso mandaba a revisar nombres repetidos, que no
          /// es donde está el problema: así la propuesta se
          /// quedaba pendiente para siempre sin salida posible.
          throw new BadRequestException(
            'Ya hay otra institución registrada con ese NIT. Son la misma ' +
              'organización dos veces: hay que fundirlas antes de poder aceptar ' +
              'esta propuesta. Si no sirve, descártela.',
          );
        }
        throw e;
      }
    }

    await this.prisma.propuestaInstitucion.update({
      where: { id },
      data: {
        estado: aceptados.length > 0 ? 'ACEPTADA' : 'DESCARTADA',
        camposAceptados: aceptados,
        resueltoPorId: adminId,
        resueltoEn: new Date(),
      },
    });

    /// LO QUE NO SE MARCÓ SE RECUERDA COMO RECHAZADO.
    ///
    /// Es el arreglo de fondo de la bandeja «Por revisar». Sin
    /// esto, descartar un campo lo dejaba vacío en la ficha, y
    /// vacío era justo la condición para que la siguiente
    /// consulta del mismo NIT lo propusiera otra vez: 45
    /// propuestas que no bajaban porque se rellenaban solas.
    const rechazados: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(traidos)) {
      if (!aceptados.includes(campo)) rechazados[campo] = valor;
    }
    await this.recordarDescartes(
      propuesta.institucion.id,
      rechazados,
      propuesta.fuente,
      adminId,
    );

    /// Solo si entró algo: descartar no cambia la ficha, y una
    /// ficha ya completa no puede quedar aprobada porque alguien
    /// haya tirado una propuesta a la basura.
    if (aceptados.length > 0) {
      await this.aprobarSiQuedoCompleta(propuesta.institucion.id, adminId);
    }

    return {
      aplicados: aceptados.length,
      descartados: Object.keys(traidos).length - aceptados.length,
    };
  }

  /**
   * DESCARTAR VARIAS DE UNA.
   *
   * Resolver una propuesta cuesta entre dos y siete clics; con
   * la bandeja en 45 eso son hasta 315. Esta puerta cierra una
   * lista entera: ninguna escribe en la ficha --descartar es
   * aplicar nada-- y todas dejan su memoria de rechazo.
   *
   * Las que ya estaban resueltas no son un error: se cuentan
   * aparte. Dos personas pueden estar vaciando la misma bandeja.
   */
  async descartarVarias(ids: string[], adminId: string) {
    const propuestas = await this.prisma.propuestaInstitucion.findMany({
      where: { id: { in: ids }, estado: 'PENDIENTE' },
      select: { id: true, campos: true, fuente: true, institucionId: true },
    });

    for (const p of propuestas) {
      await this.recordarDescartes(
        p.institucionId,
        this.aObjeto(p.campos),
        p.fuente,
        adminId,
      );
    }

    /// Nada se borra: la fila se marca DESCARTADA y se queda con
    /// quién y cuándo, que es la traza de la decisión.
    const { count } = await this.prisma.propuestaInstitucion.updateMany({
      where: { id: { in: propuestas.map((p) => p.id) } },
      data: {
        estado: 'DESCARTADA',
        camposAceptados: [],
        resueltoPorId: adminId,
        resueltoEn: new Date(),
      },
    });

    return { descartadas: count, yaResueltas: ids.length - propuestas.length };
  }

  /**
   * DESHACER UN DESCARTE: que ese valor vuelva a proponerse.
   *
   * POR QUÉ HACE FALTA (repaso de QA, 30 sep 2026). Descartar un
   * campo escribe una fila en `descartes_de_campo` para que el
   * buscador no vuelva a proponer lo mismo ---eso arregló la bandeja
   * que no bajaba de 45--- pero no había ninguna pantalla que las
   * listara ni las quitara. Descartar por error el teléfono BUENO
   * dejaba ese teléfono fuera para siempre, sin aviso y sin salida.
   * Choca de frente con la regla de la casa: nada se pierde sin
   * vuelta atrás.
   *
   * Y AQUÍ SÍ SE BORRA LA FILA, que es la excepción y conviene
   * explicarla. En esta casa una categoría se oculta y una empresa
   * se quita del listado, pero la fila se queda. Esto no es un dato
   * de nadie: es un APUNTE de que alguien dijo «no» una vez, y la
   * llave única es (institución, campo, valor). Marcarlo como
   * revocado en vez de quitarlo tendría dos consecuencias malas: el
   * buscador seguiría filtrando por esa llave ---o habría que
   * acordarse de excluir los revocados en los dos sitios que la
   * leen--- y volver a descartar el mismo valor más adelante
   * chocaría con la fila vieja y `skipDuplicates` lo tiraría en
   * silencio, dejando un descarte que no descarta. Así que la fila
   * se va y la traza se queda en el control de cambios, con quién y
   * cuándo, que es lo que había que no perder.
   */
  async permitirDeNuevo(id: string, admin: { id: string; nombre: string }) {
    const d = await this.prisma.descarteDeCampo.findUnique({
      where: { id },
      select: {
        id: true,
        campo: true,
        valorMostrado: true,
        institucion: { select: { id: true, nit: true } },
      },
    });
    /// Dos personas pueden estar mirando la misma ficha. Que ya no
    /// esté no es un error del servidor: es que alguien se adelantó,
    /// y hay que decirlo así y no con un 500.
    if (!d) {
      throw new NotFoundException(
        'Ese dato descartado ya no está en la lista: puede que alguien ' +
          'acabara de volver a permitirlo.',
      );
    }

    await this.prisma.descarteDeCampo.delete({ where: { id } });

    await this.auditoria.registrar({
      actor: { id: admin.id, nombre: admin.nombre },
      accion: 'DESCARTE_REVOCADO',
      entidad: ENTIDADES.INSTITUCION,
      entidadId: d.institucion.id,
      camposTocados: [d.campo],
      /// Con el valor dentro: sin él la entrada diría «se volvió a
      /// permitir un teléfono» y la pregunta que se hace es CUÁL.
      /// Es dato de una organización, no de una persona, así que no
      /// cae en la regla del `resumen`.
      resumen:
        `Se volvió a permitir «${d.valorMostrado}» en ${d.campo}: el ` +
        `buscador puede proponerlo otra vez (NIT ${d.institucion.nit})`,
    });

    return { id: d.id, campo: d.campo, valorMostrado: d.valorMostrado };
  }

  /**
   * ACEPTAR VARIAS DE UNA, CON TODOS SUS CAMPOS.
   *
   * No hay forma de elegir campos en lote: entra TODO lo que
   * traen esas propuestas. La pantalla lo dice con todas las
   * letras antes de confirmar, porque es la diferencia entre
   * esta puerta y la de una en una.
   *
   * Se reutiliza `aplicarPropuesta` por propuesta en vez de
   * escribir un camino nuevo: así el registro de fuentes por
   * campo, la memoria de descartes y la regla de verificación
   * son los MISMOS. Una que falle --un NIT repetido, por
   * ejemplo-- no tumba el lote: se devuelve su motivo y se
   * queda pendiente.
   */
  async aceptarVarias(ids: string[], adminId: string) {
    let aceptadas = 0;
    let aplicados = 0;
    const fallidas: Array<{ id: string; motivo: string }> = [];

    for (const id of ids) {
      const p = await this.prisma.propuestaInstitucion.findUnique({
        where: { id },
        select: { campos: true, estado: true },
      });
      if (!p || p.estado !== 'PENDIENTE') {
        fallidas.push({ id, motivo: 'Esa propuesta ya se resolvió.' });
        continue;
      }
      try {
        const r = await this.aplicarPropuesta(
          id,
          { campos: Object.keys(this.aObjeto(p.campos)) },
          adminId,
        );
        aceptadas += 1;
        aplicados += r.aplicados;
      } catch (e) {
        fallidas.push({
          id,
          motivo: e instanceof Error ? e.message : 'No se pudo aplicar.',
        });
      }
    }

    return { aceptadas, aplicados, fallidas };
  }

  /// Guarda la memoria del rechazo. Centralizado aquí porque lo
  /// usan los dos caminos --una a una y el lote-- y tienen que
  /// recordar exactamente lo mismo.
  private async recordarDescartes(
    institucionId: string,
    campos: Record<string, unknown>,
    fuente: FuenteDato,
    adminId: string,
  ) {
    await recordarDescartes(
      this.prisma,
      filasDeDescarte(institucionId, campos, fuente, adminId),
    );
  }

  /**
   * ACEPTAR CAMPOS PUEDE APROBAR LA FICHA, PERO NO CON DATOS DEL
   * BUSCADOR.
   *
   * Aceptar es un acto humano igual que guardar, así que si con
   * ello la ficha queda completa se aprueba sola: de otro modo
   * había que reescribir un campo a mano solo para poder darle
   * a Guardar.
   *
   * Lo que se quitó es el caso WEB. La pantalla promete que lo
   * sugerido «no se reporta al SENA hasta que alguien lo
   * compruebe», y aceptar no es comprobar: es dejarlo entrar.
   * Con la regla vieja, un dato etiquetado «sugerido, sin
   * verificar» acababa en una institución VERIFICADA y por tanto
   * reportable --justo lo contrario de lo que dice el aviso--.
   * Ahora, si queda algún campo de fuente WEB, la verificación
   * la tiene que firmar una persona desde la ficha.
   */
  private async aprobarSiQuedoCompleta(institucionId: string, adminId: string) {
    const puesta = await this.prisma.institucion.findUnique({
      where: { id: institucionId },
    });
    if (!puesta) return;

    const estado = this.conFaltantes(puesta);
    if (estado.falta.length > 0) return;
    /// `sinConfirmar` son justo los campos cuya fuente es WEB.
    if (estado.sinConfirmar.length > 0) return;

    await this.prisma.institucion.update({
      where: { id: institucionId },
      data: { verificadaPorId: adminId, verificadaEn: new Date() },
    });
  }

  // ---------------------------------------------------------

  /// Qué le falta a la ficha para poder reportarse, y de
  /// dónde salió cada dato que sí tiene.
  /**
   * «1972-01-17» es un día, no un instante.
   *
   * `new Date('1972-01-17')` da la medianoche en UTC, que en
   * Colombia son las siete de la tarde del día ANTERIOR: la
   * ficha quedaría fundada el 16. Se arma a la medianoche de
   * acá, que es lo que quiso decir quien escribió la fecha.
   */
  private aFecha(v: string): Date {
    return /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T00:00:00-05:00`)
      : new Date(v);
  }

  /**
   * CUÁNTAS PERSONAS CUELGAN DE CADA ORGANIZACIÓN.
   *
   * «En esta parte colocar otra columna que diga leads asociados, así
   * se sabe si se puede o no» (cliente, 30 sep 2026), hablando de
   * quitar del listado una organización que quedó vacía. Tiene razón
   * en que es mejor que un candado: con el número a la vista uno sabe
   * ANTES de pulsar, en vez de que el sistema se niegue después.
   *
   * VA EN DOS SALTOS Y NO EN UN `_count`, porque la relación lo es:
   * las personas cuelgan de `Empresa` y `Empresa` de `Institucion`.
   * Prisma no cuenta a dos niveles, así que se agrupan las personas
   * por empresa y se suman por la institución de cada una.
   *
   * SOLO DE LAS QUE SE VAN A PINTAR. Es una consulta por página, no
   * por fila: con 175 organizaciones y 50 por página son dos
   * consultas, no cincuenta.
   */
  private async leadsPorInstitucion(
    filas: Array<{ id: string; nit: string }>,
  ): Promise<Map<string, number>> {
    const cuenta = new Map<string, number>();
    if (filas.length === 0) return cuenta;

    /// POR NIT Y NO POR `institucionId`, y esto lo cacé midiendo.
    ///
    /// Lo escribí primero por `institucionId`, que es el vínculo que
    /// el esquema declara entre `Empresa` e `Institucion`. Al mirarlo
    /// en la base: de 30 empresas, CERO lo tienen puesto. El vínculo
    /// existe en el modelo y no en los datos, así que la columna
    /// habría dicho «sin nadie» en todas las filas ---y esa columna la
    /// pidió el cliente para decidir si puede quitar una organización.
    /// Un cero falso ahí le haría borrar una con gente dentro.
    ///
    /// El NIT sí las une de verdad: es lo que identifica a una
    /// organización en los dos sitios, y es lo que viaja al SENA.
    const porNit = new Map(filas.map((f) => [f.nit, f.id]));

    const empresas = await this.prisma.empresa.findMany({
      where: { nit: { in: [...porNit.keys()] } },
      select: { nit: true, _count: { select: { participantes: true } } },
    });

    for (const e of empresas) {
      const id = porNit.get(e.nit);
      if (!id) continue;
      cuenta.set(id, (cuenta.get(id) ?? 0) + e._count.participantes);
    }
    return cuenta;
  }

  private conFaltantes<
    T extends Record<string, unknown> & {
      /// OPCIONAL: `resumen()` llama a esto con un select que no
      /// trae el id ---solo cuenta cuántas caen en cada filtro, no
      /// pinta filas--- y exigírselo le obligaría a traer una
      /// columna que no usa.
      id?: string;
      fuentePorCampo: Prisma.JsonValue | null;
    },
  >(f: T, leads?: Map<string, number>) {
    const falta = CAMPOS_OBLIGATORIOS.filter((c) => {
      const v = f[c];
      return v === null || v === undefined || v === '';
    });

    const fuentes = this.aObjeto(f.fuentePorCampo);

    /// Lo que trajo un buscador y nadie ha confirmado. Es lo
    /// que no puede salir hacia el SENA.
    const sinConfirmar = Object.entries(fuentes)
      .filter(([, fuente]) => fuente === 'WEB')
      .map(([campo]) => campo);

    return {
      ...f,
      falta,
      sinConfirmar,
      /// CERO ES CERO Y NO «NO SE SABE». Cuando no se pidió la cuenta
      /// ---hay sitios que llaman a esto sin ella--- va `null`, que
      /// la pantalla pinta distinto: una organización con 0 personas
      /// se puede quitar, una de la que no sabemos nada no.
      leads: leads && f.id ? (leads.get(f.id) ?? 0) : null,
      reportable: falta.length === 0 && Boolean(f.verificadaEn),
    };
  }

  /// El JSON de la base, como objeto plano. Prisma lo
  /// entrega como JsonValue, que puede ser un array o un
  /// escalar: nada de eso sirve como mapa campo -> fuente.
  /// Como se ve un valor en el control de cambios. Vacio se
  /// escribe con raya: «— → Bogota» se lee mejor que un hueco.
  private legible(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }

  private aObjeto(v: Prisma.JsonValue | null): Record<string, string> {
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, string>)
      : {};
  }
}
