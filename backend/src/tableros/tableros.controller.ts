import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

import { EstadoReserva, RolAdmin } from '../../generated/prisma';
import { AdminGuard, Roles } from '../admin/admin.guard';
import { construirLibro, nombreArchivo } from './exportar';
import { TablerosService, valorLegible, type FiltrosReservas } from './tableros.service';

const ESTADOS = Object.values(EstadoReserva) as string[];

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
  HIBRIDA: 'Híbrido',
};

const ESTADO_RESERVA: Record<string, string> = {
  CONFIRMADA: 'Confirmada',
  LISTA_ESPERA: 'En lista de espera',
  CANCELADA: 'Cancelada',
};

const SEMAFORO: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  ULTIMOS_CUPOS: 'Últimos cupos',
  COMPLETO: 'Completo',
};

@Controller('admin/tableros')
@UseGuards(AdminGuard)
export class TablerosController {
  constructor(private readonly tableros: TablerosService) {}

  @Get('resumen')
  resumen() {
    return this.tableros.resumen();
  }

  @Get('analisis')
  analisis() {
    return this.tableros.analisis();
  }

  @Get('acciones')
  porAccion() {
    return this.tableros.porAccion();
  }

  // después de 'acciones', o ':id' la captura
  @Get('acciones/:id')
  accion(@Param('id') id: string) {
    return this.tableros.accion(id);
  }

  @Get('ubicaciones')
  porUbicacion(@Query('convenio') convenio?: string) {
    return this.tableros.porUbicacion(convenio);
  }

  @Get('proyeccion')
  proyeccion(@Query('dias') dias?: string) {
    // ventana entre 7 y 90 días
    const n = Number(dias);
    const ventana = Number.isFinite(n) ? Math.min(90, Math.max(7, Math.trunc(n))) : 14;
    return this.tableros.proyeccion(ventana);
  }

  @Get('respuestas/:formularioId')
  respuestas(@Param('formularioId') formularioId: string) {
    return this.tableros.respuestasDeFormulario(formularioId);
  }

  @Get('empresas')
  porEmpresa(@Query('buscar') buscar?: string) {
    return this.tableros.porEmpresa(buscar);
  }

  @Get('serie')
  serie(@Query('dias') dias?: string) {
    const n = Number(dias);
    return this.tableros.serie(Number.isFinite(n) && n > 0 && n <= 365 ? n : 30);
  }

  @Get('reservas')
  reservas(@Query() consulta: Record<string, string>) {
    return this.tableros.reservas(this.filtros(consulta));
  }

  // descargas

