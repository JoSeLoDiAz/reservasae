/**
 * ¿SIGUE PUESTO CADA ARREGLO DEL 7 DE OCTUBRE?
 *
 * «Cuántos cambios eran… ¿y ahora de la nada es ya de verdad?»
 * (cliente, 7 oct 2026).
 *
 * Que las pruebas pasen dice que nada se rompió. NO dice que cada cosa
 * que se pidió siga puesta: una fusión mal resuelta puede borrar un
 * arreglo sin que ninguna prueba se queje, porque la prueba se va con
 * él.
 *
 * Esto abre los ficheros y busca la huella de cada arreglo, uno por
 * uno. Es deliberadamente tonto ---busca texto--- y por eso sirve: no
 * comparte nada con el código que comprueba.
 *
 * SOLO LEE.
 *
 *   pnpm db:sigue-puesto
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

type Arreglo = {
  que: string;
  /// Lo que el cliente notaría si esto desapareciera.
  siFalta: string;
  fichero: string;
  /// Todas tienen que aparecer.
  busca: string[];
  /// Y ninguna de estas puede aparecer.
  noDebeHaber?: string[];
};

const ARREGLOS: Arreglo[] = [
  {
    que: 'Excel no convierte un documento en 1,20E+17',
    siFalta: 'Los documentos largos vuelven a salir en notación científica',
    fichero: 'frontend/src/lib/celda-de-excel.ts',
    busca: ['excelLoVaAEstropear', 'celdaParaExcel'],
  },
  {
    que: 'La conversión es inscritos sobre la META',
    siFalta: 'El porcentaje vuelve a salir sobre los leads',
    fichero: 'frontend/src/lib/cumplimiento.ts',
    busca: ['cumplimiento'],
  },
  {
    que: 'Los cupos reservados respetan el periodo',
    siFalta: 'Con «Ayer» la columna vuelve a dar el total de siempre',
    fichero: 'backend/src/crm/resumen-por-accion.ts',
    busca: ['seReservoEnLaVentana', 'res."creadoEn" >=', 'res."creadoEn" <'],
  },
  {
    que: 'Solo cuenta quien SIGUE inscrito',
    siFalta: 'Vuelve a contar a quien se inscribió y luego desertó',
    fichero: 'backend/src/crm/resumen-por-accion.ts',
    busca: ['pa."etapa"::text IN'],
    noDebeHaber: ['aunque despues desertara', 'Sin mirar la'],
  },
  {
    que: 'Los leads por organización en Reservas llevan periodo',
    siFalta: 'La fila mezcla cupos de ayer con leads de toda la vida',
    fichero: 'backend/src/tableros/reservas-agrupadas.ts',
    busca: ['llegoEnLaVentana', 'p."creadoEn" >='],
  },
  {
    que: 'La asesora que trabajó fichas viejas tiene fila',
    siFalta: 'Su día de trabajo desaparece de Seguimiento de asesores',
    fichero: 'backend/src/crm/asesores-datos.ts',
    busca: ['nombrePorAsesor', 'por.has(id)'],
  },
  {
    que: 'El Resumen General dibuja la acción sin leads nuevos',
    siFalta: 'Dice menos inscritos que la tabla de abajo de la misma pantalla',
    fichero: 'backend/src/crm/resumen-general.ts',
    busca: ['rotulos?.get(id)', 'porAccion.has(id)'],
  },
  {
    que: 'El jefe directo llega a la organización',
    siFalta: 'Las fichas se quedan en «Interesado» aunque la empresa lo escriba',
    fichero: 'backend/src/reservas/reservas.service.ts',
    busca: ['contactoNombre'],
  },
  {
    que: 'El aviso dice QUÉ falta',
    siFalta: 'Vuelve a decir «completó sus datos» sin explicar por qué no avanzó',
    fichero: 'backend/src/preinscripcion/preinscripcion.service.ts',
    busca: ['conLoQueFalte'],
  },
  {
    que: 'Departamento y Ciudad en BBDD Leads',
    siFalta: 'El dato se carga y no se ve por ninguna parte',
    fichero: 'frontend/src/components/admin/columnas-de-lead.tsx',
    busca: ['clave: "departamento"', 'clave: "ciudad"'],
  },
  {
    que: 'El servidor manda el departamento del lead',
    siFalta: 'La columna sale siempre en raya',
    fichero: 'backend/src/leads/mesa-de-entrada.service.ts',
    busca: ['departamento: l.departamentoSepId', 'ciudad: l.municipioSepId'],
  },
  {
    que: 'Se puede marcar y asignar en BBDD Leads',
    siFalta: 'Hay que abrir los leads de uno en uno para repartirlos',
    fichero: 'frontend/src/app/admin/bbdd-leads/page.tsx',
    busca: ['seleccion', 'accionesLote', 'mesaApi.asignar('],
  },
  {
    que: 'Se dice que solo Gestor y Líder de Inscripciones reciben',
    siFalta: 'Parece que el desplegable está roto porque faltan asesores',
    fichero: 'frontend/src/app/admin/bbdd-leads/page.tsx',
    busca: ['Solo Gestor y Líder de Inscripciones'],
  },
  {
    que: 'El renglón de ayuda de los dos buscadores',
    siFalta: 'Se busca a alguien que SÍ está y la tabla dice que no hay nadie',
    fichero: 'frontend/src/app/admin/bbdd-leads/page.tsx',
    busca: ['filtra solo las'],
  },
  {
    que: 'El foro se reconoce en el formulario público',
    siFalta: 'La pantalla dice que solo puede inscribirse en una, y es mentira',
    fichero: 'frontend/src/components/preinscripcion.tsx',
    busca: ['esForo', 'La única excepción es', 'Foro · se suma a otra'],
  },
  {
    que: 'El formulario NO promete un foro que el panel niega',
    siFalta: 'A quien elige AF3 se le promete algo que después se le niega',
    fichero: 'frontend/src/components/preinscripcion.tsx',
    busca: ['combinaConAccionId === b.id'],
  },
  {
    que: 'Nada de la fila del Excel se tira',
    siFalta: 'Las columnas que el sistema no entiende se pierden para siempre',
    fichero: 'backend/src/leads/cargue/lector-del-cargue.ts',
    busca: ['extras: Record<string, string>', 'cabecera.extras'],
  },
  {
    que: 'El género se carga',
    siFalta: 'Su columna de género cae entre las «sin reconocer»',
    fichero: 'backend/src/leads/cargue/columnas-del-cargue.ts',
    busca: ["clave: 'genero'", "'sexo'"],
  },
  {
    que: '«En formación» vuelve a la ficha',
    siFalta: 'No se puede registrar un ingreso tardío ni una matrícula adelantada',
    fichero: 'frontend/src/lib/crm-api.ts',
    busca: ['"EN_FORMACION"'],
  },
  {
    que: 'Publicar y Borrar no se ofrecen a quien no puede',
    siFalta: 'Se pulsa el botón y sale un error después del clic',
    fichero: 'frontend/src/app/admin/formularios/[id]/page.tsx',
    busca: ['esSuperadmin', 'borraSecciones'],
  },
  {
    que: 'El editor de formularios ya no se cuelga',
    siFalta: 'Quien no es superadministrador ve esqueletos grises para siempre',
    fichero: 'frontend/src/app/admin/formularios/[id]/page.tsx',
    busca: ['return error ? ('],
  },
  {
    que: 'Usuarios ya no revienta sin recoger el fallo',
    siFalta: 'La pantalla se queda a medias sin decir por qué',
    fichero: 'frontend/src/app/admin/usuarios/page.tsx',
    busca: ['void cargar().catch'],
  },
  {
    que: 'El detector de brechas mira `exporta`',
    siFalta: 'Denuncia para siempre una brecha que ya está cerrada',
    fichero: 'backend/prisma/brechas.ts',
    busca: ['exporta:\\s*\\(f\\)'],
  },
];

function main() {
  console.log('\n═══ ¿SIGUE PUESTO CADA ARREGLO? ═══\n');
  let fallan = 0;

  for (const a of ARREGLOS) {
    let texto = '';
    try {
      texto = readFileSync(join(RAIZ, a.fichero), 'utf8');
    } catch {
      console.log(`  ✗ ${a.que}\n      NO EXISTE EL FICHERO: ${a.fichero}`);
      fallan += 1;
      continue;
    }

    const faltan = a.busca.filter((b) => !texto.includes(b));
    const sobran = (a.noDebeHaber ?? []).filter((b) => texto.includes(b));

    if (faltan.length === 0 && sobran.length === 0) {
      console.log(`  ✓ ${a.que}`);
    } else {
      fallan += 1;
      console.log(`  ✗ ${a.que}`);
      console.log(`      Si falta: ${a.siFalta}`);
      if (faltan.length) console.log(`      No encuentro: ${faltan.join(' · ')}`);
      if (sobran.length) console.log(`      Volvio lo viejo: ${sobran.join(' · ')}`);
    }
  }

  console.log(
    `\n  ARREGLOS COMPROBADOS: ${ARREGLOS.length}` +
      `\n  PUESTOS: ${ARREGLOS.length - fallan}` +
      `\n  PERDIDOS: ${fallan}\n`,
  );
  if (fallan > 0) process.exit(1);
}

main();
