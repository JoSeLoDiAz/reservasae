/** De qué campo se guarda el valor anterior, y de cuál no. */

/// Esta es la política de privacidad del histórico, escrita en
/// un solo sitio. No es una etiqueta por campo: es la decisión
/// de si ese dato viejo puede existir en una segunda tabla.
///
/// La regla de fondo: guardar valores viejos crea una segunda
/// copia de datos personales, y es la copia que nadie se
/// acuerda de proteger. Así que solo se guarda donde el
/// beneficio es concreto, y nunca donde el daño es grave.

import { ClaseDeDato } from '../../generated/prisma';

/**
 * Campo → cómo se trata.
 *
 * Un campo que NO esté aquí no se historia. Es a propósito:
 * la lista blanca falla cerrada, así que un campo nuevo no
 * empieza a guardar valores viejos solo porque alguien lo
 * añadió al formulario.
 */
export const CLASE_POR_CAMPO: Record<string, ClaseDeDato> = {
  /// Cambia de verdad con el tiempo. Se guarda para poder
  /// deshacer una corrección equivocada.
  celular: ClaseDeDato.CONTACTO,
  correo: ClaseDeDato.CONTACTO,
  direccion: ClaseDeDato.CONTACTO,
  barrio: ClaseDeDato.CONTACTO,
  departamentoSepId: ClaseDeDato.CONTACTO,
  municipioSepId: ClaseDeDato.CONTACTO,

  /// Casi siempre es corregir un tecleo, pero SE GUARDA
  /// igual, y por una razón concreta:
  ///
  /// corregir «Perez → Pérez» y sustituirle la identidad a un
  /// lead se ven IDÉNTICOS en una lista de nombres de campo.
  /// Sin el valor de antes, el histórico deja pasar justo el
  /// fraude para el que existe.
  primerNombre: ClaseDeDato.IDENTIDAD,
  segundoNombre: ClaseDeDato.IDENTIDAD,
  primerApellido: ClaseDeDato.IDENTIDAD,
  segundoApellido: ClaseDeDato.IDENTIDAD,
  fechaNacimiento: ClaseDeDato.IDENTIDAD,
  generoSepId: ClaseDeDato.IDENTIDAD,

  /// De la ficha del curso, no de la persona. Se enseña sin
  /// tapar: una reclamación de certificación llega años
  /// después y hay que poder reconstruir qué se reportó.
  cargoEnEmpresa: ClaseDeDato.FORMACION,
  nivelOcupacionalSepId: ClaseDeDato.FORMACION,
  beneficiarioPrevio: ClaseDeDato.FORMACION,
  estrato: ClaseDeDato.FORMACION,

  /// De qué organización se la reporta. Se guarda el NIT y no
  /// el id, que no le dice nada a nadie.
  ///
  /// El F7 va por organización, así que cambiarla cambia en qué
  /// fila cuenta esta persona. Sin el valor viejo, «cambió de
  /// empresa» no permite reconstruir qué se reportó antes — que
  /// es exactamente para lo que existe esta clase.
  empresaNit: ClaseDeDato.FORMACION,

  /// Población vulnerable. Queda la CONSTANCIA de que cambió,
  /// NUNCA el valor.
  ///
  /// Que alguien fue víctima del conflicto y lo desmarcó no
  /// puede quedar escrito en una segunda tabla: es el dato
  /// del artículo 5 de la Ley 1581, y en Colombia divulgarlo
  /// pone a una persona en riesgo físico. Ni tapado, ni
  /// cifrado, ni «solo para superadmin».
  caracterizaciones: ClaseDeDato.SENSIBLE,
  caracterizacionRechazada: ClaseDeDato.SENSIBLE,
};

/// El documento NO se historia, y no por olvido: no se edita
/// por esa puerta. Es la llave de la persona en todo el
/// sistema, y si algún día se corrige, la cédula vieja NO se
/// copia a ningún lado.
export const NUNCA_SE_HISTORIA = [
  'numeroDocumento',
  'tipoDocumentoSepId',
] as const;

/** ¿Se guarda el valor viejo de este campo, o solo que cambió? */
export function seGuardaElValor(campo: string): boolean {
  const clase = CLASE_POR_CAMPO[campo];
  return clase !== undefined && clase !== ClaseDeDato.SENSIBLE;
}

/** ¿Se historia siquiera? */
export function seHistoria(campo: string): boolean {
  return CLASE_POR_CAMPO[campo] !== undefined;
}

/// Cómo se llama el campo cuando hay que enseñárselo a una
/// persona. Sin esto la pantalla diría «nivelOcupacionalSepId
/// cambió», que no lo lee nadie.
export const CAMPO_EN_PALABRAS: Record<string, string> = {
  celular: 'Celular',
  correo: 'Correo',
  direccion: 'Dirección',
  barrio: 'Barrio o vereda',
  departamentoSepId: 'Departamento',
  municipioSepId: 'Municipio',
  empresaNit: 'Organización (NIT)',
  primerNombre: 'Primer nombre',
  segundoNombre: 'Segundo nombre',
  primerApellido: 'Primer apellido',
  segundoApellido: 'Segundo apellido',
  fechaNacimiento: 'Fecha de nacimiento',
  generoSepId: 'Género',
  cargoEnEmpresa: 'Cargo en la empresa',
  nivelOcupacionalSepId: 'Nivel ocupacional',
  beneficiarioPrevio: 'Se benefició antes',
  estrato: 'Estrato',
  caracterizaciones: 'Población vulnerable',
  caracterizacionRechazada: 'Prefirió no responder',
};

export function enPalabras(campo: string): string {
  return CAMPO_EN_PALABRAS[campo] ?? campo;
}
