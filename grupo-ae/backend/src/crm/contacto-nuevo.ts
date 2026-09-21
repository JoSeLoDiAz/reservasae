/** Las reglas de un contacto que se escribe a mano en el panel. */

/**
 * Por qué hay una puerta aparte y no se usa `POST /admin/participantes`.
 *
 * Esa ruta existe y funciona, pero crea lo que hacía falta en el otro
 * negocio: un `Participante`, que es una persona DENTRO DE UNA
 * FORMACIÓN. En Grupo AE eso no describe nada —aquí se venden
 * licencias y servicios de Google a organizaciones— y además trae
 * consigo dos efectos que aquí hacen daño:
 *
 *  - Encola la consulta al RUI: le pregunta al portal del DNP por la
 *    cédula de alguien que solo quiere una cotización de Workspace.
 *    Consultar al Estado por un ciudadano sin un motivo que él
 *    conozca es justo lo que la Ley 1581 no deja hacer.
 *  - La ficha que deja no se ve en ninguna pantalla de este CRM. El
 *    asesor guardaba, no la encontraba, y la volvía a crear.
 *
 * Lo que un contacto necesita en este CRM es lo que ya hace la
 * captación pública: una `Persona` —la identidad, única en toda la
 * base— y un NEGOCIO en el embudo, que es lo que el asesor trabaja y
 * lo único que aparece en «Leads de personas» y «Leads de empresas».
 * Esta puerta hace eso mismo, con las mismas reglas, pero con un
 * asesor delante en vez de un desconocido.
 *
 * Módulo puro y aparte, como `escalera.ts` y `no-duplicar.ts`: son
 * las decisiones, y se prueban sin base de datos.
 */

import { CanalAutorizacion } from '../../generated/prisma';
import { hayComoResponder } from '../captacion/hay-como-responder';
import { normalizar } from './rui/comparar-nombres';

/**
 * Por dónde puede decir un asesor que la persona autorizó.
 *
 * Solo los tres que pasan por un asesor. `FORMULARIO_WEB` y
 * `CARGA_EMPRESA` los deja el sistema cuando la persona marca una
 * casilla o una empresa sube su base; afirmarlos desde el panel
 * sería inventar una prueba que no existe.
 */
export const CANALES_A_MANO: CanalAutorizacion[] = [
  CanalAutorizacion.VERBAL_ASESOR,
  CanalAutorizacion.CORREO,
  CanalAutorizacion.PRESENCIAL,
];

/// Cómo se dice cada canal en la nota del asesor.
const DICHO_DEL_CANAL: Record<string, string> = {
  VERBAL_ASESOR: 'de palabra, con el asesor',
  CORREO: 'por correo',
  PRESENCIAL: 'en persona',
};

/** Los apellidos, que es lo que se compara. */
type Apellidos = {
  primerApellido: string;
  segundoApellido?: string | null;
};

/// Las palabras de los apellidos, sin tildes ni mayúsculas.
///
/// Se reusa `normalizar` del RUI y no una limpieza nueva: «Gómez» y
/// «GOMEZ» tienen que ser el mismo apellido en las dos puertas, y
/// dos limpiezas acaban discrepando en la primera ñ.
function palabrasDe(a: Apellidos): Set<string> {
  const juntas = normalizar(`${a.primerApellido} ${a.segundoApellido ?? ''}`);
  return new Set(juntas.split(' ').filter((p) => p.length > 1));
}

/**
 * Si el documento que se escribió es de la persona que se escribió.
 *
 * La `Persona` es única por documento en TODA la base, así que un
 * dígito mal tecleado no crea a alguien nuevo: le cuelga el negocio a
 * otra persona que ya existía, con su correo y su celular. El asesor
 * llamaría a un desconocido creyendo que es su contacto, y el negocio
 * quedaría a nombre de quien no pidió nada.
 *
 * Se comparan los APELLIDOS y basta con que compartan uno: es lo que
 * no cambia entre «María Ruiz» y «María del Carmen Ruiz Gómez», que
 * son la misma persona escrita con más o menos prisa. Los nombres
 * no, porque la gente usa el segundo, el apodo o las iniciales.
 */
export function esLaMismaPersona(
  guardada: Apellidos,
  escrita: Apellidos,
): boolean {
  const suyas = palabrasDe(guardada);
  for (const p of palabrasDe(escrita)) {
    if (suyas.has(p)) return true;
  }
  return false;
}

export type ContactoRevisado =
  | { puede: true; correo: string | null; celular: string | null }
  | { puede: false; porque: string };

/**
 * El correo y el celular, cada uno por su lado.
 *
 * La regla es la de la captación —uno de los dos basta, porque un
 * negocio sin forma de contacto no se puede trabajar— y se llama a la
 * MISMA función para que las dos puertas acepten lo mismo.
 *
 * Lo que cambia es qué se hace con lo que está mal. En el formulario
 * público, un celular que no sirve junto a un correo que sí se deja
 * pasar: perder un lead por el teléfono de la oficina sale caro. Aquí
 * no. Quien escribe es el asesor, y guardar callado solo la mitad de
 * lo que tecleó le hace creer que el celular quedó guardado cuando no.
 * Se le dice qué está mal, con él delante y el dato en la mano.
 */
