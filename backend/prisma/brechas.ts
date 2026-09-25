/**
 * EL AVISO DE BRECHAS, justo después de migrar.
 *
 * «Cuando empiece a actualizar que le salte esto después de migrar los
 * cambios, que esto no se le olvide» (cliente, 25 sep 2026).
 *
 * Va enganchado a `prisma:deploy`, detrás de `migrate deploy`: el
 * momento en que alguien despliega es el único en que se está mirando
 * la consola del servidor con atención, y es justo cuando hay que
 * decirle qué sigue abierto.
 *
 * NO LEE UNA LISTA: MIRA EL CÓDIGO.
 *
 * Y esa es toda la idea. Un recordatorio escrito a mano envejece ---mi
 * propia lista daba `MESA-02` por vivo y llevaba días cerrado--- y
 * acaba siendo ruido que se salta. Cada brecha de aquí trae un
 * detector que abre el fichero y comprueba si sigue ahí: **el día que
 * José la cierre, desaparece sola del aviso**. Sin tocar este fichero,
 * sin acordarse de borrar nada.
 *
 * NO ROMPE EL DESPLIEGUE. Sale con código 0 siempre. Un despliegue que
 * falla por un aviso se desactiva el mismo día, y entonces el aviso no
 * sirve para nada.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

const leer = (ruta: string): string => {
  try {
    return readFileSync(join(RAIZ, ruta), 'utf8');
  } catch {
    return '';
  }
};

/** El cuerpo de una función o decorador, desde donde aparece. */
const desde = (texto: string, aguja: string, renglones: number): string => {
  const i = texto.indexOf(aguja);
  if (i < 0) return '';
  return texto.slice(i).split('\n').slice(0, renglones).join('\n');
};

type Brecha = {
  id: string;
  titulo: string;
  impacto: string;
  arreglo: string;
  donde: string;
  /** true = sigue abierta. */
  abierta: () => boolean;
};

const BRECHAS: Brecha[] = [
  {
    id: 'B-01',
    titulo: 'El control de reparto de leads se salta por la puerta de editar',
    impacto:
      'Un gestor puede pasarse fichas a sí mismo o quitárselas a otro, de una en una.\n' +
      'Con eso, «quién lleva este lead» deja de ser un dato fiable, y con él toda la\n' +
      'tabla de Seguimiento de asesores, que es la que dice quién va mal.',
    arreglo:
      "Exigir `conveniosQueReparten` en `@Patch(':id')` cuando el cuerpo traiga `asesorId`,\n" +
      'con el mismo mensaje que ya da el reparto por lotes.',
    donde: 'backend/src/crm/crm.controller.ts',
    abierta: () => {
      const t = leer('src/crm/crm.controller.ts');
      if (!t) return false;
      return !desde(t, "@Patch(':id')\n", 20).includes('conveniosQueReparten');
    },
  },
  {
    id: 'A-08',
    titulo: 'Dos entradas en el mismo instante crean dos leads',
    impacto:
      'Es exactamente lo que hacen los reintentos de Meta. La misma persona entra dos\n' +
      'veces y dos asesores la llaman. La comprobación previa no basta: entre el\n' +
      'SELECT y el INSERT caben los dos.',
    arreglo:
      'Capturar `P2002` en el `create`, releer y devolver `{ ...vista, repetido: true }`,\n' +
      'que es lo que ya devuelve la rama de arriba.',
    donde: 'backend/src/leads/leads.service.ts',
    abierta: () => {
      const t = leer('src/leads/leads.service.ts');
      if (!t) return false;
      return !t.includes('P2002');
    },
  },
  {
    id: 'B-03',
    titulo: 'Se puede mover de acción de formación a alguien ya certificado',
    impacto:
      'El certificado de una persona deja de corresponder con lo que cursó.\n' +
      'No es un defecto de pantalla: es lo que se le reporta al SENA.',
    arreglo:
      'Rechazar en `asignar()` si la etapa es terminal (CERTIFICADO, RETIRADO, NO_APROBO).\n' +
      'Si hay que poder corregir un error de asignación, que sea otra puerta con su permiso.',
    donde: 'backend/src/crm/crm.service.ts · asignar()',
    abierta: () => {
      const t = leer('src/crm/crm.service.ts');
      if (!t) return false;
      return !desde(t, 'async asignar(', 130).includes('CERTIFICADO');
    },
  },
  {
    id: 'B-08',
    titulo: 'La puerta PÚBLICA no valida el documento',
    impacto:
      'Una cédula con letras entra por el formulario público ---la puerta por la que\n' +
      'entra más gente--- y de ahí sale al cargue del SENA. Las otras siete puertas\n' +
      'del backend sí la validan; esta no.',
    arreglo:
      'Llamar a `documentoValido(tipo, numero)` donde ya se normaliza, y devolver el 400\n' +
      'con el mismo texto que las demás.',
    donde: 'backend/src/preinscripcion/preinscripcion.service.ts',
    abierta: () => {
      const t = leer('src/preinscripcion/preinscripcion.service.ts');
      if (!t) return false;
      return !t.includes('documentoValido');
    },
  },
  {
    id: 'A-15',
    titulo: 'La rama firme del webhook no marca `procesadoEn`',
    impacto:
      'Es el camino MÁS recorrido de los cuatro. Todo lo que se apoye en `procesadoEn`\n' +
      '---una cola, un reintento, un informe de «qué queda»--- ve esos leads como\n' +
      'pendientes para siempre.',
    arreglo: 'Añadir `procesadoEn: new Date()` al `update` de la rama `coincide.firme`.',
    donde: 'backend/src/leads/leads.service.ts',
    abierta: () => {
      const t = leer('src/leads/leads.service.ts');
      if (!t) return false;
      return !desde(t, 'coincide.firme', 14).includes('procesadoEn');
    },
  },
  {
    id: 'B-14',
    titulo: 'Crear ficha por la puerta pública no deja auditoría',
    impacto:
      'De los dos sitios del backend que crean un participante, solo uno deja huella.\n' +
      'El agujero está justo en la puerta que más fichas crea, así que «de dónde salió\n' +
      'esta ficha» no siempre tiene respuesta.',
    arreglo: "Emitir `PARTICIPANTE_CREADO` igual que en `crm.crear()`, con el autor puesto a la puerta pública.",
    donde: 'backend/src/preinscripcion/preinscripcion.service.ts',
    abierta: () => {
      const t = leer('src/preinscripcion/preinscripcion.service.ts');
      if (!t) return false;
      return !t.includes('PARTICIPANTE_CREADO');
    },
  },
  {
    id: 'LMS',
    titulo: 'NADIE escribe el avance del aula, y sin él no se certifica',
    impacto:
      'Seguimiento académico y Seguimiento del aula leen `actividades` y\n' +
      '`avances_actividad`. En producción esas tablas están vacías porque ningún\n' +
      'código las escribe. Con ellas vacías, `cambiarEtapa` IMPIDE CERTIFICAR A\n' +
      'CUALQUIERA ---y certificar es lo que paga el SENA---.',
    arreglo:
      'No se arregla con código: lo desbloquea el LMS. La pregunta exacta es\n' +
      '«¿pueden mandar, por persona y actividad, si está completada y cuándo?».\n' +
      'El modelo ya está y las pantallas ya saben leerlo.',
    donde: 'bloqueado fuera del equipo',
    abierta: () => {
      /// Se mira si ALGUIEN del código de aplicación las escribe. Las
      /// siembras de `prisma/` no cuentan: son de desarrollo, y son
      /// justo las que hacen creer que el dato existe.
      const t = leer('src/crm/crm.service.ts') + leer('src/crm/tablero-academico.ts');
      if (!t) return false;
      return !/avanceActividad\.(create|update|upsert|createMany)/.test(t);
    },
  },
  {
    id: 'SENA',
    titulo: 'Quien se retira DESAPARECE del cargue en vez de reportarse',
    impacto:
      'Las cuatro salidas ---no aprobó, desertó, abandonó, retirado--- están fuera de\n' +
      '`ETAPAS_DEL_REPORTE`. El SENA ve menos gente de la que hubo, sin explicación de\n' +
      'a dónde se fue.',
    arreglo:
      'El código ya dice dónde se añaden: son minutos. Falta la respuesta del SENA a\n' +
      '«¿qué valor espera la columna ESTADO para un retiro?». Poner cualquier cosa\n' +
      'arriesga el rechazo del cargue entero.',
    donde: 'backend/src/crm/etapas.ts',
    abierta: () => {
      const t = leer('src/crm/etapas.ts');
      if (!t) return false;
      return !desde(t, 'ETAPAS_DEL_REPORTE', 10).includes('RETIRADO');
    },
  },
];

