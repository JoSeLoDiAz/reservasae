/** La etiqueta de un lead sale de la llave, no de una cabecera. */

/**
 * EL AGUJERO QUE CIERRA, Y POR QUE ERA DE VERDAD.
 *
 * La puerta de conversaciones ya derivaba el proveedor de la llave
 * ---eso entro con Nua---, pero la de LEADS seguia leyendolo de
 * `x-origen-sistema`, una cabecera que elige quien llama. Y de ese
 * texto depende si el lead cuenta como PAUTA PAGADA, porque
 * `SISTEMAS_DE_PAUTA` casa por SUBCADENA contra 'meta', 'facebook',
 * 'instagram', 'pauta' y 'ads'.
 *
 * O sea que cualquiera con la llave podia marcarse sus propios leads
 * como pagados escribiendo «ads» en una cabecera, y la metrica de
 * cuanto cuesta un inscrito dejaba de valer. Es literalmente lo que
 * `leads.service` prohibe por escrito: «Pagado u organico, y lo decide
 * QUIEN LO MANDA, no el cuerpo». Una cabecera es el cuerpo.
 */

import type { ExecutionContext } from '@nestjs/common';

import { etiquetaDeLeadDe, PROVEEDORES } from '../integraciones/proveedores';
import { LeadsController } from './leads.controller';
import { LlaveDeLeadsGuard, type PeticionDeLead } from './llave-de-leads.guard';
import { origenDeLead } from '../crm/origen-del-lead';

/// La lista del servicio, copiada aqui a proposito: si alla cambia,
/// este spec lo dice en vez de que la pauta deje de contarse sola.
const SISTEMAS_DE_PAUTA = ['meta', 'facebook', 'instagram', 'pauta', 'ads'];
const esPauta = (etiqueta: string) =>
  SISTEMAS_DE_PAUTA.some((x) => etiqueta.toLowerCase().includes(x));

