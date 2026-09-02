/** Lo que la persona MARCÓ manda sobre la puerta por la que entró. */

/**
 * `LeadEntrante.aceptaHabeasData` se declaraba en el DTO, se
 * guardaba en la base y NO LO LEÍA NADIE. La constancia salía del
 * origen y de nada más, así que un lead de Facebook con la casilla
 * sin marcar recibía igualmente una `AutorizacionDatos` con canal
 * FORMULARIO_WEB y evidencia apuntando a una carga que decía lo
 * contrario.
 *
 * Es el peor de los dos errores posibles, y CLAUDE.md ya lo tenía
 * escrito con estas palabras: «una prueba falsa es peor que
 * ninguna — la que falta BLOQUEA el reporte al SENA; la falsa lo
 * ABRE». Una ficha así entra al .xlsx que se le sube al SENA y es
 * indistinguible de una buena salvo abriendo el JSON de la carga.
 *
 * Lo encontró una revisión adversarial sobre OTRO encargo — el de
 * los leads sin documento —, que es como se encuentran estos.
 */

import { autorizoAlRegistrarse } from './listo-para-ficha';

import type { OrigenParticipante } from '../../generated/prisma';

const PAUTA = 'FACEBOOK' as OrigenParticipante;
const ORGANICO = 'AUTOGESTION' as OrigenParticipante;
const NI_UNO_NI_OTRO = 'WHATSAPP' as OrigenParticipante;

describe('un NO explícito nunca produce constancia', () => {
  it('de una pauta, con la casilla sin marcar, NO autoriza', () => {
    expect(autorizoAlRegistrarse(PAUTA, false)).toBe(false);
  });

  it('ni siquiera por la puerta orgánica', () => {
    /// Las dos puertas que producían constancia, para que el
    /// arreglo no cierre solo una.
    expect(autorizoAlRegistrarse(ORGANICO, false)).toBe(false);
  });
});

describe('un SÍ explícito autoriza donde ya autorizaba', () => {
  it('marcada y de una pauta, autoriza', () => {
    expect(autorizoAlRegistrarse(PAUTA, true)).toBe(true);
  });

  it('pero marcarla NO abre una puerta que estaba cerrada', () => {
    /// A quien escribió por WhatsApp nadie le enseñó un texto.
    /// Que el emisor mande `true` no convierte eso en una
    /// autorización: la casilla acota, no concede.
    expect(autorizoAlRegistrarse(NI_UNO_NI_OTRO, true)).toBe(false);
  });
});

describe('null es «el emisor no lo manda», no «dijo que no»', () => {
  it('sin el campo, se conserva lo de antes', () => {
    /// Vale el argumento escrito: el formulario no se puede
    /// enviar sin aceptar la política, así que el propio registro
    /// es la prueba. Tratarlo como un NO dejaría sin constancia a
    /// todo emisor que no mande el campo -- incluido el
    /// orquestador, que hoy no lo manda -- y eso BLOQUEA el
    /// reporte en vez de falsearlo.
    expect(autorizoAlRegistrarse(PAUTA, null)).toBe(true);
    expect(autorizoAlRegistrarse(PAUTA, undefined)).toBe(true);
    expect(autorizoAlRegistrarse(PAUTA)).toBe(true);
  });

  it('y sigue sin autorizar lo que nunca autorizó', () => {
    expect(autorizoAlRegistrarse(NI_UNO_NI_OTRO, null)).toBe(false);
  });
});

describe('los tres valores son TRES, no dos', () => {
  it('false y null NO dan lo mismo', () => {
    /// Es el aserto que sujeta el arreglo entero: si alguien
    /// «simplifica» a `!!aceptaHabeasData`, null pasaría a ser un
    /// NO y el reporte se bloquearía en silencio para todos.
    expect(autorizoAlRegistrarse(PAUTA, false)).toBe(false);
    expect(autorizoAlRegistrarse(PAUTA, null)).toBe(true);
  });
});
