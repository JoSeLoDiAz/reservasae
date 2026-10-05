/** Una persona no reescribe la organización que nominó a otras 39. */

/**
 * `guardarEmpresa` hacía `empresa.update({ data: datos })` sobre
 * la organización atada a la ficha. Y de las dos que pueden
 * estar atadas, una es LA QUE NOMINÓ POR UNA RESERVA: una sola
 * fila, compartida por todos los nominados de ese convenio.
 *
 * Cómo se veía: una persona del Colegio Benedictino abría su
 * enlace, ponía su propio celular en «teléfono» y su propio
 * nombre en «persona de contacto» —que es lo que pone cualquiera
 * si no le dicen otra cosa— y eso quedaba como el teléfono y el
 * contacto del colegio en las 40 fichas. El F7 va por
 * organización, así que las 40 filas salían al SENA con el
 * teléfono de una sola persona.
 *
 * Lo que lo tapaba: desde su propia ficha no se notaba nada. La
 * pantalla le pedía los datos «de su organización», ella los
 * daba de buena fe, nada fallaba, y el cambio solo se veía
 * mirando las otras 39.
 *
 * La regla es la misma que el camino de reservas ya aplica sobre
 * una organización que existe: solo se rellenan HUECOS. Que una
 * empresa corrija sus propios datos es trabajo del analista de
 * información, que sabe con quién está hablando; este formulario
 * no lo sabe.
 *
 * Y LA SUYA PROPIA SÍ SE ESCRIBE ENTERA: si la organización es la
 * que ella misma dio —su NIT, o su cédula como RUT— no hay nadie
 * más detrás y corregirse es justo para lo que existe el enlace.
 * Eso no se toca: lo fija `cambiar-de-organizacion.spec.ts` y
 * sigue valiendo.
 */

import { soloRellenarHuecos } from './solo-se-rellenan-huecos';

/// Lo que el colegio tiene puesto desde el cargue de la reserva.
const DEL_COLEGIO = {
  direccion: 'Carrera 7 # 80-20',
  telefono: '6012345678',
  departamentoSepId: 11,
  municipioSepId: 11001,
  sectorEconomico: 'EDUCACION',
  numeroTrabajadores: 120,
  contactoNombre: 'Rectoría Colegio Benedictino',
  contactoCargo: 'Rector',
  contactoCorreo: 'rectoria@benedictino.edu.co',
};

/// Lo que escribe el nominado al llenar «los datos de su
/// organización»: lo suyo.
const LO_QUE_ESCRIBE_LA_PERSONA = {
  direccion: 'Calle 100 # 15-30 apto 402',
  telefono: '3101234567',
  departamentoSepId: 11,
  municipioSepId: 11001,
  sectorEconomico: 'EDUCACION',
  numeroTrabajadores: 1,
  contactoNombre: 'Ana Ruiz',
  contactoCargo: 'Docente',
  contactoCorreo: 'ana.ruiz@gmail.com',
};

describe('la organización que nominó por una reserva', () => {
  it('no le cambia el teléfono ni el contacto a las otras 39 fichas', () => {
    const aEscribir = soloRellenarHuecos(
      LO_QUE_ESCRIBE_LA_PERSONA,
      DEL_COLEGIO,
    );
    /// El caso exacto del defecto.
    expect(aEscribir).toEqual({});
    expect(aEscribir.telefono).toBeUndefined();
    expect(aEscribir.contactoNombre).toBeUndefined();
  });

  it('pero sí completa lo que el colegio tenía en blanco', () => {
    /// Rellenar un hueco no le quita nada a nadie, y es lo que
    /// hace que la fila del F7 deje de estar incompleta.
    const aMedias = {
      ...DEL_COLEGIO,
      sectorEconomico: null,
      contactoCargo: '',
    };
    const aEscribir = soloRellenarHuecos(LO_QUE_ESCRIBE_LA_PERSONA, aMedias);

    expect(aEscribir).toEqual({
      sectorEconomico: 'EDUCACION',
      contactoCargo: 'Docente',
    });
  });

  it('la cadena en blanco cuenta como hueco', () => {
    /// Un cargue puede dejar `contactoNombre: '   '`. Tratarlo
    /// como lleno dejaría el dato sin poder completarse nunca.
    const aEscribir = soloRellenarHuecos(
      { contactoNombre: 'Ana Ruiz' },
      { contactoNombre: '   ' },
    );
    expect(aEscribir).toEqual({ contactoNombre: 'Ana Ruiz' });
  });

  it('el cero NO es un hueco', () => {
    /// Cero trabajadores es un valor que alguien escribió, no la
    /// ausencia de uno. Con `||` en vez de la comprobación de
    /// nulo se habría pisado.
    const aEscribir = soloRellenarHuecos(
      { numeroTrabajadores: 1 },
      { numeroTrabajadores: 0 },
    );
    expect(aEscribir).toEqual({});
  });

  it('lo que el formulario no mandó no rellena nada', () => {
    const aEscribir = soloRellenarHuecos(
      { telefono: undefined, contactoCargo: null },
      { telefono: null, contactoCargo: null },
    );
    expect(aEscribir).toEqual({});
  });

  it('sobre una organización vacía se escribe todo', () => {
    /// Es el caso de una nominada que entró solo con NIT y razón
    /// social: ahí no hay nada que proteger.
    const aEscribir = soloRellenarHuecos(LO_QUE_ESCRIBE_LA_PERSONA, {});
    expect(aEscribir).toEqual(LO_QUE_ESCRIBE_LA_PERSONA);
  });
});

