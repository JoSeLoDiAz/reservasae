/** Catorce leads para la mesa de entrada, siete por gremio. */

/**
 * VAN POR EL WEBHOOK, no escritos a mano en la tabla.
 *
 * Es la puerta de verdad —la que llama el orquestador de Mauricio
 * y por la que entra la pauta de Meta—, así que sembrarlos por ahí
 * prueba de paso que funciona: la llave, la resolución del gremio
 * por el subdominio, la normalización del celular, el cruce con
 * las personas que ya existen y la deducción de la sede. Escribir
 * `leads_entrantes` con un INSERT daría filas que ningún lead real
 * podría producir — datos de prueba que no prueban el camino.
 *
 * Y son CASOS, no catorce filas iguales. Cada uno cae en una rama
 * distinta de lo que la mesa tiene que saber decir:
 *
 *   · completo y convertible de una
 *   · sin documento, que es el lead normal de una pauta
 *   · con curso que su departamento no dicta
 *   · con un texto de interés que no casa con ningún curso
 *   · con la cédula de alguien que ya está en el CRM
 *   · sin autorización de datos
 *   · sin correo, solo celular
 *   · con el nombre entero sin partir
 *   · con la ubicación por código DANE
 *   · con la sede distinta de donde vive
 *   · repetido, para que se vea la idempotencia
 *   · con el documento mal escrito
 */

/// Lo que se le manda al webhook por cada lead.
export type LeadDemo = {
  gremio: 'adecopria' | 'britcham-adee';
  /// Para qué está aquí. Sale en el informe del guión.
  caso: string;
  /// Cuántas veces se manda. Dos = se prueba el repetido.
  veces?: number;
  cuerpo: Record<string, unknown>;
};

