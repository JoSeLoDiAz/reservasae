import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CampoNucleo,
  Prisma,
  TipoPregunta,
  type Opcion,
  type Pregunta,
} from '../../generated/prisma';
import { soloTokensValidos } from '../admin/apariencia';
import { PrismaService } from '../prisma/prisma.service';
import { esRutaReservada } from './rutas-reservadas';
import { CAMPOS_NUCLEO, CAMPOS_OBLIGATORIOS, POR_CAMPO } from './campos-nucleo';
import {
  ActualizarAparienciaDto,
  ActualizarFormularioDto,
  ActualizarOpcionDto,
  ActualizarPreguntaDto,
  CrearFormularioDto,
  CrearPreguntaDto,
  DuplicarFormularioDto,
  OpcionDto,
  RespuestaDto,
  SeccionDto,
} from './dto';

const TIPOS_CON_OPCIONES: TipoPregunta[] = [
  TipoPregunta.SELECCION_UNICA,
  TipoPregunta.SELECCION_MULTIPLE,
];

const TIPOS_DE_TEXTO: TipoPregunta[] = [
  TipoPregunta.TEXTO_CORTO,
  TipoPregunta.TEXTO_LARGO,
  TipoPregunta.CORREO,
  TipoPregunta.TELEFONO,
];

/** Preguntas que solo muestran texto. */
const TIPOS_SIN_RESPUESTA: TipoPregunta[] = [TipoPregunta.PARRAFO];

type PreguntaConOpciones = Pregunta & { opciones: Opcion[] };

@Injectable()
export class FormulariosService {
  constructor(private readonly prisma: PrismaService) {}

  // lectura

  /** Catálogo de campos del núcleo. */
  camposNucleo() {
    return CAMPOS_NUCLEO;
  }

