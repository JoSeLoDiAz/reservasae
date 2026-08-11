/** Paletas listas para elegir. */

import { EsquemaColor } from '../../generated/prisma';
import { derivarTemas } from './derivar';
import { TEMAS_POR_DEFECTO, type ColoresTema } from './temas';

export type PlantillaTema = {
  clave: string;
  nombre: string;
  descripcion: string;
  principal: string;
  encabezadoDeColor: boolean;
  /** Paleta literal; si falta, se deriva del principal. */
  temas?: Record<EsquemaColor, ColoresTema>;
};

export const PLANTILLAS: PlantillaTema[] = [
  {
    clave: 'azul-institucional',
    nombre: 'Azul institucional',
    descripcion: 'El de siempre. Sobrio y neutro.',
    principal: '#1d4ed8',
    encabezadoDeColor: false,
    // literal: tiene que coincidir con «restablecer»
    temas: TEMAS_POR_DEFECTO,
  },
  {
    clave: 'verde-empresarial',
    nombre: 'Verde empresarial',
    descripcion: 'Sereno, con encabezado blanco.',
    principal: '#0f766e',
    encabezadoDeColor: false,
  },
  {
    clave: 'indigo-encabezado',
    nombre: 'Índigo con barra de color',
    descripcion: 'La barra superior lleva el color de la entidad.',
    principal: '#4338ca',
    encabezadoDeColor: true,
  },
  {
    clave: 'vino',
    nombre: 'Vino',
    descripcion: 'Cálido y formal.',
    principal: '#9f1239',
    encabezadoDeColor: false,
  },
  {
    clave: 'naranja-calido',
    nombre: 'Naranja cálido',
    descripcion: 'Cercano, para convocatorias abiertas.',
    principal: '#c2410c',
    encabezadoDeColor: true,
  },
  {
    clave: 'gris-pizarra',
    nombre: 'Gris pizarra',
    descripcion: 'Casi sin color: manda el contenido.',
    principal: '#475569',
    encabezadoDeColor: false,
  },
  {
    clave: 'violeta',
    nombre: 'Violeta',
    descripcion: 'Distinto sin llegar a estridente.',
    principal: '#7c3aed',
    encabezadoDeColor: false,
  },
  {
    clave: 'azul-encabezado',
    nombre: 'Azul con barra de color',
    descripcion: 'El azul de siempre, con la barra superior en color.',
    principal: '#1d4ed8',
    encabezadoDeColor: true,
  },
  {
    clave: 'turquesa',
    nombre: 'Turquesa',
    descripcion: 'Claro y limpio, bien en pantallas grandes.',
    principal: '#0891b2',
    encabezadoDeColor: false,
  },
  {
    clave: 'verde-bosque',
    nombre: 'Verde bosque',
    descripcion: 'Más natural que el empresarial.',
    principal: '#15803d',
    encabezadoDeColor: false,
  },
  {
    clave: 'ambar',
    nombre: 'Ámbar',
    descripcion: 'Cálido y visible. Sale bastante oscuro: es lo que exige el contraste.',
    principal: '#b45309',
    encabezadoDeColor: false,
  },
  {
    clave: 'magenta',
    nombre: 'Magenta',
    descripcion: 'Para convocatorias que quieren destacar.',
    principal: '#a21caf',
    encabezadoDeColor: false,
  },
  {
    clave: 'verde-encabezado',
    nombre: 'Verde con barra de color',
    descripcion: 'Sobrio, con la barra superior en verde oscuro.',
    principal: '#0f766e',
    encabezadoDeColor: true,
  },
  {
    clave: 'carbon',
    nombre: 'Carbón',
    descripcion: 'Barra gris pizarra y acentos azulados. El más neutro de todos.',
    principal: '#334155',
    encabezadoDeColor: true,
  },
  {
    clave: 'vino-encabezado',
    nombre: 'Vino con barra de color',
    descripcion: 'La versión formal del vino.',
    principal: '#9f1239',
    encabezadoDeColor: true,
  },
];

/** La plantilla ya resuelta en sus dos paletas. */
export function temasDePlantilla(
  plantilla: PlantillaTema,
): Record<EsquemaColor, ColoresTema> {
  return (
    plantilla.temas ??
    derivarTemas({
      principal: plantilla.principal,
      encabezadoDeColor: plantilla.encabezadoDeColor,
    })
  );
}

/** Cada plantilla con sus colores. */
export function plantillasResueltas() {
  return PLANTILLAS.map((plantilla) => ({
    ...plantilla,
    temas: temasDePlantilla(plantilla),
  }));
}