  // lleva nombre, correo y celular de cada contacto
  @Get('exportar/reservas')
  @Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
  async exportarReservas(@Query() consulta: Record<string, string>, @Res() res: Response) {
    const reservas = await this.tableros.reservasParaExportar(this.filtros(consulta));

    // columnas de las preguntas propias
    const columnasExtra = [
      ...new Set(reservas.flatMap((r) => r.respuestas.map((x) => x.etiquetaPregunta))),
    ];

    const libro = await construirLibro([
      {
        nombre: 'Reservas',
        columnas: [
          { titulo: 'Fecha', clave: 'fecha', ancho: 18 },
          { titulo: 'Estado', clave: 'estado', ancho: 18 },
          { titulo: 'Convenio', clave: 'convenio', ancho: 16 },
          { titulo: 'Código', clave: 'codigo', ancho: 8 },
          { titulo: 'Acción de formación', clave: 'accion', ancho: 50 },
          { titulo: 'Ubicación', clave: 'ubicacion', ancho: 20 },
          { titulo: 'Modalidad', clave: 'modalidad', ancho: 12 },
          { titulo: 'NIT', clave: 'nit', ancho: 14 },
          { titulo: 'DV', clave: 'dv', ancho: 5 },
          { titulo: 'Organización', clave: 'razonSocial', ancho: 36 },
          { titulo: 'Colaboradores', clave: 'colaboradores', ancho: 14, numero: true },
          { titulo: 'Gremio', clave: 'gremio', ancho: 14 },
          { titulo: 'Otro gremio', clave: 'gremioOtro', ancho: 20 },
          { titulo: 'Contacto', clave: 'contacto', ancho: 28 },
          { titulo: 'Correo', clave: 'correo', ancho: 32 },
          { titulo: 'Celular', clave: 'celular', ancho: 16 },
          { titulo: 'Cargo', clave: 'cargo', ancho: 24 },
          { titulo: 'Solicitados', clave: 'solicitados', ancho: 12, numero: true },
          { titulo: 'Confirmados', clave: 'confirmados', ancho: 12, numero: true },
          { titulo: 'En espera', clave: 'enEspera', ancho: 12, numero: true },
          ...columnasExtra.map((titulo, i) => ({ titulo, clave: `extra${i}`, ancho: 28 })),
        ],
        filas: reservas.map((r) => {
          const extras: Record<string, string> = {};
          for (const respuesta of r.respuestas) {
            const i = columnasExtra.indexOf(respuesta.etiquetaPregunta);
            if (i >= 0) extras[`extra${i}`] = valorLegible(respuesta);
          }
          return {
            fecha: r.creadoEn.toISOString().slice(0, 16).replace('T', ' '),
            estado: ESTADO_RESERVA[r.estado] ?? r.estado,
            convenio: r.oferta.accionFormacion.convenio.sigla ?? r.oferta.accionFormacion.convenio.slug,
            codigo: r.oferta.accionFormacion.codigo,
            accion: r.oferta.accionFormacion.nombre,
            ubicacion: r.oferta.ubicacion.nombre,
            modalidad: MODALIDAD[r.oferta.modalidad] ?? r.oferta.modalidad,
            nit: r.empresa.nit,
            dv: r.empresa.digitoVerificacion ?? '',
            razonSocial: r.empresa.razonSocial,
            colaboradores: r.empresa.numeroColaboradores ?? '',
            gremio: r.empresa.redAsociada ?? '',
            gremioOtro: r.empresa.redAsociadaOtra ?? '',
            contacto: r.contactoNombre,
            correo: r.contactoCorreo,
            celular: r.contactoCelular ?? '',
            cargo: r.contactoCargo ?? '',
            solicitados: r.cuposSolicitados,
            confirmados: r.cuposConfirmados,
            enEspera: r.cuposEnEspera,
            ...extras,
          };
        }),
      },
    ]);

    this.enviar(res, libro, nombreArchivo('reservas'));
  }

  @Get('exportar/ocupacion')
  @Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
  async exportarOcupacion(@Res() res: Response) {
    const [ubicaciones, acciones] = await Promise.all([
      this.tableros.porUbicacion(),
      this.tableros.porAccion(),
    ]);

    const libro = await construirLibro([
      {
        nombre: 'Por ubicación',
        columnas: [
          { titulo: 'Convenio', clave: 'convenio', ancho: 16 },
          { titulo: 'Código', clave: 'codigo', ancho: 8 },
          { titulo: 'Acción de formación', clave: 'accion', ancho: 50 },
          { titulo: 'Ubicación', clave: 'ubicacion', ancho: 22 },
          { titulo: 'Tipo', clave: 'tipo', ancho: 14 },
          { titulo: 'Modalidad', clave: 'modalidad', ancho: 12 },
          { titulo: 'Cupos', clave: 'cupos', ancho: 10, numero: true },
          { titulo: 'Reservados', clave: 'ocupados', ancho: 12, numero: true },
          { titulo: 'Disponibles', clave: 'disponibles', ancho: 12, numero: true },
          { titulo: '% avance', clave: 'avance', ancho: 10, numero: true },
          { titulo: 'Estado', clave: 'estado', ancho: 16 },
        ],
        filas: ubicaciones.map((u) => ({
          convenio: u.convenioSigla ?? u.convenio,
          codigo: u.codigo,
          accion: u.accion,
          ubicacion: u.ubicacion,
          tipo: u.tipoUbicacion === 'CIUDAD' ? 'Ciudad' : 'Departamento',
          modalidad: MODALIDAD[u.modalidad] ?? u.modalidad,
          cupos: u.cupos,
          ocupados: u.ocupados,
          disponibles: u.disponibles,
          avance: u.avance,
          estado: SEMAFORO[u.estado] ?? u.estado,
        })),
      },
      {
        nombre: 'Por acción',
        columnas: [
          { titulo: 'Convenio', clave: 'convenio', ancho: 16 },
          { titulo: 'Código', clave: 'codigo', ancho: 8 },
          { titulo: 'Acción de formación', clave: 'accion', ancho: 50 },
          { titulo: 'Evento', clave: 'evento', ancho: 16 },
          { titulo: 'Modalidad', clave: 'modalidad', ancho: 12 },
          { titulo: 'Horas', clave: 'horas', ancho: 8, numero: true },
          { titulo: 'Ubicaciones', clave: 'ubicaciones', ancho: 12, numero: true },
          { titulo: 'Cupos', clave: 'cupos', ancho: 10, numero: true },
          { titulo: 'Reservados', clave: 'ocupados', ancho: 12, numero: true },
          { titulo: 'Disponibles', clave: 'disponibles', ancho: 12, numero: true },
          { titulo: 'En espera', clave: 'enEspera', ancho: 12, numero: true },
          { titulo: '% avance', clave: 'avance', ancho: 10, numero: true },
          { titulo: 'Publicada', clave: 'publicada', ancho: 12 },
        ],
        filas: acciones.map((a) => ({
          convenio: a.convenioSigla ?? a.convenio,
          codigo: a.codigo,
          accion: a.nombre,
          evento: a.evento ?? '',
          modalidad: MODALIDAD[a.modalidad] ?? a.modalidad,
          horas: a.horas ?? '',
          ubicaciones: a.ubicaciones,
          cupos: a.cupos,
          ocupados: a.ocupados,
          disponibles: a.disponibles,
          enEspera: a.enEspera,
          avance: a.avance,
          publicada: a.visible ? 'Sí' : 'No',
        })),
      },
    ]);

    this.enviar(res, libro, nombreArchivo('ocupacion'));
  }

