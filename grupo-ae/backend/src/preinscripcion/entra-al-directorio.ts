/** Si esta organización se apunta en el directorio de NIT. */

/**
 * `empresas` e `instituciones` son dos tablas distintas: la
 * primera son las organizaciones del CRM, la segunda el maestro
 * de NIT compartido entre los gremios, que es sobre el que
 * trabajan «Empresas registradas» y el buscador del RUES.
 *
 * Lo que llega por el formulario público entra al directorio
 * marcado como `fuente: HUMANO` — lo escribió una persona, no
 * una fuente oficial — para que se pueda revisar y para que el
 * RUES lo corrija después.
 *
 * Vive aparte y no dentro del servicio porque decide qué dato
 * personal sale de su sitio, y eso hay que poder probarlo.
 */

export function entraAlDirectorio(caso: {
  /// Ya normalizado, solo dígitos.
  nit: string;
  razonSocial: string;
  /// Su cédula hace de RUT: la persona es su unidad económica.
  esRutPropio: boolean;
}): boolean {
  /// La cédula de alguien NO entra, y es lo que más importa.
  ///
  /// El directorio lo ven los dos gremios y lo recorre el
  /// buscador web. Meter cédulas ahí es esparcir un dato
  /// personal a un sitio que nadie consideró personal.
  if (caso.esRutPropio) return false;

  if (!caso.nit.trim()) return false;

  /// Sin nombre no responde a lo que el directorio existe para
  /// responder —«¿de quién es este NIT?»— y ensucia las
  /// búsquedas de todos.
  return caso.razonSocial.trim().length > 0;
}