  async listar(ambito: string[]) {
    const formularios = await this.prisma.formulario.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { orden: 'asc' } }, { titulo: 'asc' }],
      include: {
        convenio: { select: { slug: true, sigla: true } },
        _count: { select: { preguntas: true, secciones: true } },
      },
    });

    return formularios.map((f) => ({
      id: f.id,
      slug: f.slug,
      titulo: f.titulo,
      descripcion: f.descripcion,
      publicado: f.publicado,
      convenio: f.convenio.slug,
      convenioSigla: f.convenio.sigla,
      preguntas: f._count.preguntas,
      secciones: f._count.secciones,
      actualizadoEn: f.actualizadoEn,
    }));
  }

  /** Vista completa para el constructor. */
  /** Vista completa, comprobando el ambito. */
  async obtener(ambito: string[], id: string) {
    const suyo = await this.prisma.formulario.findFirst({
      where: { id, convenioId: { in: ambito } },
      select: { id: true },
    });
    // fuera del ambito no existe: decirlo seria un oraculo
    if (!suyo) throw new NotFoundException('No existe ese formulario.');
    return this.vista(id);
  }

  /// Fuera del ambito, la fila NO existe.
  ///
  /// Cinco puertas porque cada tabla llega al convenio por un
  /// camino distinto, igual que en `tableros/ambito.ts`. Se
  /// llaman ANTES de tocar nada: la leccion de la ronda
  /// anterior fue que cerrar la lectura y dejar la escritura
  /// abierta es peor que no cerrar nada.
  private noExiste(): never {
    throw new NotFoundException('No existe ese formulario.');
  }

  private async exigirFormulario(ambito: string[], id: string) {
    const suyo = await this.prisma.formulario.findFirst({
      where: { id, convenioId: { in: ambito } },
      select: { id: true },
    });
    if (!suyo) this.noExiste();
  }

  private async exigirSeccion(ambito: string[], id: string) {
    const suya = await this.prisma.seccion.findFirst({
      where: { id, formulario: { convenioId: { in: ambito } } },
      select: { id: true },
    });
    if (!suya) this.noExiste();
  }

  private async exigirPregunta(ambito: string[], id: string) {
    const suya = await this.prisma.pregunta.findFirst({
      where: { id, formulario: { convenioId: { in: ambito } } },
      select: { id: true },
    });
    if (!suya) this.noExiste();
  }

  private async exigirOpcion(ambito: string[], id: string) {
    const suya = await this.prisma.opcion.findFirst({
      where: { id, pregunta: { formulario: { convenioId: { in: ambito } } } },
      select: { id: true },
    });
    if (!suya) this.noExiste();
  }

  private async exigirAccion(ambito: string[], id: string) {
    const suya = await this.prisma.accionFormacion.findFirst({
      where: { id, convenioId: { in: ambito } },
      select: { id: true },
    });
    if (!suya) throw new NotFoundException('No existe esa acción de formación.');
  }

  /**
   * Una seccion y una pregunta madre TIENEN que ser del mismo
   * formulario que la pregunta que las apunta.
   *
   * Los cinco guardias de arriba comprueban el id que viene en
   * la RUTA. Estos dos vienen en el CUERPO y no los comprobaba
   * nadie: se podia colgar una pregunta de una seccion del otro
   * gremio, o hacerla depender de una pregunta suya.
   *
   * Lo segundo es lo peor. La condicional se evalua contra la
   * respuesta de su madre, y una madre de otro formulario nunca
   * tiene respuesta aqui: la pregunta queda oculta para
   * siempre, su respuesta se descarta en el servidor -- que es
   * lo correcto para una pregunta oculta -- y el formulario
   * publicado pierde un campo sin que nada falle a la vista.
   * Un formulario con el campo del NIT oculto no puede crear
   * una reserva.
   *
   * Y de paso son un oraculo: un 200 contra un 404 dice si ese
   * id existe en el otro gremio.
   */
  private async exigirReferenciasDelFormulario(
    formularioId: string,
    dto: { seccionId?: string | null; dependeDePreguntaId?: string | null },
  ) {
    if (dto.seccionId) {
      const suya = await this.prisma.seccion.findFirst({
        where: { id: dto.seccionId, formularioId },
        select: { id: true },
      });
      if (!suya) {
        throw new BadRequestException('Esa sección no es de este formulario.');
      }
    }

    if (dto.dependeDePreguntaId) {
      const madre = await this.prisma.pregunta.findFirst({
        where: { id: dto.dependeDePreguntaId, formularioId },
        select: { id: true },
      });
      if (!madre) {
        throw new BadRequestException(
          'Esa pregunta no es de este formulario: no puede depender de ella.',
        );
      }
    }
  }

  /// Sin comprobar nada: la usan los que ya comprobaron.
  private async vista(id: string) {
    const formulario = await this.prisma.formulario.findUnique({
      where: { id },
      include: {
        convenio: { select: { id: true, slug: true, sigla: true } },
        secciones: { orderBy: { orden: 'asc' } },
        preguntas: {
          orderBy: { orden: 'asc' },
          include: { opciones: { orderBy: { orden: 'asc' } }, _count: { select: { respuestas: true } } },
        },
      },
    });
    if (!formulario) throw new NotFoundException('No existe ese formulario.');

    return {
      ...formulario,
      // qué falta para publicar
      problemas: this.problemasParaPublicar(formulario.preguntas),
    };
  }

  /** Lo público: sin archivadas ni datos internos. */
  async obtenerPublico(slug: string) {
    const formulario = await this.prisma.formulario.findUnique({
      where: { slug },
      include: {
        convenio: { select: { slug: true, sigla: true, nombre: true } },
        secciones: { orderBy: { orden: 'asc' } },
        preguntas: {
          where: { archivada: false },
          orderBy: { orden: 'asc' },
          include: { opciones: { where: { archivada: false }, orderBy: { orden: 'asc' } } },
        },
      },
    });

    if (!formulario || !formulario.publicado) {
      throw new NotFoundException('No hay un formulario publicado con ese identificador.');
    }

    return {
      slug: formulario.slug,
      titulo: formulario.titulo,
      descripcion: formulario.descripcion,
      mensajeExito: formulario.mensajeExito,
      convenio: formulario.convenio,
      secciones: formulario.secciones.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        descripcion: s.descripcion,
        preguntas: formulario.preguntas
          .filter((p) => p.seccionId === s.id)
          .map((p) => this.vistaPreguntaPublica(p)),
      })),
      // preguntas sin sección, al final
      sueltas: formulario.preguntas
        .filter((p) => !p.seccionId)
        .map((p) => this.vistaPreguntaPublica(p)),
    };
  }

  private vistaPreguntaPublica(pregunta: PreguntaConOpciones) {
    const definicion = pregunta.campoNucleo ? POR_CAMPO.get(pregunta.campoNucleo) : undefined;
    return {
      id: pregunta.id,
      etiqueta: pregunta.etiqueta,
      ayuda: pregunta.ayuda,
      marcador: pregunta.marcador,
      tipo: pregunta.tipo,
      obligatoria: pregunta.obligatoria,
      campoNucleo: pregunta.campoNucleo,
      controlEspecial: definicion?.controlEspecial ?? null,
      minimo: pregunta.minimo,
      maximo: pregunta.maximo,
      largoMinimo: pregunta.largoMinimo,
      largoMaximo: pregunta.largoMaximo,
      dependeDePreguntaId: pregunta.dependeDePreguntaId,
      dependeDeValor: pregunta.dependeDeValor,
      opciones: pregunta.opciones.map((o) => ({
        id: o.id,
        etiqueta: o.etiqueta,
        valor: o.valor,
      })),
    };
  }

  // formulario

  async crear(ambito: string[], dto: CrearFormularioDto) {
    // crear en el convenio ajeno es publicar en su nombre
    if (!ambito.includes(dto.convenioId)) {
      throw new NotFoundException('Ese convenio no existe.');
    }
    if (esRutaReservada(dto.slug)) {
      throw new BadRequestException(
        `"${dto.slug}" es una ruta del sitio y no puede ser el identificador ` +
          'de un formulario: su página pública quedaría inaccesible.',
      );
    }
    try {
      const formulario = await this.prisma.formulario.create({
        data: {
          convenioId: dto.convenioId,
          slug: dto.slug,
          titulo: dto.titulo,
          // nace en borrador
          publicado: false,
          secciones: {
            create: [{ titulo: 'Datos de la organización', orden: 0 }],
          },
        },
      });
      return this.vista(formulario.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Ya existe un formulario con ese identificador.');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('El convenio indicado no existe.');
        }
      }
      throw error;
    }
  }

  /** Copia un formulario en blanco, sin respuestas. */
  async duplicar(ambito: string[], id: string, dto: DuplicarFormularioDto) {
    await this.exigirFormulario(ambito, id);
    if (esRutaReservada(dto.slug)) {
      throw new BadRequestException(
        `"${dto.slug}" es una ruta del sitio y no puede ser el identificador ` +
          'de un formulario: su página pública quedaría inaccesible.',
      );
    }

    const origen = await this.prisma.formulario.findUnique({
      where: { id },
      include: {
        secciones: { orderBy: { orden: 'asc' } },
        // lo archivado no se arrastra a una copia nueva
        preguntas: {
          where: { archivada: false },
          orderBy: { orden: 'asc' },
          include: { opciones: { where: { archivada: false }, orderBy: { orden: 'asc' } } },
        },
      },
    });
    if (!origen) throw new NotFoundException('No existe ese formulario.');

    // aparte y con select: el omit global quita los bytes
    const logos = await this.prisma.logo.findMany({
      where: { formularioId: id },
      orderBy: { orden: 'asc' },
      select: { orden: true, etiqueta: true, datos: true, tipoMime: true, nombre: true },
    });

    try {
      const copiaId = await this.prisma.$transaction(async (tx) => {
        const copia = await tx.formulario.create({
          data: {
            convenioId: origen.convenioId,
            slug: dto.slug,
            titulo: dto.titulo,
            descripcion: origen.descripcion,
            mensajeExito: origen.mensajeExito,
            coloresClaro: origen.coloresClaro ?? Prisma.DbNull,
            coloresOscuro: origen.coloresOscuro ?? Prisma.DbNull,
            // se revisa antes de abrirlo al público
            publicado: false,
          },
        });

        const seccionNueva = new Map<string, string>();
        for (const s of origen.secciones) {
          const creada = await tx.seccion.create({
            data: {
              formularioId: copia.id,
              titulo: s.titulo,
              descripcion: s.descripcion,
              orden: s.orden,
            },
          });
          seccionNueva.set(s.id, creada.id);
        }

        // sin la condición: aún no existe su madre
        const preguntaNueva = new Map<string, string>();
        for (const q of origen.preguntas) {
          const creada = await tx.pregunta.create({
            data: {
              formularioId: copia.id,
              seccionId: q.seccionId ? (seccionNueva.get(q.seccionId) ?? null) : null,
              etiqueta: q.etiqueta,
              ayuda: q.ayuda,
              marcador: q.marcador,
              tipo: q.tipo,
              obligatoria: q.obligatoria,
              orden: q.orden,
              campoNucleo: q.campoNucleo,
              minimo: q.minimo,
              maximo: q.maximo,
              largoMinimo: q.largoMinimo,
              largoMaximo: q.largoMaximo,
              dependeDeValor: q.dependeDeValor,
            },
          });
          preguntaNueva.set(q.id, creada.id);

          if (q.opciones.length) {
            await tx.opcion.createMany({
              data: q.opciones.map((o) => ({
                preguntaId: creada.id,
                etiqueta: o.etiqueta,
                valor: o.valor,
                orden: o.orden,
              })),
            });
          }
        }

        // ahora sí: los ids ya existen. Sin remapear,
        // la copia apuntaría al formulario original
        for (const q of origen.preguntas) {
          if (!q.dependeDePreguntaId) continue;
          const madre = preguntaNueva.get(q.dependeDePreguntaId);
          if (!madre) continue;
          await tx.pregunta.update({
            where: { id: preguntaNueva.get(q.id)! },
            data: { dependeDePreguntaId: madre },
          });
        }

        // o los propios o los generales, nunca mezclados
        for (const l of logos) {
          await tx.logo.create({
            data: {
              formularioId: copia.id,
              orden: l.orden,
              etiqueta: l.etiqueta,
              datos: l.datos,
              tipoMime: l.tipoMime,
              nombre: l.nombre,
            },
          });
        }

        return copia.id;
      });

      return this.vista(copiaId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un formulario con ese identificador.');
      }
      throw error;
    }
  }

  async actualizar(ambito: string[], id: string, dto: ActualizarFormularioDto) {
    await this.exigirFormulario(ambito, id);
    const formulario = await this.prisma.formulario.findUnique({
      where: { id },
      include: { preguntas: { include: { opciones: true } } },
    });
    if (!formulario) throw new NotFoundException('No existe ese formulario.');

    if (dto.publicado === true) {
      const problemas = this.problemasParaPublicar(formulario.preguntas);
      if (problemas.length) {
        throw new BadRequestException({
          message: 'El formulario todavía no se puede publicar.',
          problemas,
        });
      }
    }

    await this.prisma.formulario.update({ where: { id }, data: dto });
    return this.vista(id);
  }

  /** Se borra si nunca se usó; si no, se despublica. */
  async eliminar(ambito: string[], id: string) {
    await this.exigirFormulario(ambito, id);
    const respuestas = await this.prisma.respuesta.count({
      where: { pregunta: { formularioId: id } },
    });
    if (respuestas > 0) {
      throw new ConflictException(
        `Este formulario tiene ${respuestas} respuestas registradas. ` +
          'Despublíquelo en vez de borrarlo, o se perderá el histórico.',
      );
    }
    await this.prisma.formulario.delete({ where: { id } });
    return { eliminado: true };
  }

  /** Qué falta para poder publicar, como lista. */
  private problemasParaPublicar(
    preguntas: Array<Pregunta & { opciones?: Opcion[] }>,
  ): string[] {
    const problemas: string[] = [];
    const activas = preguntas.filter((p) => !p.archivada);

    for (const campo of CAMPOS_OBLIGATORIOS) {
      if (!activas.some((p) => p.campoNucleo === campo)) {
        const definicion = POR_CAMPO.get(campo);
        problemas.push(
          `Falta el campo obligatorio "${definicion?.etiquetaSugerida ?? campo}": ` +
            `${definicion?.descripcion ?? ''}`.trim(),
        );
      }
    }

    for (const pregunta of activas) {
      // un desplegable necesita opciones
      const necesitaOpciones =
        TIPOS_CON_OPCIONES.includes(pregunta.tipo) &&
        POR_CAMPO.get(pregunta.campoNucleo as CampoNucleo)?.controlEspecial === undefined;

      if (necesitaOpciones) {
        const vivas = (pregunta.opciones ?? []).filter((o) => !o.archivada);
        if (vivas.length === 0) {
          problemas.push(`La pregunta "${pregunta.etiqueta}" no tiene ninguna opción.`);
        }
      }

      if (pregunta.dependeDePreguntaId) {
        const madre = activas.find((p) => p.id === pregunta.dependeDePreguntaId);
        if (!madre) {
          problemas.push(
            `"${pregunta.etiqueta}" depende de una pregunta que ya no está activa.`,
          );
        }
      }
    }

    return problemas;
  }

  // apariencia

  /** Guarda SOLO los colores que sobreescribe. */
  async actualizarApariencia(ambito: string[], id: string, dto: ActualizarAparienciaDto) {
    await this.exigirFormulario(ambito, id);
    const formulario = await this.prisma.formulario.findUnique({ where: { id } });
    if (!formulario) throw new NotFoundException('No existe ese formulario.');

    await this.prisma.formulario.update({
      where: { id },
      data: {
        coloresClaro:
          dto.coloresClaro === undefined
            ? undefined
            : (soloTokensValidos(dto.coloresClaro) as Prisma.InputJsonValue),
        coloresOscuro:
          dto.coloresOscuro === undefined
            ? undefined
            : (soloTokensValidos(dto.coloresOscuro) as Prisma.InputJsonValue),
      },
    });
    return this.vista(id);
  }

  // secciones

  async crearSeccion(ambito: string[], formularioId: string, dto: SeccionDto) {
    await this.exigirFormulario(ambito, formularioId);
    const ultimo = await this.prisma.seccion.aggregate({
      where: { formularioId },
      _max: { orden: true },
    });
    await this.prisma.seccion.create({
      data: { formularioId, ...dto, orden: (ultimo._max.orden ?? -1) + 1 },
    });
    return this.vista(formularioId);
  }

  async actualizarSeccion(ambito: string[], id: string, dto: SeccionDto) {
    await this.exigirSeccion(ambito, id);
    const seccion = await this.prisma.seccion.update({ where: { id }, data: dto });
    return this.vista(seccion.formularioId);
  }

  /** Borrar la sección no borra sus preguntas. */
  async eliminarSeccion(ambito: string[], id: string) {
    await this.exigirSeccion(ambito, id);
    const seccion = await this.prisma.seccion.findUnique({ where: { id } });
    if (!seccion) throw new NotFoundException('No existe esa sección.');
    await this.prisma.seccion.delete({ where: { id } });
    return this.vista(seccion.formularioId);
  }

  async reordenarSecciones(ambito: string[], formularioId: string, ids: string[]) {
    await this.exigirFormulario(ambito, formularioId);
    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.seccion.updateMany({ where: { id, formularioId }, data: { orden } }),
      ),
    );
    return this.vista(formularioId);
  }

  // preguntas

  async crearPregunta(ambito: string[], formularioId: string, dto: CrearPreguntaDto) {
    await this.exigirFormulario(ambito, formularioId);
    await this.exigirReferenciasDelFormulario(formularioId, dto);
    const definicion = dto.campoNucleo ? POR_CAMPO.get(dto.campoNucleo) : undefined;

    // el catálogo manda el tipo
    const tipo = definicion?.tipo ?? dto.tipo;

    const ultimo = await this.prisma.pregunta.aggregate({
      where: { formularioId },
      _max: { orden: true },
    });

    try {
      await this.prisma.pregunta.create({
        data: {
          formularioId,
          seccionId: dto.seccionId ?? null,
          etiqueta: dto.etiqueta,
          tipo,
          campoNucleo: dto.campoNucleo ?? null,
          obligatoria: definicion?.obligatorioParaPublicar ?? false,
          orden: (ultimo._max.orden ?? -1) + 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Ese campo del sistema ya está en el formulario. Solo puede pedirse una vez.',
        );
      }
      throw error;
    }

    return this.vista(formularioId);
  }

  async actualizarPregunta(ambito: string[], id: string, dto: ActualizarPreguntaDto) {
    await this.exigirPregunta(ambito, id);
    const pregunta = await this.prisma.pregunta.findUnique({
      where: { id },
      include: { _count: { select: { respuestas: true } } },
    });
    if (!pregunta) throw new NotFoundException('No existe esa pregunta.');

    const esNucleo = pregunta.campoNucleo !== null;

    const definicion = esNucleo ? POR_CAMPO.get(pregunta.campoNucleo!) : undefined;

    if (esNucleo) {
      // solo los imprescindibles
      if (dto.archivada === true && definicion?.obligatorioParaPublicar) {
        throw new BadRequestException(
          'Este campo lo necesita el sistema para crear la reserva; no se puede archivar.',
        );
      }
      if (dto.tipo && dto.tipo !== pregunta.tipo) {
        throw new BadRequestException(
          'No se puede cambiar el tipo de un campo del sistema: dejaría de encajar ' +
            'con el dato al que va.',
        );
      }
      if (dto.obligatoria === false && definicion?.obligatorioParaPublicar) {
        throw new BadRequestException('Este campo del sistema no puede ser opcional.');
      }
    }

    // con respuestas no se cambia el tipo
    if (dto.tipo && dto.tipo !== pregunta.tipo && pregunta._count.respuestas > 0) {
      throw new ConflictException(
        `Esta pregunta ya tiene ${pregunta._count.respuestas} respuestas. ` +
          'Archívela y cree una nueva en vez de cambiarle el tipo.',
      );
    }

    if (dto.dependeDePreguntaId === id) {
      throw new BadRequestException('Una pregunta no puede depender de sí misma.');
    }

    await this.exigirReferenciasDelFormulario(pregunta.formularioId, dto);

    await this.prisma.pregunta.update({
      where: { id },
      data: {
        etiqueta: dto.etiqueta,
        ayuda: dto.ayuda,
        marcador: dto.marcador,
        tipo: dto.tipo,
        obligatoria: dto.obligatoria,
        seccionId: dto.seccionId === undefined ? undefined : dto.seccionId || null,
        minimo: dto.minimo,
        maximo: dto.maximo,
        largoMinimo: dto.largoMinimo,
        largoMaximo: dto.largoMaximo,
        dependeDePreguntaId:
          dto.dependeDePreguntaId === undefined ? undefined : dto.dependeDePreguntaId || null,
        dependeDeValor:
          dto.dependeDeValor === undefined ? undefined : dto.dependeDeValor || null,
        archivada: dto.archivada,
      },
    });

    return this.vista(pregunta.formularioId);
  }

  async reordenarPreguntas(ambito: string[], formularioId: string, ids: string[]) {
    await this.exigirFormulario(ambito, formularioId);
    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.pregunta.updateMany({ where: { id, formularioId }, data: { orden } }),
      ),
    );
    return this.vista(formularioId);
  }

  // opciones

  async crearOpcion(ambito: string[], preguntaId: string, dto: OpcionDto) {
    await this.exigirPregunta(ambito, preguntaId);
    const pregunta = await this.prisma.pregunta.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new NotFoundException('No existe esa pregunta.');

    if (!TIPOS_CON_OPCIONES.includes(pregunta.tipo)) {
      throw new BadRequestException('Este tipo de pregunta no lleva opciones.');
    }

    const ultimo = await this.prisma.opcion.aggregate({
      where: { preguntaId },
      _max: { orden: true },
    });

    try {
      await this.prisma.opcion.create({
        data: {
          preguntaId,
          etiqueta: dto.etiqueta,
          // sin valor, se usa la etiqueta
          valor: dto.valor?.trim() || dto.etiqueta,
          orden: (ultimo._max.orden ?? -1) + 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya hay una opción con ese valor en esta pregunta.');
      }
      throw error;
    }

    return this.vista(pregunta.formularioId);
  }

  async actualizarOpcion(ambito: string[], id: string, dto: ActualizarOpcionDto) {
    await this.exigirOpcion(ambito, id);
    const opcion = await this.prisma.opcion.findUnique({
      where: { id },
      include: { pregunta: true },
    });
    if (!opcion) throw new NotFoundException('No existe esa opción.');

    await this.prisma.opcion.update({
      where: { id },
      data: { etiqueta: dto.etiqueta, archivada: dto.archivada },
    });
    return this.vista(opcion.pregunta.formularioId);
  }

  /** Una opción ya elegida se archiva, no se borra. */
  async eliminarOpcion(ambito: string[], id: string) {
    await this.exigirOpcion(ambito, id);
    const opcion = await this.prisma.opcion.findUnique({
      where: { id },
      include: { pregunta: true },
    });
    if (!opcion) throw new NotFoundException('No existe esa opción.');

    const usada = await this.prisma.respuesta.count({
      where: { preguntaId: opcion.preguntaId, valoresSeleccion: { has: opcion.valor } },
    });

    if (usada > 0) {
      await this.prisma.opcion.update({ where: { id }, data: { archivada: true } });
    } else {
      await this.prisma.opcion.delete({ where: { id } });
    }

    return this.vista(opcion.pregunta.formularioId);
  }

  async reordenarOpciones(ambito: string[], preguntaId: string, ids: string[]) {
    await this.exigirPregunta(ambito, preguntaId);
    const pregunta = await this.prisma.pregunta.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new NotFoundException('No existe esa pregunta.');

    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.opcion.updateMany({ where: { id, preguntaId }, data: { orden } }),
      ),
    );
    return this.vista(pregunta.formularioId);
  }

  // envío: validar respuestas

  /**
   * Valida las respuestas y las deja listas.
   *
   * `convenioId` es el de la OFERTA, y no es opcional: el
   * formulario por el que se reserva tiene que ser del mismo
   * convenio. Antes solo se comprobaba que estuviera publicado,
   * asi que un POST publico con la oferta de un gremio y el
   * `formularioSlug` del otro dejaba una reserva cuyos cupos
   * salian de uno y cuyo `formularioId` apuntaba al otro.
   *
   * Lo que rompia no era la contabilidad de cupos -- esa va por
   * la oferta y es atomica -- sino tres cosas peores: las
   * respuestas se validaban contra las preguntas de un
   * formulario que la persona nunca vio, la reserva quedaba
   * invisible para los dos gremios (para uno la oferta es
   * ajena, para el otro el formulario) y la tasa de respuesta
   * de ambos formularios salia falseada.
   *
   * Varios formularios del MISMO convenio contra la misma
   * oferta siguen valiendo: es el caso del evento de Medellin.
   */
  async prepararRespuestas(
    formularioSlug: string,
    enviadas: RespuestaDto[],
    convenioId: string,
  ): Promise<{
    formularioId: string;
    respuestas: Prisma.RespuestaCreateWithoutReservaInput[];
  }> {
    const formulario = await this.prisma.formulario.findUnique({
      where: { slug: formularioSlug },
      include: {
        preguntas: {
          where: { archivada: false },
          include: { opciones: { where: { archivada: false } } },
        },
      },
    });
    if (!formulario || !formulario.publicado) {
      throw new BadRequestException('El formulario indicado no está publicado.');
    }
    /// Mismo mensaje que «no publicado», y a proposito: decir
    /// «ese formulario es del otro convenio» seria confirmar
    /// que existe, y esta ruta es publica.
    if (formulario.convenioId !== convenioId) {
      throw new BadRequestException('El formulario indicado no está publicado.');
    }

    const porId = new Map(enviadas.map((r) => [r.preguntaId, r]));
    const preparadas: Prisma.RespuestaCreateWithoutReservaInput[] = [];

    for (const pregunta of formulario.preguntas) {
      // el núcleo lo valida el DTO
      if (pregunta.campoNucleo || TIPOS_SIN_RESPUESTA.includes(pregunta.tipo)) continue;

      const visible = this.estaVisible(pregunta, formulario.preguntas, porId);
      const enviada = porId.get(pregunta.id);

      if (!visible) {
        // oculta: se descarta
        continue;
      }

      const vacia = this.estaVacia(pregunta, enviada);
      if (vacia) {
        if (pregunta.obligatoria) {
          throw new BadRequestException(`Falta responder "${pregunta.etiqueta}".`);
        }
        continue;
      }

      preparadas.push(this.validarRespuesta(pregunta, enviada!));
    }

    return { formularioId: formulario.id, respuestas: preparadas };
  }

  private estaVisible(
    pregunta: Pregunta,
    todas: Pregunta[],
    respuestas: Map<string, RespuestaDto>,
  ): boolean {
    if (!pregunta.dependeDePreguntaId) return true;

    const madre = todas.find((p) => p.id === pregunta.dependeDePreguntaId);
    if (!madre) return true;

    const respuestaMadre = respuestas.get(madre.id);
    if (!respuestaMadre) return false;

    const valores = respuestaMadre.seleccion ?? [];
    if (respuestaMadre.texto) valores.push(respuestaMadre.texto);
    return valores.includes(pregunta.dependeDeValor ?? '');
  }

  private estaVacia(pregunta: Pregunta, enviada?: RespuestaDto): boolean {
    if (!enviada) return true;
    if (pregunta.tipo === TipoPregunta.CASILLA) return enviada.booleano !== true;
    if (TIPOS_CON_OPCIONES.includes(pregunta.tipo)) return !enviada.seleccion?.length;
    if (pregunta.tipo === TipoPregunta.NUMERO) {
      return enviada.numero === undefined || enviada.numero === null;
    }
    return !enviada.texto?.trim();
  }

  private validarRespuesta(
    pregunta: PreguntaConOpciones,
    enviada: RespuestaDto,
  ): Prisma.RespuestaCreateWithoutReservaInput {
    const base = {
      // congelar la etiqueta leída
      etiquetaPregunta: pregunta.etiqueta,
      pregunta: { connect: { id: pregunta.id } },
    };

    if (pregunta.tipo === TipoPregunta.CASILLA) {
      return { ...base, valorBooleano: enviada.booleano === true };
    }

    if (TIPOS_CON_OPCIONES.includes(pregunta.tipo)) {
      const validas = new Map(pregunta.opciones.map((o) => [o.valor, o.etiqueta]));
      const elegidas = enviada.seleccion ?? [];

      if (pregunta.tipo === TipoPregunta.SELECCION_UNICA && elegidas.length > 1) {
        throw new BadRequestException(`"${pregunta.etiqueta}" admite una sola respuesta.`);
      }
      for (const valor of elegidas) {
        if (!validas.has(valor)) {
          throw new BadRequestException(
            `"${valor}" no es una opción válida de "${pregunta.etiqueta}".`,
          );
        }
      }
      return {
        ...base,
        valoresSeleccion: elegidas,
        etiquetasSeleccion: elegidas.map((v) => validas.get(v)!),
      };
    }

    if (pregunta.tipo === TipoPregunta.NUMERO) {
      const numero = enviada.numero!;
      if (pregunta.minimo !== null && numero < pregunta.minimo) {
        throw new BadRequestException(
          `"${pregunta.etiqueta}" no puede ser menor que ${pregunta.minimo}.`,
        );
      }
      if (pregunta.maximo !== null && numero > pregunta.maximo) {
        throw new BadRequestException(
          `"${pregunta.etiqueta}" no puede ser mayor que ${pregunta.maximo}.`,
        );
      }
      return { ...base, valorNumero: numero };
    }

    const texto = enviada.texto!.trim();

    if (pregunta.largoMinimo !== null && texto.length < pregunta.largoMinimo) {
      throw new BadRequestException(
        `"${pregunta.etiqueta}" debe tener al menos ${pregunta.largoMinimo} caracteres.`,
      );
    }
    if (pregunta.largoMaximo !== null && texto.length > pregunta.largoMaximo) {
      throw new BadRequestException(
        `"${pregunta.etiqueta}" no puede pasar de ${pregunta.largoMaximo} caracteres.`,
      );
    }
    if (pregunta.tipo === TipoPregunta.CORREO && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto)) {
      throw new BadRequestException(`"${pregunta.etiqueta}" debe ser un correo válido.`);
    }
    if (pregunta.tipo === TipoPregunta.FECHA && Number.isNaN(Date.parse(texto))) {
      throw new BadRequestException(`"${pregunta.etiqueta}" debe ser una fecha válida.`);
    }

    return { ...base, valorTexto: texto };
  }

  /**
   * Los textos que ve quien elige un curso en el formulario.
   *
   * Viven en la accion de formacion, no en el formulario:
   * el mismo curso se ofrece en varios formularios y el
   * texto es el mismo. Se editan desde aqui porque es donde
   * quien arma el formulario los va a buscar.
   */
  async resumenesPublicos(ambito: string[]) {
    const acciones = await this.prisma.accionFormacion.findMany({
      where: { convenioId: { in: ambito } },
      orderBy: [{ convenio: { slug: 'asc' } }, { codigo: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        horas: true,
        modalidad: true,
        visible: true,
        resumenPublico: true,
        convenio: { select: { id: true, sigla: true, nombre: true } },
      },
    });

    return {
      acciones,
      sinResumen: acciones.filter((a) => !a.resumenPublico?.trim()).length,
    };
  }

  /** Cambia el texto de una acción. Vacío lo borra. */
  async guardarResumenPublico(ambito: string[], accionId: string, texto: string | null) {
    await this.exigirAccion(ambito, accionId);
    const existe = await this.prisma.accionFormacion.count({ where: { id: accionId } });
    if (!existe) throw new NotFoundException('Esa acción de formación no existe.');

    const limpio = texto?.trim() ?? '';
    return this.prisma.accionFormacion.update({
      where: { id: accionId },
      data: { resumenPublico: limpio === '' ? null : limpio },
      select: { id: true, codigo: true, resumenPublico: true },
    });
  }
}
