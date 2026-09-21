/** Lo que el formulario público no puede dejar pasar. */

/**
 * Este spec mira lo que SALE hacia Prisma, no lo que devuelve la
 * función. Es lo único que distingue «se rechazó» de «se rechazó
 * DESPUÉS de guardar», y esa distinción es el módulo entero: una
 * captación que valida al final deja dentro el nombre, el correo y
 * el celular de alguien que nunca autorizó nada.
 *
 * Lo mismo con el ámbito: en una ruta pública no hay sesión que
 * acote, así que lo que hay que fijar es que el `convenioId` de cada
 * consulta salga del slug y no del cuerpo.
 */

import {
  CampoNucleo,
  EtapaOportunidad,
  OrigenParticipante,
} from '../../generated/prisma';
import { CaptacionService } from './captacion.service';
import type { CaptarDto } from './dto';

/// Lo que sale hacia Prisma, sin `any`: se lee con los ayudantes de
/// abajo, que es lo que permite mirar dentro de un `where` sin que
/// el spec deje de comprobar tipos.
type Registro = Record<string, unknown>;
type Llamada = { modelo: string; metodo: string; args: Registro };

const donde = (l: Llamada): Registro => (l.args.where ?? {}) as Registro;
const datos = (l: Llamada): Registro => (l.args.data ?? {}) as Registro;
const cambio = (l: Llamada): Registro => (l.args.update ?? {}) as Registro;

const FORMULARIO_DE_PERSONAS = {
  id: 'f-1',
  slug: 'diplomado-gerencia',
  titulo: 'Diplomado en Gerencia',
  descripcion: null,
  mensajeExito: null,
  convenioId: 'conv-1',
  convenio: { slug: 'adecopria', nombre: 'Adecopria', sigla: 'ADE' },
  preguntas: [{ campoNucleo: CampoNucleo.CONTACTO_NOMBRE }],
};

const FORMULARIO_DE_EMPRESAS = {
  ...FORMULARIO_DE_PERSONAS,
  preguntas: [
    { campoNucleo: CampoNucleo.EMPRESA_NIT },
    { campoNucleo: CampoNucleo.CONTACTO_NOMBRE },
  ],
};

const POLITICA = { id: 'pol-1', version: 3 };

/// Una captación de persona que cumple todo. Cada prueba le quita lo
/// suyo, para que lo que falle sea lo que la prueba nombra.
const completa = (cambios: Partial<CaptarDto> = {}): CaptarDto => ({
  primerNombre: 'Ana',
  primerApellido: 'Ruiz',
  tipoDocumentoSepId: 1,
  numeroDocumento: '1.020.304.050',
  correo: 'ana@correo.com',
  aceptaPolitica: true,
  ...cambios,
});

function armar(
  estado: {
    formulario?: unknown;
    politica?: unknown;
    persona?: unknown;
    empresa?: unknown;
    anteriores?: unknown[];
  } = {},
) {
  const llamadas: Llamada[] = [];
  const creadas: { datos: Registro; actor: Registro }[] = [];

  const apuntar = <T>(
    modelo: string,
    metodo: string,
    args: Registro,
    valor: T,
  ) => {
    llamadas.push({ modelo, metodo, args });
    return Promise.resolve(valor);
  };

  const prisma = {
    formulario: {
      findFirst: (a: Registro) =>
        apuntar(
          'formulario',
          'findFirst',
          a,
          'formulario' in estado ? estado.formulario : FORMULARIO_DE_PERSONAS,
        ),
    },
    politicaDatos: {
      findFirst: (a: Registro) =>
        apuntar(
          'politicaDatos',
          'findFirst',
          a,
          'politica' in estado ? estado.politica : POLITICA,
        ),
      findUnique: (a: Registro) =>
        apuntar('politicaDatos', 'findUnique', a, POLITICA),
    },
    autorizacionDatos: {
      /// Nadie la había dado antes: es el caso normal de quien
      /// escribe por primera vez.
      findFirst: (a: Registro) =>
        apuntar('autorizacionDatos', 'findFirst', a, null),
      create: (a: Registro) =>
        apuntar('autorizacionDatos', 'create', a, { id: 'aut-1' }),
    },
    persona: {
      findUnique: (a: Registro) =>
        apuntar('persona', 'findUnique', a, estado.persona ?? null),
      upsert: (a: Registro) => apuntar('persona', 'upsert', a, { id: 'per-1' }),
    },
    empresa: {
      findUnique: (a: Registro) =>
        apuntar('empresa', 'findUnique', a, estado.empresa ?? null),
      upsert: (a: Registro) =>
        apuntar('empresa', 'upsert', a, {
          id: 'emp-1',
          razonSocial: 'Panadería del Norte S.A.S.',
        }),
    },
    oportunidad: {
      findMany: (a: Registro) =>
        apuntar('oportunidad', 'findMany', a, estado.anteriores ?? []),
    },
    leadEntrante: {
      findFirst: (a: Registro) => apuntar('leadEntrante', 'findFirst', a, null),
    },
    gestion: {
      create: (a: Registro) => apuntar('gestion', 'create', a, { id: 'ges-1' }),
    },
  };

  const formularios = {
    obtenerPublico: () => Promise.resolve({ slug: 'diplomado-gerencia' }),
    prepararRespuestas: () =>
      Promise.resolve({ formularioId: 'f-1', respuestas: [] }),
  };

  const oportunidades = {
    crear: (nuevo: Registro, actor: Registro) => {
      creadas.push({ datos: nuevo, actor });
      return Promise.resolve({ id: 'op-9', codigo: 'OP-2026-0001' });
    },
  };

  const s = new CaptacionService(
    prisma as never,
    formularios as never,
    oportunidades as never,
  );

  /// Lo que de verdad deja rastro. Es contra esto contra lo que se
  /// mide «no se escribió nada».
  const escrituras = () =>
    llamadas.filter((l) => ['create', 'upsert', 'update'].includes(l.metodo));

  const busca = (modelo: string, metodo: string) =>
    llamadas.find((l) => l.modelo === modelo && l.metodo === metodo);

  return { s, llamadas, escrituras, busca, creadas };
}

