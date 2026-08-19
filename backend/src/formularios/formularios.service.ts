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

  async listar() {
    const formularios = await this.prisma.formulario.findMany({
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
  async obtener(id: string) {
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

  async crear(dto: CrearFormularioDto) {
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
      return this.obtener(formulario.id);
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
  async duplicar(id: string, dto: DuplicarFormularioDto) {
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
        logos: { orderBy: { orden: 'asc' } },
      },
    });
    if (!origen) throw new NotFoundException('No existe ese formulario.');

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
        for (const l of origen.logos) {
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

      return this.obtener(copiaId);
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

  async actualizar(id: string, dto: ActualizarFormularioDto) {
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
    return this.obtener(id);
  }

  /** Se borra si nunca se usó; si no, se despublica. */
  async eliminar(id: string) {
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
  async actualizarApariencia(id: string, dto: ActualizarAparienciaDto) {
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
    return this.obtener(id);
  }

  // secciones

  async crearSeccion(formularioId: string, dto: SeccionDto) {
    const ultimo = await this.prisma.seccion.aggregate({
      where: { formularioId },
      _max: { orden: true },
    });
    await this.prisma.seccion.create({
      data: { formularioId, ...dto, orden: (ultimo._max.orden ?? -1) + 1 },
    });
    return this.obtener(formularioId);
  }

  async actualizarSeccion(id: string, dto: SeccionDto) {
    const seccion = await this.prisma.seccion.update({ where: { id }, data: dto });
    return this.obtener(seccion.formularioId);
  }

  /** Borrar la sección no borra sus preguntas. */
  async eliminarSeccion(id: string) {
    const seccion = await this.prisma.seccion.findUnique({ where: { id } });
    if (!seccion) throw new NotFoundException('No existe esa sección.');
    await this.prisma.seccion.delete({ where: { id } });
    return this.obtener(seccion.formularioId);
  }

  async reordenarSecciones(formularioId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.seccion.updateMany({ where: { id, formularioId }, data: { orden } }),
      ),
    );
    return this.obtener(formularioId);
  }

  // preguntas

  async crearPregunta(formularioId: string, dto: CrearPreguntaDto) {
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

    return this.obtener(formularioId);
  }

  async actualizarPregunta(id: string, dto: ActualizarPreguntaDto) {
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

    return this.obtener(pregunta.formularioId);
  }

  async reordenarPreguntas(formularioId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.pregunta.updateMany({ where: { id, formularioId }, data: { orden } }),
      ),
    );
    return this.obtener(formularioId);
  }

  // opciones

  async crearOpcion(preguntaId: string, dto: OpcionDto) {
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

    return this.obtener(pregunta.formularioId);
  }

  async actualizarOpcion(id: string, dto: ActualizarOpcionDto) {
    const opcion = await this.prisma.opcion.findUnique({
      where: { id },
      include: { pregunta: true },
    });
    if (!opcion) throw new NotFoundException('No existe esa opción.');

    await this.prisma.opcion.update({
      where: { id },
      data: { etiqueta: dto.etiqueta, archivada: dto.archivada },
    });
    return this.obtener(opcion.pregunta.formularioId);
  }

  /** Una opción ya elegida se archiva, no se borra. */
  async eliminarOpcion(id: string) {
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

    return this.obtener(opcion.pregunta.formularioId);
  }

  async reordenarOpciones(preguntaId: string, ids: string[]) {
    const pregunta = await this.prisma.pregunta.findUnique({ where: { id: preguntaId } });
    if (!pregunta) throw new NotFoundException('No existe esa pregunta.');

    await this.prisma.$transaction(
      ids.map((id, orden) =>
        this.prisma.opcion.updateMany({ where: { id, preguntaId }, data: { orden } }),
      ),
    );
    return this.obtener(pregunta.formularioId);
  }

  // envío: validar respuestas

  /** Valida las respuestas y las deja listas. */
  async prepararRespuestas(
    formularioSlug: string,
    enviadas: RespuestaDto[],
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
}