  @Get('exportar/empresas')
  @Roles(RolAdmin.SUPERADMIN, RolAdmin.GESTOR)
  async exportarEmpresas(@Query('buscar') buscar: string | undefined, @Res() res: Response) {
    const empresas = await this.tableros.porEmpresa(buscar);

    const libro = await construirLibro([
      {
        nombre: 'Empresas',
        columnas: [
          { titulo: 'NIT', clave: 'nit', ancho: 14 },
          { titulo: 'DV', clave: 'dv', ancho: 5 },
          { titulo: 'Organización', clave: 'razonSocial', ancho: 40 },
          { titulo: 'Colaboradores', clave: 'colaboradores', ancho: 14, numero: true },
          { titulo: 'Gremio', clave: 'gremio', ancho: 14 },
          { titulo: 'Otro gremio', clave: 'gremioOtro', ancho: 20 },
          { titulo: 'Reservas', clave: 'reservas', ancho: 10, numero: true },
          { titulo: 'Cupos confirmados', clave: 'confirmados', ancho: 18, numero: true },
          { titulo: 'En espera', clave: 'enEspera', ancho: 12, numero: true },
          { titulo: 'Cursos', clave: 'cursos', ancho: 24 },
          { titulo: 'Primera reserva', clave: 'creadoEn', ancho: 18 },
        ],
        filas: empresas.map((e) => ({
          nit: e.nit,
          dv: e.digitoVerificacion ?? '',
          razonSocial: e.razonSocial,
          colaboradores: e.numeroColaboradores ?? '',
          gremio: e.redAsociada ?? '',
          gremioOtro: e.redAsociadaOtra ?? '',
          reservas: e.reservas,
          confirmados: e.confirmados,
          enEspera: e.enEspera,
          cursos: e.cursos.join(', '),
          creadoEn: e.creadoEn.toISOString().slice(0, 10),
        })),
      },
    ]);

    this.enviar(res, libro, nombreArchivo('empresas'));
  }

  private enviar(res: Response, libro: Buffer, nombre: string) {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    // sin caché
    res.setHeader('Cache-Control', 'no-store');
    res.send(libro);
  }

  private filtros(consulta: Record<string, string>): FiltrosReservas {
    const estado = consulta.estado;
    return {
      buscar: consulta.buscar,
      estado: ESTADOS.includes(estado) ? (estado as EstadoReserva) : undefined,
      convenio: consulta.convenio || undefined,
      accionId: consulta.accionId || undefined,
      pagina: Number(consulta.pagina) || 1,
      porPagina: Number(consulta.porPagina) || undefined,
    };
  }
}
