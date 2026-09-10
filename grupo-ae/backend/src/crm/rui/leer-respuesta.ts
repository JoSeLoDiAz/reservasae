/** Sacar los datos del recuadro de respuesta del RUI. */

/// Se lee el TEXTO, no el HTML.
///
/// La version anterior buscaba el nombre por selectores de
/// estilo en linea -- `font-weight:800`, `color:#0f172a` --, y
/// eso se rompe en cuanto el DNP cambie un color. El texto que
/// se ve en pantalla aguanta un rediseno: mientras la ficha
/// siga diciendo la edad y la ciudad, esto las encuentra.
///
/// La forma del recuadro, sacada del portal:
///
///     JUAN CARLOS MARTINEZ GOMEZ
///     34 años · Masculino
///     Medellín — Antioquia
///
/// La edad y el genero van separados por `·`; la ciudad y el
/// departamento, por `—`.

export type RespuestaRui = {
  nombre: string | null;
  edad: number | null;
  genero: string | null;
  ciudad: string | null;
  departamento: string | null;
};

/// Lo que aparece en el recuadro y no es un dato: titulos,
/// etiquetas y el mensaje de espera.
const NO_ES_UN_DATO = [
  'resultado',
  'consultando',
  'clasificacion',
  'documento',
  'numero',
  'ventanilla',
  'rui',
];

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/// Por palabra completa y no por trozo: «RUIZ» contiene
/// «rui», y buscando subcadenas se descartaba uno de los
/// apellidos mas comunes de Colombia.
function esRuido(linea: string): boolean {
  const palabras = new Set(
    sinTildes(linea)
      .split(/[^\p{L}]+/u)
      .filter(Boolean),
  );
  return NO_ES_UN_DATO.some((x) => palabras.has(x));
}

/// Un nombre son letras y espacios. Sirve para no confundirlo
/// con «34 años» o con una fecha.
const PARECE_NOMBRE = /^[\p{L}\s'.-]{4,}$/u;

export function leerRespuesta(texto: string): RespuestaRui {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const salida: RespuestaRui = {
    nombre: null,
    edad: null,
    genero: null,
    ciudad: null,
    departamento: null,
  };

  for (const linea of lineas) {
    // «34 años · Masculino»
    if (linea.includes('·')) {
      const [izq, der] = linea.split('·').map((x) => x.trim());
      const digitos = izq?.match(/\d+/)?.[0];
      if (digitos) salida.edad = Number(digitos);
      if (der) salida.genero = der;
      continue;
    }

    // «Medellín — Antioquia»
    if (linea.includes('—')) {
      const [izq, der] = linea.split('—').map((x) => x.trim());
      if (izq) salida.ciudad = izq;
      if (der) salida.departamento = der;
      continue;
    }

    // el nombre: la primera linea que parece un nombre y no
    // es un titulo de la ficha
    if (!salida.nombre && !esRuido(linea) && PARECE_NOMBRE.test(linea)) {
      salida.nombre = linea;
    }
  }

  return salida;
}

/** Si el portal dijo que ese documento no está. */
export function documentoNoEncontrado(texto: string): boolean {
  const t = sinTildes(texto);
  return (
    t.includes('no encontrado') ||
    t.includes('no se encontro') ||
    t.includes('sin clasificacion')
  );
}

/** Si todavía está consultando. */
export function sigueConsultando(texto: string): boolean {
  return sinTildes(texto).includes('consultando');
}
