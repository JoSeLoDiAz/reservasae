/** Qué se puede cargar por plantilla, y con qué columnas. */

/// Cada entrada dice tres cosas: qué columnas lleva el
/// archivo, cuál identifica la fila, y si se pueden crear
/// filas nuevas o solo corregir las que ya están.
///
/// Esa última distinción no es un detalle. El maestro de NIT
/// se llena solo -- del RUES y del buscador web -- y crear
/// filas ahí a mano lo llenaría de organizaciones inventadas
/// que después nadie sabe de dónde salieron. Las reservas y
/// las empresas aliadas sí se crean: las trae una persona.

import type { Plantilla } from './plantillas';

export type Entidad = 'instituciones' | 'reservas' | 'empresas';

export type Definicion = {
  plantilla: Plantilla;
  /// Si el archivo puede traer filas que no existen.
  admiteNuevas: boolean;
  /// Lo que se le dice a quien descarga el formato.
  queEs: string;
};

export const CATALOGO: Record<Entidad, Definicion> = {
  instituciones: {
    queEs:
      'Empresas registradas. Solo se corrigen las que ya están: aquí no se ' +
      'crean organizaciones a mano, las trae el RUES y el buscador web.',
    admiteNuevas: false,
    plantilla: {
      nombre: 'Empresas registradas',
      columnas: [
        {
          titulo: 'NIT',
          clave: 'nit',
          llave: true,
          ancho: 16,
          ayuda: 'Sin puntos ni guiones, y sin el dígito de verificación.',
        },
        {
          titulo: 'Razón social',
          clave: 'razonSocial',
          ancho: 42,
          ayuda: 'Como aparece en la Cámara de Comercio. Se guarda en mayúscula.',
        },
        { titulo: 'Dirección', clave: 'direccion', ancho: 34 },
        { titulo: 'Teléfono', clave: 'telefono', ancho: 18 },
        { titulo: 'Correo', clave: 'correo', ancho: 30 },
        {
          titulo: 'Ciudad',
          clave: 'ciudadNombre',
          ancho: 22,
          ayuda: 'El nombre del municipio, no su código.',
        },
        { titulo: 'Departamento', clave: 'departamentoNombre', ancho: 22 },
        {
          titulo: 'Sector económico',
          clave: 'sectorEconomico',
          ancho: 26,
          ayuda: 'COMERCIO, SERVICIOS o INDUSTRIA.',
        },
        {
          titulo: 'Código CIIU',
          clave: 'codigoCiiu',
          ancho: 14,
        },
        {
          titulo: 'Número de empleados',
          clave: 'numeroEmpleados',
          ancho: 20,
          ayuda: 'Solo el número.',
        },
      ],
    },
  },

  empresas: {
    queEs:
      'Empresas aliadas - afiliadas. Se corrigen las que están y se pueden ' +
      'agregar nuevas: basta con poner un NIT que todavía no exista.',
    admiteNuevas: true,
    plantilla: {
      nombre: 'Empresas aliadas',
      columnas: [
        {
          titulo: 'NIT',
          clave: 'nit',
          llave: true,
          ancho: 16,
          ayuda: 'Sin puntos ni guiones. Si no existe, se crea.',
        },
        {
          titulo: 'Organización',
          clave: 'razonSocial',
          ancho: 42,
          ayuda: 'Se guarda en mayúscula, como en el NIT.',
        },
        { titulo: 'Dígito de verificación', clave: 'digitoVerificacion', ancho: 20 },
        { titulo: 'Dirección', clave: 'direccion', ancho: 34 },
        { titulo: 'Teléfono', clave: 'telefono', ancho: 18 },
        {
          titulo: 'Sector económico',
          clave: 'sectorEconomico',
          ancho: 26,
          ayuda: 'COMERCIO, SERVICIOS o INDUSTRIA.',
        },
        { titulo: 'Número de trabajadores', clave: 'numeroTrabajadores', ancho: 22 },
        { titulo: 'Persona de contacto', clave: 'contactoNombre', ancho: 30 },
        { titulo: 'Cargo del contacto', clave: 'contactoCargo', ancho: 26 },
        { titulo: 'Correo del contacto', clave: 'contactoCorreo', ancho: 30 },
      ],
    },
  },

  reservas: {
    queEs:
      'Reservas de cupos. Se corrige la cantidad de cupos y los datos de ' +
      'quien la diligenció.',
    admiteNuevas: false,
    plantilla: {
      nombre: 'Reservas',
      columnas: [
        {
          titulo: 'Id de la reserva',
          clave: 'id',
          llave: true,
          ancho: 28,
          ayuda: 'No lo cambie. Es lo que identifica la reserva.',
        },
        { titulo: 'NIT', clave: 'nit', soloLectura: true, ancho: 16 },
        { titulo: 'Organización', clave: 'organizacion', soloLectura: true, ancho: 40 },
        { titulo: 'Formación', clave: 'formacion', soloLectura: true, ancho: 40 },
        {
          titulo: 'Cupos solicitados',
          clave: 'cuposSolicitados',
          ancho: 20,
          ayuda: 'Solo el número.',
        },
        { titulo: 'Contacto', clave: 'contactoNombre', ancho: 30 },
        { titulo: 'Cargo del contacto', clave: 'contactoCargo', ancho: 26 },
        { titulo: 'Correo del contacto', clave: 'contactoCorreo', ancho: 30 },
        { titulo: 'Celular del contacto', clave: 'contactoCelular', ancho: 20 },
      ],
    },
  },
};