/**
 * Y AHORA LA DECISIÓN, que es donde estaba el defecto: la regla
 * de arriba no sirve de nada si se aplica a la organización
 * equivocada. Lo que se fija aquí es que se aplica cuando la
 * organización atada es la de la RESERVA y no cuando es la suya.
 */

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeEnlace } from './doble-enlace';
import { dobleDeColaDeCorreo } from '../correo/automaticos/doble';
import { dobleDeEmbudo } from '../embudo/doble';

type Escritura = { tabla: string; metodo: string; datos?: unknown };

const EMP_DEL_COLEGIO = 'emp-colegio';

function prismaFalso(
  nominadaPorLaReserva: boolean,
  /// Lo que al colegio le falta, para probar que el hueco sí se
  /// rellena y no que simplemente no se escribe nunca.
  huecosDelColegio: Record<string, unknown> = {},
) {
  const escrituras: Escritura[] = [];
  const anota =
    (tabla: string, metodo: string, valor: unknown = {}) =>
    (datos?: unknown) => {
      escrituras.push({ tabla, metodo, datos });
      return Promise.resolve(valor);
    };

  return {
    escrituras,
    enlaceCompletado: {
      findUnique: () =>
        Promise.resolve({
          id: 'e1',
          participanteId: 'par1',
          expiraEn: new Date(Date.now() + 86_400_000),
          usadoEn: null,
          anuladoEn: null,
          abiertoEn: null,
        }),
      update: anota('enlaceCompletado', 'update'),
      updateMany: anota('enlaceCompletado', 'updateMany', { count: 0 }),
    },
    participante: {
      /// Sirve a los dos `select` que se le piden: el de
      /// `guardarEmpresa` y el de `pasarSiNoLeFaltaNada`.
      findUnique: () =>
        Promise.resolve({
          id: 'par1',
          convenioId: 'conv1',
          /// La ficha está atada A LA MISMA organización en los
          /// dos casos. Lo único que cambia es si la nominó una
          /// reserva, que es lo que decide quién puede escribirla.
          empresaId: EMP_DEL_COLEGIO,
          reserva: nominadaPorLaReserva ? { empresaId: EMP_DEL_COLEGIO } : null,
          etapa: 'INSCRITO',
          nivelOcupacionalSepId: 2,
          persona: {
            tipoDocumentoSepId: 1,
            numeroDocumento: '1026300012',
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Ruiz',
            segundoApellido: null,
            direccion: null,
            celular: null,
            correo: null,
            departamentoSepId: null,
            municipioSepId: null,
          },
        }),
      update: anota('participante', 'update'),
    },
    empresa: {
      /// Sirve a los dos `findUnique` de `guardarEmpresa`: el que
      /// lee `id` y `nit` para decidir si cambió de organización,
      /// y el que lee los campos para ver qué está en blanco.
      findUnique: () =>
        Promise.resolve({
          id: EMP_DEL_COLEGIO,
          nit: '860013570',
          ...DEL_COLEGIO,
          ...huecosDelColegio,
        }),
      update: anota('empresa', 'update'),
      upsert: anota('empresa', 'upsert', { id: EMP_DEL_COLEGIO }),
    },
    registroAuditoria: { findMany: () => Promise.resolve([]) },
    valorAnterior: { create: anota('valorAnterior', 'create') },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  };
}

function servicio(prisma: ReturnType<typeof prismaFalso>) {
  return new PreinscripcionService(
    prisma as never,
    { encolar: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
    dobleDeEmbudo(),
    dobleDeColaDeCorreo(),
    dobleDeEnlace(),
    { avisar: () => Promise.resolve() } as never,
  );
}

/// Sin NIT escrito: solo viene a dar los datos de la
/// organización que ya tiene atada, que es el paso normal de un
/// nominado.
const elPasoDeLaOrganizacion = {
  situacionLaboral: 'EMPRESA',
  ...LO_QUE_ESCRIBE_LA_PERSONA,
} as never;

const escriturasDeLaEmpresa = (prisma: ReturnType<typeof prismaFalso>) =>
  prisma.escrituras.filter((e) => e.tabla === 'empresa');

describe('a quién se le aplica la regla', () => {
  it('nominada por una reserva: no se escribe nada suyo encima', async () => {
    const prisma = prismaFalso(true);
    await servicio(prisma).guardarEmpresa('t', elPasoDeLaOrganizacion);

    /// No quedaba ningún hueco, así que la fila del colegio no se
    /// toca. Antes se reescribía entera, y con ella las 40 fichas.
    expect(escriturasDeLaEmpresa(prisma)).toHaveLength(0);
  });

  it('nominada por una reserva: pero el hueco del colegio sí se llena', async () => {
    /// Rellenar lo que está en blanco no le quita nada a las otras
    /// 39 fichas, y es lo que hace que la fila del F7 deje de
    /// estar incompleta.
    const prisma = prismaFalso(true, {
      sectorEconomico: null,
      contactoCargo: '',
    });
    await servicio(prisma).guardarEmpresa('t', elPasoDeLaOrganizacion);

    const escrituras = escriturasDeLaEmpresa(prisma);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].datos).toEqual({
      where: { id: EMP_DEL_COLEGIO },
      /// Y NADA MÁS: ni su teléfono ni su nombre de contacto.
      data: { sectorEconomico: 'EDUCACION', contactoCargo: 'Docente' },
    });
  });

  it('la suya propia sí se escribe entera, como antes', async () => {
    const prisma = prismaFalso(false);
    await servicio(prisma).guardarEmpresa('t', elPasoDeLaOrganizacion);

    const escrituras = escriturasDeLaEmpresa(prisma);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].metodo).toBe('update');
    expect(escrituras[0].datos).toEqual({
      where: { id: EMP_DEL_COLEGIO },
      data: LO_QUE_ESCRIBE_LA_PERSONA,
    });
  });
});