describe('la etiqueta de un lead sale de la llave', () => {
  it('cada proveedor declara con qué etiqueta entran sus leads', () => {
    for (const p of PROVEEDORES) {
      expect(p.etiquetaDeLead).toBeTruthy();
      expect(etiquetaDeLeadDe(p.nombre)).toBe(p.etiquetaDeLead);
    }
    /// Y hay al menos dos: sin este aserto, renombrar `PROVEEDORES`
    /// dejaria el bucle sin recorrer nada y el spec en verde.
    expect(PROVEEDORES.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * LO DE LUCID CUENTA COMO PAUTA, y es decision de Josse (8 oct
   * 2026): esos leads entran por un anuncio de Facebook con «clic para
   * enviar mensaje».
   *
   * ESTE ES EL ASERTO QUE IMPORTA: ata el nombre de la etiqueta a su
   * CONSECUENCIA. Hoy `lucid-ads` cuenta como pagado porque contiene
   * «ads», que es frágil ---una subcadena---; si alguien la renombra a
   * `lucid` o a `whatsapp`, la pauta deja de contarse sin que nada
   * falle. Con esto, falla aqui.
   */
  it('la de Lucid se clasifica como pauta pagada', () => {
    expect(esPauta(etiquetaDeLeadDe('lucid'))).toBe(true);
  });

  /// Y la de Nua NO, porque no viene de un anuncio: es un chatbot al
  /// que la gente escribe. Si las dos fueran pauta, la distincion no
  /// estaria sujeta por nada.
  it('la de Nua no se clasifica como pauta', () => {
    expect(esPauta(etiquetaDeLeadDe('nua'))).toBe(false);
  });

  /**
   * Y LA TRICOTOMIA NO SE TOCA. `origenDeLead` deduce de
   * `OrigenParticipante` ---no de esta etiqueta--- y de ella depende
   * `autorizoAlRegistrarse`, o sea la constancia de que a la persona
   * se le enseño un formulario con la politica. Esa es la unica cosa
   * que hay que poder demostrar ante la ley, asi que la etiqueta de un
   * chatbot no puede fabricarla.
   */
  it('no le fabrica constancia de autorización a nadie', () => {
    expect(origenDeLead('WHATSAPP')).not.toBe('ORGANICO');
  });
});

/**
 * EL CABLE ENTRE EL GUARD Y EL CONTROLADOR, que es lo que de verdad
 * hace que la etiqueta salga de la llave.
 *
 * Se escribe porque una mutacion lo pidio: quitando
 * `req.proveedorDelLead = proveedor` del guard, los 540 tests seguian
 * en verde. O sea que el mecanismo entero ---la unica cosa que impide
 * que quien llama se marque sus leads como pauta--- no estaba sujeto
 * por nada. Es el «test que da confianza sin darla» de esta casa, y la
 * mutacion es lo unico que lo encuentra.
 */
describe('el cable entre la llave y la etiqueta', () => {
  const ENTORNO = {
    LEADS_WEBHOOK_SECRET: 'x'.repeat(48),
    LUCID_WEBHOOK_SECRET: 'y'.repeat(48),
  };

  const peticionCon = (clave: string) =>
    ({ headers: { 'x-clave-leads': clave } }) as unknown as PeticionDeLead;

  const contextoDe = (req: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

  /// El guard es el unico que ve la llave, asi que es el unico que
  /// puede decir de quien es.
  it('el guard marca la petición con el proveedor de la llave', () => {
    const req = peticionCon(ENTORNO.LUCID_WEBHOOK_SECRET);
    const antes = process.env.LUCID_WEBHOOK_SECRET;
    process.env.LUCID_WEBHOOK_SECRET = ENTORNO.LUCID_WEBHOOK_SECRET;
    try {
      expect(new LlaveDeLeadsGuard().canActivate(contextoDe(req))).toBe(true);
      expect(req.proveedorDelLead).toBe('lucid');
    } finally {
      if (antes === undefined) delete process.env.LUCID_WEBHOOK_SECRET;
      else process.env.LUCID_WEBHOOK_SECRET = antes;
    }
  });

  /// Y la del orquestador NO lo marca: esa sigue eligiendo por
  /// cabecera, que es correcto porque releva de varias procedencias.
  it('la llave del orquestador no marca proveedor', () => {
    const req = peticionCon(ENTORNO.LEADS_WEBHOOK_SECRET);
    const antes = process.env.LEADS_WEBHOOK_SECRET;
    process.env.LEADS_WEBHOOK_SECRET = ENTORNO.LEADS_WEBHOOK_SECRET;
    try {
      expect(new LlaveDeLeadsGuard().canActivate(contextoDe(req))).toBe(true);
      expect(req.proveedorDelLead).toBeUndefined();
    } finally {
      if (antes === undefined) delete process.env.LEADS_WEBHOOK_SECRET;
      else process.env.LEADS_WEBHOOK_SECRET = antes;
    }
  });

  /**
   * Y EL CONTROLADOR IGNORA LA CABECERA cuando la peticion viene
   * marcada. Este es el aserto que cierra el agujero: sin el, el guard
   * podria marcar bien y el controlador seguir leyendo
   * `x-origen-sistema`.
   */
  it('con proveedor marcado, la cabecera no manda', async () => {
    let recibido: string | null = null;
    const leads = {
      entra: (_dto: unknown, sistema: string) => {
        recibido = sistema;
        return Promise.resolve({ ok: true });
      },
    };
    const c = new LeadsController(leads as never);
    await c.entra(
      {} as never,
      /// quien llama intenta marcarse como pauta de Meta
      'meta-ads',
      'adecopria.reservasae.com',
      { proveedorDelLead: 'lucid' } as unknown as PeticionDeLead,
    );
    expect(recibido).toBe('lucid-ads');
  });

  /// Sin proveedor, la cabecera sigue mandando: es el camino del
  /// orquestador, que lleva meses entrando asi.
  it('sin proveedor, la cabecera sigue mandando', async () => {
    let recibido: string | null = null;
    const leads = {
      entra: (_dto: unknown, sistema: string) => {
        recibido = sistema;
        return Promise.resolve({ ok: true });
      },
    };
    const c = new LeadsController(leads as never);
    await c.entra({} as never, 'meta', 'adecopria.reservasae.com', {} as PeticionDeLead);
    expect(recibido).toBe('meta');
  });
});
