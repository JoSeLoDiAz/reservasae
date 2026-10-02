/** Crear una ficha tampoco deja ponerle cualquier asesor. */

/**
 * LA TERCERA PUERTA, y la que no validaba NADA.
 *
 * José señaló tres caminos por los que se le asigna un asesor a una
 * ficha: `actualizar()`, `asignarAsesorEnLote()` y `crear()`. Los dos
 * primeros pasaban por `exigirAsesorDelConvenio`; el tercero escribía
 * `dto.asesorId ?? admin?.id ?? null` tal cual.
 *
 * O sea que por ahí no solo se saltaba la regla del cliente sobre qué
 * roles llevan leads: se podía dejar una ficha en manos de alguien que
 * NO LA VE, que es lo que esa función existe para impedir.
 *
 * LOS DOS CASOS SE TRATAN DISTINTO, y esa es la decisión que vale la
 * pena fijar:
 *
 * · Elegir a alguien que no puede → se RECHAZA. Pidió algo imposible y
 *   callarlo le dejaría la ficha donde no la trabaja nadie.
 *
 * · No elegir a nadie → la ficha se queda con quien la crea, pero solo
 *   si su rol lleva leads. Aquí NO se rechaza: que un líder de sistemas
 *   dé de alta una ficha es normal, y lo que no debe pasar es que se le
 *   quede a él. Tumbar el alta sería castigar al que hizo bien su
 *   trabajo.
 */

const fuente = (f: string) =>
  require('fs').readFileSync(
    require('path').join(__dirname, f),
    'utf8',
  ) as string;

const cuerpoDeCrear = () => {
  const t = fuente('crm.service.ts');
  const i = t.indexOf('async crear(');
  expect(i).toBeGreaterThan(-1);
  return t.slice(i, t.indexOf('\n  async ', i + 20));
};

describe('al crear una ficha', () => {
  it('si eligen asesor, pasa por la misma cerradura que las otras dos', () => {
    const cuerpo = cuerpoDeCrear();
    expect(cuerpo).toContain('if (dto.asesorId) {');
    expect(cuerpo).toContain(
      'await this.exigirAsesorDelConvenio(dto.asesorId, dto.convenioId)',
    );
  });

  it('si no eligen, se la queda quien crea SOLO si su rol lleva leads', () => {
    const cuerpo = cuerpoDeCrear();
    expect(cuerpo).toContain('} else if (admin?.id && creadorLlevaFichas) {');
  });

  /**
   * Y NO ESCRIBE `dto.asesorId` DIRECTO. Si volviera a hacerlo, todo lo
   * de arriba quedaría en pie y vacío de efecto: el valor validado se
   * calcularía y no se usaría.
   */
  it('y lo que se guarda es el valor ya resuelto', () => {
    const cuerpo = cuerpoDeCrear();
    expect(cuerpo).toContain('asesorId: asesorDeLaFicha,');
    expect(cuerpo).not.toContain('asesorId: dto.asesorId ?? admin?.id');
  });

  /**
   * SIN UNA CONSULTA MÁS.
   *
   * La primera versión preguntaba por los roles en la base desde el
   * servicio, y eso rompió ocho pruebas: los dobles no tienen esa
   * tabla. Lo que decían esas pruebas al romperse era que el dato ya lo
   * tiene quien llama ---el guard resuelve `ambito.roles` en cada
   * petición---, así que se pasa en vez de volver a buscarlo.
   */
  it('el controlador le pasa el dato, no se vuelve a consultar', () => {
    const c = fuente('crm.controller.ts');
    const i = c.indexOf('return this.crm.crear(');
    expect(i).toBeGreaterThan(-1);
    const llamada = c.slice(i, c.indexOf(');', i));
    expect(llamada).toContain('conveniosQueLlevanFichas(ambito.roles)');
    expect(cuerpoDeCrear()).not.toContain('adminConvenio.findMany');
  });

  /**
   * Y EL VALOR POR DEFECTO ES «NO».
   *
   * Un llamador que se olvide de pasarlo crea la ficha SIN asesor ---se
   * reparte después--- en vez de dejársela a quien no la trabaja. Es la
   * diferencia entre un olvido que se nota y uno que abre el agujero
   * otra vez.
   */
  it('y por defecto no se la queda nadie', () => {
    expect(cuerpoDeCrear()).toContain('creadorLlevaFichas = false,');
  });
});