export const LEADS: LeadDemo[] = [
  // ── ADECOPRIA ──
  {
    gremio: 'adecopria',
    caso: 'completo: se convierte de una',
    cuerpo: {
      externoId: 'mesa-adec-01',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      numeroDocumento: '1005993001',
      nombres: 'Luz Adriana',
      primerApellido: 'Serrano',
      segundoApellido: 'Pinilla',
      correo: 'luz.serrano@ejemplo.test',
      celular: '+57 317 455 0301',
      genero: 'Femenino',
      interes: 'AF1 — Gestión de la atención',
      departamento: 'SANTANDER',
      ciudad: 'BUCARAMANGA',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'sin documento: el lead normal de una pauta',
    cuerpo: {
      externoId: 'mesa-adec-02',
      origen: 'INSTAGRAM',
      nombres: 'Fabián',
      primerApellido: 'Ocampo',
      correo: 'fabian.ocampo@ejemplo.test',
      celular: '3174550302',
      genero: 'Masculino',
      interes: 'AF3 estrategias de escalamiento',
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'su departamento no tiene ese curso',
    cuerpo: {
      externoId: 'mesa-adec-03',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      numeroDocumento: '1005993003',
      nombres: 'Yulieth',
      primerApellido: 'Támara',
      correo: 'yulieth.tamara@ejemplo.test',
      celular: '3174550303',
      genero: 'Femenino',
      interes: 'AF1',
      departamento: 'SUCRE',
      ciudad: 'SINCELEJO',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'lo que pidió no casa con ningún curso',
    cuerpo: {
      externoId: 'mesa-adec-04',
      origen: 'REDES',
      tipoDocumento: 'CC',
      numeroDocumento: '1005993004',
      nombres: 'Gustavo',
      primerApellido: 'Lozano',
      correo: 'gustavo.lozano@ejemplo.test',
      celular: '3174550304',
      genero: 'Masculino',
      interes: 'quiero aprender inglés y sistemas',
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'trae la cédula de alguien que YA está en el CRM',
    cuerpo: {
      externoId: 'mesa-adec-05',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      /// La de Marta Vargas, sembrada en INTERESADO.
      numeroDocumento: '1005991001',
      nombres: 'Marta',
      primerApellido: 'Vargas',
      correo: 'marta.vargas.otro@ejemplo.test',
      celular: '3174550305',
      genero: 'Femenino',
      interes: 'AF7',
      departamento: 'SANTANDER',
      ciudad: 'BUCARAMANGA',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'NO autorizó el tratamiento de datos',
    cuerpo: {
      externoId: 'mesa-adec-06',
      origen: 'INSTAGRAM',
      tipoDocumento: 'CC',
      numeroDocumento: '1005993006',
      nombres: 'Ricardo',
      primerApellido: 'Cifuentes',
      correo: 'ricardo.cifuentes@ejemplo.test',
      celular: '3174550306',
      genero: 'Masculino',
      interes: 'AF5',
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
      aceptaHabeasData: false,
    },
  },
  {
    gremio: 'adecopria',
    caso: 'sin correo: solo celular, y escrito con espacios',
    cuerpo: {
      externoId: 'mesa-adec-07',
      origen: 'WHATSAPP',
      tipoDocumento: 'CC',
      numeroDocumento: '1005993007',
      nombres: 'Elkin',
      primerApellido: 'Zapata',
      celular: '57 317 455 03 07',
      genero: 'Masculino',
      interes: 'AF3',
      departamento: 'ANTIOQUIA',
      ciudad: 'APARTADÓ',
      aceptaHabeasData: true,
    },
  },
  // ── BRITCHAM ADEE ──
  {
    gremio: 'britcham-adee',
    caso: 'completo: se convierte de una',
    cuerpo: {
      externoId: 'mesa-brit-01',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      numeroDocumento: '1005994001',
      nombres: 'Andrea Carolina',
      primerApellido: 'Guerrero',
      segundoApellido: 'Lizarazo',
      correo: 'andrea.guerrero@ejemplo.test',
      celular: '3184550401',
      genero: 'Femenino',
      interes: 'AF1 — Gestión del cambio',
      departamento: 'BOGOTÁ D.C',
      ciudad: 'BOGOTÁ',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'el nombre entero sin partir',
    cuerpo: {
      externoId: 'mesa-brit-02',
      origen: 'INSTAGRAM',
      tipoDocumento: 'CC',
      numeroDocumento: '1005994002',
      nombreCompleto: 'José Manuel Barrios Fuentes',
      correo: 'jose.barrios@ejemplo.test',
      celular: '3184550402',
      genero: 'Masculino',
      interes: 'AF4',
      departamento: 'BOLÍVAR',
      ciudad: 'CARTAGENA',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'la ubicación por código DANE, no por nombre',
    cuerpo: {
      externoId: 'mesa-brit-03',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      numeroDocumento: '1005994003',
      nombres: 'Paola',
      primerApellido: 'Vanegas',
      correo: 'paola.vanegas@ejemplo.test',
      celular: '3184550403',
      genero: 'Femenino',
      interes: 'AF2',
      departamento: '11',
      ciudad: '11001',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'vive en un sitio y quiere la sede de otro',
    cuerpo: {
      externoId: 'mesa-brit-04',
      origen: 'REFERIDO',
      tipoDocumento: 'CC',
      numeroDocumento: '1005994004',
      nombres: 'Iván Darío',
      primerApellido: 'Ochoa',
      correo: 'ivan.ochoa@ejemplo.test',
      celular: '3184550404',
      genero: 'Masculino',
      interes: 'AF8',
      departamento: 'ANTIOQUIA',
      ciudad: 'MEDELLÍN',
      sede: 'MEDELLÍN',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'lo mínimo que se puede mandar: nombre y celular',
    cuerpo: {
      externoId: 'mesa-brit-05',
      origen: 'REDES',
      nombres: 'Marleny',
      primerApellido: 'Pabón',
      celular: '3184550405',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'repetido: llega dos veces y no se duplica',
    veces: 2,
    cuerpo: {
      externoId: 'mesa-brit-06',
      origen: 'FACEBOOK',
      tipoDocumento: 'CC',
      numeroDocumento: '1005994006',
      nombres: 'Édgar',
      primerApellido: 'Meneses',
      correo: 'edgar.meneses@ejemplo.test',
      celular: '3184550406',
      genero: 'Masculino',
      interes: 'AF3',
      departamento: 'SANTANDER',
      ciudad: 'BUCARAMANGA',
      aceptaHabeasData: true,
    },
  },
  {
    gremio: 'britcham-adee',
    caso: 'el documento viene mal escrito',
    cuerpo: {
      externoId: 'mesa-brit-07',
      origen: 'INSTAGRAM',
      tipoDocumento: 'CC',
      numeroDocumento: 'CC 1.234',
      nombres: 'Sonia',
      primerApellido: 'Delgado',
      correo: 'sonia.delgado@ejemplo.test',
      celular: '3184550407',
      genero: 'Femenino',
      interes: 'AF6',
      departamento: 'VALLE DEL CAUCA',
      ciudad: 'CALI',
      aceptaHabeasData: true,
    },
  },
];

/**
 * Los manda al webhook y cuenta qué contestó.
 *
 * No lanza si uno falla: se dice cuál y se sigue. Un guión de
 * siembra que se planta en el lead trece deja la mesa a medias y
 * sin decir en qué estado quedó.
 */
export async function sembrarLeads(base: string, clave: string) {
  const salida: Array<{ caso: string; estado: number; cuerpo: string }> = [];

  for (const l of LEADS) {
    for (let i = 0; i < (l.veces ?? 1); i++) {
      const r = await fetch(`${base}/api/webhooks/leads`, {
        method: 'POST',
        headers: {
          // el gremio va por el subdominio, como en produccion
          Host: `pre-${l.gremio}.reservasae.com`,
          'Content-Type': 'application/json',
          'x-clave-leads': clave,
        },
        body: JSON.stringify(l.cuerpo),
      });
      const texto = await r.text();
      salida.push({
        caso: `${l.gremio} · ${l.caso}${i > 0 ? ' (2.ª vez)' : ''}`,
        estado: r.status,
        cuerpo: texto.slice(0, 300),
      });
    }
  }

  return salida;
}