/* ── el aviso ──────────────────────────────────────────────────── */

const ROJO = '\x1b[31m';
const AMARILLO = '\x1b[33m';
const VERDE = '\x1b[32m';
const NEGRITA = '\x1b[1m';
const APAGA = '\x1b[0m';

const RAYA = '═'.repeat(78);

function main() {
  const abiertas = BRECHAS.filter((b) => b.abierta());
  const cerradas = BRECHAS.length - abiertas.length;

  console.log('');
  if (abiertas.length === 0) {
    console.log(`${VERDE}${NEGRITA}${RAYA}${APAGA}`);
    console.log(`${VERDE}${NEGRITA}  NO QUEDA NINGUNA BRECHA ABIERTA. Las ${BRECHAS.length} están cerradas.${APAGA}`);
    console.log(`${VERDE}${NEGRITA}${RAYA}${APAGA}\n`);
    return;
  }

  console.log(`${ROJO}${NEGRITA}${RAYA}${APAGA}`);
  console.log(
    `${ROJO}${NEGRITA}  MIGRACIÓN APLICADA. QUEDAN ${abiertas.length} BRECHAS ABIERTAS EN ESTE CÓDIGO.${APAGA}`,
  );
  console.log(`${ROJO}${NEGRITA}${RAYA}${APAGA}`);
  console.log(
    `  Esto no lo lee de una lista: abre los ficheros y lo comprueba.\n` +
      `  El día que se cierre una, desaparece sola de este aviso.\n` +
      (cerradas > 0 ? `  Ya cerradas y comprobadas: ${cerradas}.\n` : ''),
  );

  for (const b of abiertas) {
    console.log(`${ROJO}${NEGRITA}  ── ${b.id} · ${b.titulo}${APAGA}`);
    console.log(`     ${AMARILLO}Dónde:${APAGA}   ${b.donde}`);
    console.log(`     ${AMARILLO}Impacto:${APAGA}`);
    for (const l of b.impacto.split('\n')) console.log(`       ${l}`);
    console.log(`     ${AMARILLO}Arreglo:${APAGA}`);
    for (const l of b.arreglo.split('\n')) console.log(`       ${l}`);
    console.log('');
  }

  console.log(`${ROJO}${NEGRITA}${RAYA}${APAGA}`);
  console.log(
    `  El detalle, con la prueba de cómo se comprobó cada una:\n` +
      `  ${NEGRITA}docs/BRECHAS-PARA-JOSE.md${APAGA}`,
  );
  console.log(`${ROJO}${NEGRITA}${RAYA}${APAGA}\n`);

  /// SALE CON 0 A PROPÓSITO: un despliegue que falla por un aviso se
  /// desactiva el mismo día, y entonces el aviso no sirve de nada.
}

main();
