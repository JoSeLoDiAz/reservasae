/** A quien se le cuelga la conversacion, y cuando no se elige. */

/**
 * LA BISAGRA: la ambiguedad no cuesta lo mismo siempre.
 *
 * Caer en otra ficha DE LA MISMA PERSONA deja la conversacion en
 * su historial bajo el curso que no era. Visible y recuperable.
 * Caer en la ficha de OTRA PERSONA mete el resumen de un chat
 * --que puede traer cualquier cosa-- en el expediente de un
 * extrano, y las notas no se borran por diseno: «una correccion
 * es otra nota».
 *
 * Son dos errores distintos y aqui se tratan distinto. Es la
 * misma linea que `cruzar-con-el-crm.ts` ya dibuja con `firme`.
 *
 * Por eso NO se reusa el desempate de `elegirFicha`: alli elegir
 * mal deja una propuesta que un asesor revisa; aqui elegir mal
 * escribe historia.
 */

export type Candidato =
  | { tipo: 'FICHA'; id: string; personaId: string; creadoEn: Date }
  | { tipo: 'LEAD'; id: string; creadoEn: Date };

export type Destino =
  | { estado: 'PEGADA'; destino: Candidato; motivo: string }
  | { estado: 'SIN_DUENO'; motivo: string }
  | { estado: 'AMBIGUA'; motivo: string };

/**
 * Se cuentan PERSONAS distintas, no filas.
 *
 * Una persona con dos fichas es un solo dueno; dos personas con
 * el mismo numero no lo son. Contar filas metia en cuarentena a
 * quien esta en dos cursos, que es el caso normal del sistema.
 */
export function aQuienSePega(candidatos: Candidato[]): Destino {
  const fichas = candidatos.filter((c) => c.tipo === 'FICHA');
  const leads = candidatos.filter((c) => c.tipo === 'LEAD');

  if (!fichas.length && !leads.length) {
    return { estado: 'SIN_DUENO', motivo: 'Ese número no es de nadie del CRM.' };
  }

  const personas = new Set(fichas.map((f) => f.personaId));

  if (personas.size > 1) {
    return {
      estado: 'AMBIGUA',
      motivo: `Ese número está en ${personas.size} personas distintas.`,
    };
  }

  /// Una ficha Y un lead sueltos: casi siempre es la misma
  /// --vino por pauta y ademas se preinscribio-- pero «casi
  /// siempre» no es «indudable». Y la pregunta que deja abierta
  /// vale: resuelve un duplicado que nadie habia visto.
  if (personas.size === 1 && leads.length) {
    return {
      estado: 'AMBIGUA',
      motivo: 'Ese número está en un lead ya inscrito y además en uno sin convertir.',
    };
  }

  if (personas.size === 1) {
    /// La unica fila que se desempata, y se sostiene porque el
    /// error se queda dentro de la misma persona.
    const elegida = masReciente(fichas);
    return {
      estado: 'PEGADA',
      destino: elegida,
      motivo:
        fichas.length > 1
          ? `Esa persona tiene ${fichas.length} leads; va en el más reciente.`
          : 'Su lead.',
    };
  }

  if (leads.length > 1) {
    return {
      estado: 'AMBIGUA',
      motivo: `Ese número está en ${leads.length} leads sin convertir.`,
    };
  }

  return { estado: 'PEGADA', destino: leads[0], motivo: 'Su lead.' };
}

function masReciente(cs: Candidato[]): Candidato {
  return cs.reduce((a, b) => (b.creadoEn > a.creadoEn ? b : a));
}
