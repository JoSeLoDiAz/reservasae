/** El NIT no basta para cancelarle los cupos a otra organización. */

/**
 * LO ENCONTRÓ UNA AUDITORÍA DEL 2 OCT 2026.
 *
 * `PATCH /reservas/:id` y `POST /reservas/:id/cancelar` pedían como
 * única credencial el NIT. **El NIT no es una credencial**: está en el
 * RUES, en cualquier factura y en el pie de página de la web de la
 * institución.
 *
 * Y no hacía falta ni tocar la API: `/consulta` es una pantalla pública
 * con un buscador por NIT y un botón «Cancelar la reserva». Un visitante
 * tecleaba el NIT de otra organización, veía sus cupos y los liberaba.
 * La lista de espera los repartía en el acto, y a quien reservó no se le
 * avisaba. Irreversible por la vía pública.
 *
 * Ahora se exige también el correo con el que se reservó. No es un
 * segundo factor de verdad ---un código de un solo uso al correo lo
 * sería--- pero cierra la puerta de que baste un dato público.
 */

const leer = (ruta: string) =>
  require('fs').readFileSync(
    require('path').join(__dirname, ruta),
    'utf8',
  ) as string;

describe('lo que se exige para tocar una reserva', () => {
  const servicio = () => leer('reservas.service.ts');

  const cuerpoDe = (nombre: string) => {
    const t = servicio();
    const i = t.indexOf(nombre);
    expect(i).toBeGreaterThan(-1);
    return t.slice(i, t.indexOf('\n  ', t.indexOf('\n  }\n', i)));
  };

  /**
   * LA COMPROBACIÓN VA DONDE PASAN LAS DOS. `editar` y `cancelar`
   * resuelven la reserva por la misma función; ponerlo en cada una
   * habría sido la segunda copia de la misma decisión.
   */
  it('el correo se comprueba donde pasan editar y cancelar', () => {
    const t = servicio();
    const i = t.indexOf('private async reservaDeLaEmpresa(');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = t.slice(i, t.indexOf('\n  private ', i + 20));

    expect(cuerpo).toContain('reserva.empresa.nit === nit');
    expect(cuerpo).toContain(
      'comoSeEscribe(reserva.contactoCorreo) === comoSeEscribe(correo)',
    );
  });

  /**
   * RECORTADO Y EN MINÚSCULAS: quien reservó con «Compras@Colegio.com»
   * teclea «compras@colegio.com» y es la misma persona. Postgres compara
   * con mayúsculas, así que la igualdad cruda dejaría fuera a gente
   * legítima — y el daño de eso es que llamen por teléfono a cancelar,
   * que es peor que el agujero para quien atiende.
   */
  it('y se compara sin distinguir mayúsculas ni espacios', () => {
    const t = servicio();
    expect(t).toContain('v.trim().toLowerCase()');
  });

  /**
   * MISMO ERROR PARA LOS TRES CASOS. Distinguir «ese NIT no es» de «ese
   * correo no es» convierte esto en un oráculo: se puede averiguar qué
   * empresa reservó dónde probando NITs.
   */
  it('y el error no dice cuál de los tres falló', () => {
    const t = servicio();
    expect(t).toContain(
      "'No se encontró una reserva con ese identificador, NIT y correo.'",
    );
  });

  /**
   * SIN DEPENDER DEL FORMATO, que es como estaba y se rompió sola.
   *
   * Buscaba la llamada escrita en una línea; al añadirse un argumento,
   * prettier la partió en varias y la prueba cayó sin que nada hubiera
   * dejado de cumplirse. Una prueba que falla por un salto de línea
   * enseña a ignorarla, y la regla que protege ---que las dos puertas
   * exijan el correo--- es de las que no se pueden perder.
   *
   * Ahora se comprueba sobre el texto con los espacios aplastados: así
   * da igual cómo quede repartido en líneas.
   */
  it('las dos puertas lo reciben', () => {
    const enUnaLinea = servicio().replace(/\s+/g, ' ');
    const llamadas = enUnaLinea.split('this.reservaDeLaEmpresa(').slice(1);
    /// Las dos: `editar` y `cancelar`. Si quedara una, la otra habría
    /// vuelto a aceptar solo el NIT.
    expect(llamadas.length).toBeGreaterThanOrEqual(2);
    for (const l of llamadas) {
      const argumentos = l.slice(0, l.indexOf(')'));
      expect(argumentos).toContain('reservaId');
      expect(argumentos).toContain('correo');
    }
  });
});

describe('consultar sigue pidiendo solo el NIT', () => {
  /**
   * A PROPÓSITO: mirar los propios cupos no destruye nada, y pedir el
   * correo para mirar dejaría sin salida a quien lo olvidó. Lo que se
   * cerró es lo que ESCRIBE.
   */
  it('la consulta no pide correo', () => {
    const t = leer('reservas.controller.ts');
    const i = t.indexOf('consultar(');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 200)).toContain(
      'this.reservas.consultarPorNit(dto.nit)',
    );
  });
});

describe('los dos DTO lo exigen', () => {
  it('editar y cancelar piden el correo', () => {
    const t = leer('dto/editar-reserva.dto.ts');
    /// Dos veces: una por cada DTO.
    expect(t.split('correo!: string;').length - 1).toBe(2);
    expect(t).toContain('@IsEmail()');
  });
});
