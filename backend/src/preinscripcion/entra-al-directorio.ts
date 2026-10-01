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
  /**
   * EL INDEPENDIENTE CON RUT SÍ ENTRA (cliente, 1 oct 2026).
   *
   * Hasta hoy NO entraba, y era a propósito: «meter cédulas ahí es
   * esparcir un dato personal a un sitio que nadie consideró
   * personal», porque el directorio lo ven los dos gremios y lo
   * recorre el buscador web.
   *
   * El cliente revisó el caso y decidió al revés: «más allá de que no
   * sea un NIT, es una empresa común y corriente, solo que cambia su
   * naturaleza o composición». Tiene razón en lo operativo ---ante el
   * SENA esa persona ES su unidad económica, y el F7 la reporta como
   * tal---, así que dejarla fuera del maestro la volvía invisible
   * justo donde se la busca.
   *
   * LO QUE SE PIERDE, dicho aquí para que quede: la cédula de una
   * persona natural pasa a vivir en una tabla que ve el otro gremio y
   * que recorre el buscador web. Si eso hay que acotarlo ---no
   * mostrarla fuera de su gremio, o no dejar que el buscador la
   * consulte--- es una regla aparte y va encima de esta, no en lugar
   * de ella.
   */
  if (!caso.nit.trim()) return false;

  /// Sin nombre no responde a lo que el directorio existe para
  /// responder —«¿de quién es este NIT?»— y ensucia las
  /// búsquedas de todos.
  return caso.razonSocial.trim().length > 0;
}
