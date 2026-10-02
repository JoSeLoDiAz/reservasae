/** El documento tampoco se cambia aceptando una propuesta. */

/**
 * LA CERRADURA VA DONDE SE ESCRIBE, NO SOLO EN LA PUERTA.
 *
 * `actualizar()` exige administrador para cambiar el documento desde el
 * 1 oct 2026 ---«que solo lo pueda cambiar el administrador»---. Pero
 * `resolverPropuesta()` TAMBIÉN escribe en `persona`: hace un
 * `persona.update` con los campos que el asesor acepte, y no miraba
 * quién es.
 *
 * Hoy no había agujero, y por casualidad: ninguna de las dos cosas que
 * crean propuestas ---el cruce de leads y la preinscripción--- mete el
 * documento. Eso es una propiedad de lo que hoy proponen, no una regla.
 *
 * Y ESTUVO A PUNTO DE DEJAR DE SERLO. La lista de pendientes propone
 * «añadir el documento a la propuesta del cruce» como un arreglo de
 * minutos (A-05). Hacerlo tal cual habría deshecho el candado del día
 * anterior sin que nada fallara: ni una prueba en rojo, ni un error en
 * pantalla. Un gestor aceptando una propuesta, cambiando el número que
 * viaja al SENA.
 */

const fuente = () =>
  require('fs').readFileSync(
    require('path').join(__dirname, 'crm.service.ts'),
    'utf8',
  ) as string;

const cuerpoDe = (nombre: string) => {
  const t = fuente();
  const i = t.indexOf(`async ${nombre}(`);
  if (i < 0) throw new Error(`no encuentro ${nombre}`);
  return t.slice(i, t.indexOf('\n  async ', i + 20));
};

describe('quién puede cambiar el documento de una persona', () => {
  it('por la ficha, solo el administrador', () => {
    expect(cuerpoDe('actualizar')).toContain(
      'El documento de la persona solo lo puede corregir un administrador.',
    );
  });

  it('y aceptando una propuesta, también solo el administrador', () => {
    const cuerpo = cuerpoDe('resolverPropuesta');
    expect(cuerpo).toContain("RolAdmin.SUPERADMIN");
    expect(cuerpo).toContain(
      'El documento de la persona solo lo puede corregir un administrador.',
    );
  });

  /**
   * LOS DOS CAMPOS, porque el tipo también es identidad: la misma
   * cadena de dígitos siendo cédula o siendo pasaporte son dos
   * personas distintas para el `@@unique`.
   */
  it('mirando el número Y el tipo', () => {
    const cuerpo = cuerpoDe('resolverPropuesta');
    expect(cuerpo).toContain("'numeroDocumento'");
    expect(cuerpo).toContain("'tipoDocumentoSepId'");
  });

  /**
   * Y ANTES DE ESCRIBIR, no después: si la comprobación fuera luego,
   * el `persona.update` ya habría pasado.
   */
  it('y antes del update de la persona', () => {
    const cuerpo = cuerpoDe('resolverPropuesta');
    const candado = cuerpo.indexOf('RolAdmin.SUPERADMIN');
    const escribe = cuerpo.indexOf('this.prisma.persona.update(');
    expect(candado).toBeGreaterThan(-1);
    expect(escribe).toBeGreaterThan(-1);
    expect(candado).toBeLessThan(escribe);
  });
});

/**
 * Y QUE SIGA SIN HABER AGUJERO POR ARRIBA: que ninguna de las dos cosas
 * que crean propuestas meta el documento. Si alguien lo añade, el
 * candado de arriba lo para ---para eso está--- pero conviene que esta
 * prueba lo diga también, porque significa que ese dato empezó a
 * viajar por un sitio nuevo.
 */
describe('qué campos se proponen hoy', () => {
  const leer = (ruta: string) =>
    require('fs').readFileSync(
      require('path').join(__dirname, '..', ruta),
      'utf8',
    ) as string;

  it('ni el cruce de leads ni la preinscripción proponen el documento', () => {
    for (const ruta of [
      'leads/leads.service.ts',
      'preinscripcion/preinscripcion.service.ts',
    ]) {
      const t = leer(ruta);
      const i = t.indexOf('propuestaDeDatos.create(');
      expect(i).toBeGreaterThan(-1);

      /// Lo que se propone sale de `distintos`, que se arma con lo que
      /// hay en `llega`/`suyos` unas líneas antes.
      const alrededor = t.slice(Math.max(0, i - 4000), i);
      const ultimo = alrededor.lastIndexOf('const distintos');
      expect(alrededor.slice(ultimo)).not.toContain('numeroDocumento');
    }
  });
});
