/** Quien se preinscribe queda encolado para su acuse. */

/**
 * Lo pidio el cliente: «gestionar correo automatico cuando la
 * persona se preinscriba». Hasta hoy el UNICO correo que
 * recibia un ciudadano por esta puerta era el de «ya teniamos
 * un registro con su documento» --o sea que a quien se
 * registraba BIEN y por primera vez no le llegaba nada.
 *
 * Lo que este spec sujeta no es el texto --ese vive en una
 * plantilla y se edita desde el panel-- sino las tres cosas
 * que no pueden cambiar sin que alguien lo decida:
 *
 *   1. que se encole para la ficha NUEVA,
 *   2. que NO se encole para quien ya estaba en esa formacion,
 *      porque ese recibe el otro correo y recibiria dos,
 *   3. que se encole DESPUES de que la ficha exista.
 */

import { PreinscripcionService } from './preinscripcion.service';
import { dobleDeColaDeCorreo } from '../correo/automaticos/doble';
import { dobleDeEmbudo } from '../embudo/doble';

/// Dos interruptores y no uno: «la cedula ya estaba» y «ya
/// tenia ficha en ESTA accion» son cosas distintas, y con un
/// solo booleano el caso que de verdad importa --la persona
/// que existe y se apunta a un curso nuevo-- no se puede
/// escribir.
function prismaFalso(yaHabiaPersona: boolean, yaEstaEnLaAccion: boolean) {
  return {
    convenio: {
      findFirst: () => Promise.resolve({ id: 'c1', nombre: 'ADECOPRIA' }),
    },
    oferta: {
      findFirst: () =>
        Promise.resolve({
          id: 'o1',
          accionFormacionId: 'af1',
          accionFormacion: { evento: 'CURSO' },
        }),
    },
    politicaDatos: { findFirst: () => Promise.resolve({ id: 'p1' }) },
    persona: {
      findUnique: () =>
        Promise.resolve(
          yaHabiaPersona
            ? { id: 'per1', correo: 'ana@ejemplo.test', celular: '3001234567' }
            : null,
        ),
      upsert: () => Promise.resolve({ id: 'per1' }),
    },
    participante: {
      /// La misma cedula en la misma accion de formacion.
      findFirst: () => Promise.resolve(yaEstaEnLaAccion ? { id: 'viejo1' } : null),
      findMany: () => Promise.resolve([]),
      create: () => Promise.resolve({ id: 'par1' }),
    },
    autorizacionDatos: {
      findFirst: () => Promise.resolve(null),
      create: () => Promise.resolve({ id: 'a1' }),
    },
    enlaceCompletado: {
      updateMany: () => Promise.resolve({ count: 0 }),
      create: () =>
        Promise.resolve({
          id: 'e1',
          token: 't',
          expiraEn: new Date('2026-12-31T00:00:00Z'),
        }),
    },
    consultaRui: { findFirst: () => Promise.resolve(null) },
    propuestaDeDatos: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      create: () => Promise.resolve({ id: 'pr1' }),
    },
  };
}

const BASE = {
  ofertaId: 'o1',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1019456782',
  primerNombre: 'Ana',
  primerApellido: 'Jaramillo',
  celular: '3001234567',
  correo: 'ana@ejemplo.test',
  aceptaPolitica: true,
};

function servicio(yaHabiaPersona = false, yaEstaEnLaAccion = yaHabiaPersona) {
  const cola = dobleDeColaDeCorreo();
  const s = new PreinscripcionService(
    prismaFalso(yaHabiaPersona, yaEstaEnLaAccion) as never,
    { encolarSiHaceFalta: () => Promise.resolve() } as never,
    { registrar: () => Promise.resolve() } as never,
    { enviar: () => Promise.resolve({ estado: 'APAGADO' }) } as never,
    { agregarManual: () => Promise.resolve(null) } as never,
    dobleDeEmbudo(),
    cola,
  );
  return { s, cola };
}

describe('el acuse de la preinscripción', () => {
  it('se encola una vez para quien se registra por primera vez', async () => {
    const { s, cola } = servicio(false);
    await s.registrar('adecopria', BASE as never, '1.2.3.4');

    expect(cola.encolados).toHaveLength(1);
    expect(cola.encolados[0].motivo).toBe('PREINSCRIPCION');
    expect(cola.encolados[0].convenioId).toBe('c1');
  });

  it('se encola contra la ficha recién creada, no antes', async () => {
    const { s, cola } = servicio(false);
    await s.registrar('adecopria', BASE as never, '1.2.3.4');

    /// `par1` es el id que devuelve `participante.create`: si
    /// se encolara antes de crearla no habria a quien atarlo.
    expect(cola.encolados[0].participanteId).toBe('par1');
  });

  it('NO se encola a quien ya estaba en esa formación', async () => {
    const { s, cola } = servicio(true);
    await s.registrar('adecopria', BASE as never, '1.2.3.4');

    /// Ese recibe el otro correo, el que dice «ya teniamos un
    /// registro con su documento». Encolar ademas el acuse le
    /// mandaria dos que se contradicen.
    expect(cola.encolados).toHaveLength(0);
  });

  it('NO se encola a quien ya existía y se apunta a OTRA formación', async () => {
    /// El caso que destapo la revision: la cedula ya estaba
    /// --hizo el foro-- y ahora se apunta a un curso. La ficha
    /// es NUEVA, asi que con la condicion vieja (`!yaEsta`)
    /// caia en los dos caminos y recibia dos correos.
    ///
    /// Y lo caro no era el duplicado: el acuse lee el correo
    /// de la base DESPUES del upsert, o sea el que acaba de
    /// teclear quien llene el formulario. Con una cedula ajena
    /// habria salido al buzon del desconocido con el nombre y
    /// el curso de la dueña.
    const { s, cola } = servicio(true, false);
    await s.registrar('adecopria', BASE as never, '1.2.3.4');

    expect(cola.encolados).toHaveLength(0);
  });
});