export function revisarContacto(
  correo: string | null | undefined,
  celular: string | null | undefined,
): ContactoRevisado {
  const correoEscrito = (correo ?? '').trim();
  const celularEscrito = (celular ?? '').trim();

  if (!correoEscrito && !celularEscrito) {
    return {
      puede: false,
      porque:
        'Escriba un correo o un celular: un contacto sin ninguno de los dos no ' +
        'se puede trabajar.',
    };
  }

  const problemas: string[] = [];
  const conCorreo = correoEscrito
    ? hayComoResponder({ correo: correoEscrito })
    : null;
  const conCelular = celularEscrito
    ? hayComoResponder({ celular: celularEscrito })
    : null;

  if (conCorreo && !conCorreo.correo) {
    problemas.push(`«${correoEscrito}» no es un correo`);
  }
  if (conCelular && !conCelular.celular) {
    /// El fijo se nombra porque es el error de verdad: se escribe el
    /// teléfono de la oficina y no se entiende por qué lo rechaza.
    problemas.push(
      `«${celularEscrito}» no es un celular de diez dígitos que empiece por 3 ` +
        '(un fijo no recibe mensajes; si es lo único que tiene, déjelo en la nota)',
    );
  }

  if (problemas.length > 0) {
    return {
      puede: false,
      porque: `Revise el contacto: ${problemas.join(' y ')}.`,
    };
  }

  return {
    puede: true,
    correo: conCorreo?.correo ?? null,
    celular: conCelular?.celular ?? null,
  };
}

/**
 * El título del negocio.
 *
 * `titulo` es obligatorio en la oportunidad —dice qué se le vende— y
 * aquí es opcional, porque muchas veces el contacto se apunta antes de
 * saber qué quiere: se conoció en una feria, llamó a preguntar. En vez
 * de obligar a inventarse uno, se pone el que dice la verdad —que es
 * una solicitud de esa persona u organización— y el asesor lo cambia
 * desde la ficha cuando sepa más.
 */
export function tituloDelNegocio(
  interes: string | null | undefined,
  deQuien: string,
): string {
  const escrito = (interes ?? '').trim();
  const titulo = escrito.length >= 3 ? escrito : `Solicitud de ${deQuien}`;
  return titulo.slice(0, 160);
}

export type LoQueSeSupo = {
  registradoPor: string;
  organizacion?: string | null;
  nit?: string | null;
  cargo?: string | null;
  /// Lo que se escribió y NO reemplazó a lo que ya estaba guardado.
  loQueNoSePiso: string[];
  constancia: 'REGISTRADA' | 'YA_TENIA' | 'SIN_POLITICA' | 'NO_DIJO';
  canal?: CanalAutorizacion | null;
  nota?: string | null;
};

/**
 * La nota de la primera tarea: lo que se sabe de este contacto.
 *
 * Es donde el asesor lo va a leer antes de llamar, igual que las
 * respuestas del formulario en la captación. La organización y el
 * cargo van AQUÍ, en el caso de venderle a la persona, porque la
 * `Persona` no tiene columnas para ellos: es la identidad compartida
 * de toda la base, no la ficha comercial.
 *
 * La autorización se dice SIEMPRE, también cuando falta. Una línea
 * que diga «falta» es lo que hace que el asesor la pida en la primera
 * llamada; su ausencia se lee como «todo en orden».
 */
export function notaDelContacto(s: LoQueSeSupo): string {
  const lineas: string[] = [
    `Registrado a mano en el panel por ${s.registradoPor}.`,
  ];

  const organizacion = (s.organizacion ?? '').trim();
  if (organizacion) {
    lineas.push(
      s.nit
        ? `Organización: ${organizacion} (NIT ${s.nit}).`
        : `Organización: ${organizacion}.`,
    );
  }
  const cargo = (s.cargo ?? '').trim();
  if (cargo) lineas.push(`Cargo: ${cargo}.`);

  switch (s.constancia) {
    case 'REGISTRADA':
      lineas.push(
        `Autorizó el tratamiento de sus datos ${
          DICHO_DEL_CANAL[s.canal ?? CanalAutorizacion.VERBAL_ASESOR] ??
          DICHO_DEL_CANAL.VERBAL_ASESOR
        }; quedó la constancia.`,
      );
      break;
    case 'YA_TENIA':
      lineas.push(
        'Ya tenía autorizado el tratamiento de sus datos con la política vigente.',
      );
      break;
    case 'SIN_POLITICA':
      lineas.push(
        'Dijo que autorizaba el tratamiento de sus datos, pero esta línea de ' +
          'negocio no tiene política publicada y la constancia no se pudo dejar. ' +
          'Publíquela en Habeas Data y vuelva a pedírsela.',
      );
      break;
    case 'NO_DIJO':
      lineas.push(
        'FALTA su autorización para el tratamiento de datos: pídasela en la primera llamada.',
      );
      break;
  }

  if (s.loQueNoSePiso.length > 0) {
    lineas.push(
      `Esta persona ya estaba en el CRM y se conservó lo que tenía. No se guardó ${s.loQueNoSePiso.join(', ')}: confírmelo con ella.`,
    );
  }

  const nota = (s.nota ?? '').trim();
  if (nota) lineas.push('', nota);

  return lineas.join('\n');
}
