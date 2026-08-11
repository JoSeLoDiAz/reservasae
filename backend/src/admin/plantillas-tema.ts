/**
 * Paletas listas para elegir.
 *
 * Cada una es un color principal que pasa por la misma derivación que el
 * editor: galería y «elegir un color» no pueden discrepar.
 */

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

/** Lo que se manda al panel: cada plantilla con sus colores. */
export function plantillasResueltas() {
  return PLANTILLAS.map((plantilla) => ({
    ...plantilla,
    temas: temasDePlantilla(plantilla),
  }));
}
