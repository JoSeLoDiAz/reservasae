/** El DTO del webhook no puede tener opinión sobre qué slugs existen. */

/**
 * Esta prueba existe por un fallo que dejó el webhook mudo.
 *
 * `EntraLeadDto` llevaba `@IsIn(['adecopria', 'britcham-adee'])`, una
 * lista escrita a mano. El día que las unidades de negocio se
 * renombraron en la base, el DTO siguió exigiendo los nombres viejos
 * y **rechazaba con 400 un slug que sí existía**.
 *
 * Lo grave no fue el 400: fue DÓNDE ocurría. La validación del DTO
 * corre en el `ValidationPipe`, o sea ANTES de que el servicio vea
 * nada, así que el lead moría en la puerta sin llegar a guardarse.
 * No dejaba fila en `leads_entrantes`, no salía en la mesa de
 * entrada, no aparecía en ninguna pantalla. Un lead pagado que se
 * evapora sin rastro.
 *
 * Por eso esta prueba NO llama al servicio: llamarlo se salta el
 * pipe y no habría cazado nada. Valida el DTO como lo valida Nest, y
 * lo que fija es que **la lista de slugs no viva aquí**. Quién es
 * una unidad de negocio activa lo sabe la base, y solo la base.
 */

/// Lo carga `main.ts` en la aplicación de verdad, pero una prueba
/// suelta arranca sin él y los decoradores de class-validator no
/// encuentran sus metadatos: `Reflect.getMetadata is not a function`.
import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { EntraLeadDto } from './dto';

async function fallosDe(cuerpo: Record<string, unknown>) {
  const dto = plainToInstance(EntraLeadDto, cuerpo);
  return validate(dto, { whitelist: true });
}

const MINIMO = {
  externoId: 'meta-9911',
  nombreCompleto: 'Ana Jaramillo',
  celular: '3001234567',
};

describe('el DTO del webhook no tiene una lista de slugs escrita a mano', () => {
  /// Los tres son inventados a propósito: ninguno está en el
  /// código. Si alguien vuelve a poner un `@IsIn`, cualquiera de
  /// los tres lo delata.
  it.each(['grupo-ae', 'grupo-ae-b2c', 'la-que-abran-manana'])(
    'deja pasar «%s» para que decida la base',
    async (slug) => {
      const fallos = await fallosDe({ ...MINIMO, convenio: slug });
      const enConvenio = fallos.filter((f) => f.property === 'convenio');
      expect(enConvenio).toEqual([]);
    },
  );

  /**
   * El otro lado de la moneda, y la razón por la que quitar el
   * `@IsIn` no es aflojar nada: el slug desconocido SIGUE
   * rechazándose, solo que un paso más adentro y contra la base.
   *
   * Esa comprobación vive en `leads.spec.ts` («un convenio que no
   * existe se rechaza»). Aquí se deja dicho para que quien lea esta
   * prueba no concluya que el webhook admite cualquier cosa.
   */
  it('lo que sigue exigiendo: que sea texto', async () => {
    const fallos = await fallosDe({ ...MINIMO, convenio: 42 });
    expect(fallos.some((f) => f.property === 'convenio')).toBe(true);
  });

  it('y que se pueda omitir, porque el subdominio también lo dice', async () => {
    const fallos = await fallosDe(MINIMO);
    expect(fallos.filter((f) => f.property === 'convenio')).toEqual([]);
  });
});