describe('la captación por el formulario público', () => {
  describe('el slug manda, y se resuelve contra la base', () => {
    it('solo sirve un formulario publicado de una cuenta activa', async () => {
      const { s, busca } = armar();
      await s.captar('diplomado-gerencia', completa());

      const w = donde(busca('formulario', 'findFirst')!);
      expect(w.slug).toBe('diplomado-gerencia');
      expect(w.publicado).toBe(true);
      expect(w.convenio).toEqual({ activo: true });
    });

    it('un formulario que no existe o está en borrador da 404', async () => {
      const { s, escrituras } = armar({ formulario: null });
      await expect(s.captar('inventado', completa())).rejects.toThrow(
        /No hay un formulario publicado/,
      );
      expect(escrituras()).toHaveLength(0);
    });

    /**
     * El ámbito de una ruta sin sesión. El `convenioId` no viaja en
     * el cuerpo —el DTO no lo declara— y sale del formulario, así
     * que la búsqueda de lo que este cliente ya tiene no puede
     * alcanzar la cuenta del otro gremio.
     */
    it('lo anterior se busca acotado a la cuenta del slug y al titular', async () => {
      const { s, busca } = armar();
      await s.captar('diplomado-gerencia', completa());

      const w = donde(busca('oportunidad', 'findMany')!);
      expect(w.convenioId).toBe('conv-1');
      /// Un `undefined` aquí no acotaría nada y devolvería la
      /// oportunidad de cualquier otro: por eso se comprueba que
      /// tenga valor, no solo que exista la clave.
      expect(w.personaId).toBe('per-1');
    });
  });

  describe('sin forma de contactar no se capta', () => {
    it('sin correo y sin celular no se escribe NADA', async () => {
      const { s, escrituras } = armar();
      await expect(
        s.captar(
          'diplomado-gerencia',
          completa({ correo: undefined, celular: undefined }),
        ),
      ).rejects.toThrow(/correo o un celular/);
      expect(escrituras()).toHaveLength(0);
    });

    it('con un celular basta', async () => {
      const { s, creadas } = armar();
      await s.captar(
        'diplomado-gerencia',
        completa({ correo: undefined, celular: '+57 300 111 2222' }),
      );
      expect(creadas).toHaveLength(1);
    });
  });

  describe('la autorización de datos no es opcional', () => {
    it('sin marcar la casilla no se escribe NADA', async () => {
      const { s, escrituras } = armar();
      await expect(
        s.captar('diplomado-gerencia', completa({ aceptaPolitica: undefined })),
      ).rejects.toThrow(/aceptar la política/);
      expect(escrituras()).toHaveLength(0);
    });

    /// El rechazo explícito es un NO, no un «no lo dijo».
    it('marcarla en falso también rechaza', async () => {
      const { s, escrituras } = armar();
      await expect(
        s.captar('diplomado-gerencia', completa({ aceptaPolitica: false })),
      ).rejects.toThrow(/aceptar la política/);
      expect(escrituras()).toHaveLength(0);
    });

    it('sin política publicada no se recibe, y se dice cómo arreglarlo', async () => {
      const { s, escrituras } = armar({ politica: null });
      await expect(s.captar('diplomado-gerencia', completa())).rejects.toThrow(
        /Configuración → Políticas/,
      );
      expect(escrituras()).toHaveLength(0);
    });

    /// Lo que hay que poder demostrar dentro de seis meses: contra
    /// qué VERSIÓN del texto, por qué canal y desde dónde.
    it('la constancia queda contra la versión vigente, con canal e IP', async () => {
      const { s, busca } = armar();
      await s.captar('diplomado-gerencia', completa(), '190.0.0.1');

      const constancia = datos(busca('autorizacionDatos', 'create')!);
      expect(constancia.personaId).toBe('per-1');
      expect(constancia.politicaDatosId).toBe('pol-1');
      expect(constancia.canal).toBe('FORMULARIO_WEB');
      expect(constancia.ip).toBe('190.0.0.1');
    });
  });

  describe('de quién es el negocio', () => {
    it('el formulario que pide NIT abre la empresa y va a su embudo', async () => {
      const { s, creadas, busca } = armar({
        formulario: FORMULARIO_DE_EMPRESAS,
      });
      await s.captar(
        'diplomado-gerencia',
        completa({
          nit: '900.123.456-7',
          razonSocial: 'Panadería del Norte S.A.S.',
          nombre: 'Ana Ruiz',
        }),
      );

      expect(donde(busca('empresa', 'upsert')!)).toEqual({ nit: '900123456' });
      expect(creadas[0].datos.embudo).toBe('EMPRESA');
      expect(creadas[0].datos.empresaId).toBe('emp-1');
    });

    /// Antes exigía el documento y el formulario público de personas
    /// no lo pregunta: no entraba ningún lead de personas (auditoría
    /// del 18 sep 2026). La persona se exige al calificar, como dice
    /// la escalera; al entrar basta con saber cómo responderle.
    it('sin documento, el negocio nace igual: sin persona y con el nombre en el título', async () => {
      const { s, creadas, busca } = armar();
      await s.captar(
        'diplomado-gerencia',
        completa({
          tipoDocumentoSepId: undefined,
          numeroDocumento: undefined,
        }),
      );

      expect(creadas).toHaveLength(1);
      const datos = creadas[0].datos as { personaId: unknown; titulo: string };
      expect(datos.personaId).toBeNull();
      expect(datos.titulo).toContain('·');
      /// Y NO busca negocios anteriores con un filtro vacío: eso
      /// devolvería los de cualquiera.
      expect(busca('oportunidad', 'findMany')).toBeUndefined();
    });

    /// La misma cédula es la misma persona, venga por donde venga:
    /// los puntos y los espacios no pueden crear una segunda.
    it('el documento se normaliza antes de buscar', async () => {
      const { s, busca } = armar();
      await s.captar('diplomado-gerencia', completa());

      expect(donde(busca('persona', 'findUnique')!)).toEqual({
        tipoDocumentoSepId_numeroDocumento: {
          tipoDocumentoSepId: 1,
          numeroDocumento: '1020304050',
        },
      });
    });

    /**
     * El aserto que protege de la corrección ingenua —«actualicemos
     * sus datos con lo que acaba de escribir»—. Quien llena este
     * formulario solo ha demostrado saberse un número de cédula. Si
     * su correo pisara al guardado, un POST con la cédula ajena y un
     * buzón propio desviaría a un desconocido todo lo que el sistema
     * le mande después a la dueña de la ficha.
     */
    it('lo que ya estaba en la ficha NO se pisa', async () => {
      const { s, busca } = armar({
        persona: {
          id: 'per-1',
          correo: 'la.duena@correo.com',
          celular: '3009998888',
        },
      });
      await s.captar(
        'diplomado-gerencia',
        completa({ correo: 'atacante@correo.com' }),
      );

      const soloHuecos = cambio(busca('persona', 'upsert')!);
      expect(soloHuecos.correo).toBe('la.duena@correo.com');
      expect(soloHuecos.celular).toBe('3009998888');
    });

    it('y lo que trajo queda escrito para que el asesor pregunte', async () => {
      const { s, busca } = armar({
        persona: { id: 'per-1', correo: 'la.duena@correo.com', celular: null },
      });
      await s.captar(
        'diplomado-gerencia',
        completa({ correo: 'otro@correo.com' }),
      );

      expect(datos(busca('gestion', 'create')!).nota).toContain(
        'otro@correo.com',
      );
    });
  });

  describe('el mismo cliente no sale dos veces', () => {
    const recienCaptada = [
      {
        id: 'op-1',
        codigo: 'OP-2026-0007',
        etapa: EtapaOportunidad.CAPTADO,
        creadoEn: new Date(),
        ultimoToqueEn: new Date(),
      },
    ];

    it('el segundo envío no crea otra oportunidad', async () => {
      const { s, creadas } = armar({ anteriores: recienCaptada });
      await s.captar('diplomado-gerencia', completa());
      expect(creadas).toHaveLength(0);
    });

    it('y devuelve la referencia de la que ya tenía', async () => {
      const { s } = armar({ anteriores: recienCaptada });
      const r = await s.captar('diplomado-gerencia', completa());
      expect(r.referencia).toBe('OP-2026-0007');
      expect(r.recibido).toBe(true);
    });

    /**
     * La respuesta es idéntica se haya creado el negocio o se haya
     * reconocido uno que ya estaba: decir «esto ya lo teníamos» le
     * confirmaría a cualquiera que teclee una cédula ajena que esa
     * persona nos escribió, y esta ruta la llama cualquiera.
     */
    it('la respuesta no delata si el cliente ya estaba', async () => {
      const { s: nuevo } = armar();
      const { s: repetido } = armar({ anteriores: recienCaptada });

      const uno = await nuevo.captar('diplomado-gerencia', completa());
      const otro = await repetido.captar('diplomado-gerencia', completa());

      expect(Object.keys(uno).sort()).toEqual(Object.keys(otro).sort());
      expect(uno.mensaje).toBe(otro.mensaje);
    });
  });

  describe('cómo nace el negocio', () => {
    it('nace sin dueño, sin valor y sin etapa elegida por el cliente', async () => {
      const { s, creadas } = armar();
      await s.captar('diplomado-gerencia', completa());

      const nuevo = creadas[0].datos;
      expect(nuevo.asesorId).toBeUndefined();
      expect(nuevo.valor).toBeUndefined();
      expect(nuevo.etapa).toBeUndefined();
    });

    /// Sin esto, todo lo que capta el formulario se le atribuiría a
    /// un asesor —el valor por omisión de la columna—.
    it('el canal por omisión es el formulario público', async () => {
      const { s, creadas } = armar();
      await s.captar('diplomado-gerencia', completa());
      expect(creadas[0].datos.origen).toBe('AUTOGESTION');
    });

    it('y la campaña viaja con él cuando la página la sabe', async () => {
      const { s, creadas } = armar();
      await s.captar(
        'diplomado-gerencia',
        completa({
          origen: OrigenParticipante.INSTAGRAM,
          campana: 'reels-septiembre',
        }),
      );
      expect(creadas[0].datos.origen).toBe('INSTAGRAM');
      expect(creadas[0].datos.campana).toBe('reels-septiembre');
    });

    /// El lead del otro gremio no se cree: la columna no tiene llave
    /// foránea y nadie más lo comprueba.
    it('un lead que no es de esta cuenta se ignora', async () => {
      const { s, creadas } = armar();
      await s.captar('diplomado-gerencia', completa({ leadId: 'lead-ajeno' }));
      expect(creadas[0].datos.leadId).toBeNull();
    });

    /// La bitácora tiene que poder decir quién la movió, y aquí no
    /// fue nadie con sesión.
    it('la bitácora dice que fue el formulario', async () => {
      const { s, creadas } = armar();
      await s.captar('diplomado-gerencia', completa());
      expect(creadas[0].actor.id).toBeNull();
      expect(creadas[0].actor.nombre).toContain('Diplomado en Gerencia');
    });

    it('deja la primera tarea, con lo que la persona escribió', async () => {
      const { s, busca } = armar();
      await s.captar('diplomado-gerencia', completa(), '190.0.0.1');

      const gestion = datos(busca('gestion', 'create')!);
      expect(gestion.oportunidadId).toBe('op-9');
      expect(gestion.tipo).toBe('TAREA');
      expect(gestion.titulo).toContain('Ana Ruiz');
      expect(gestion.nota).toContain('ana@correo.com');
      /// La versión de la política, en la nota que el asesor lee
      /// antes de marcar.
      expect(gestion.nota).toContain('v3');
      /// Sin asesor: en CAPTADO todavía no la ha tomado nadie, que
      /// es justo lo que mide el reloj de primera respuesta.
      expect(gestion.asesorId).toBeUndefined();
    });
  });
});
