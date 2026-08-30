/** El buscador de verdad, en un navegador. */

/// Se abre Chrome COMO SE ARRANCA CHROME (el ejecutable, con su puerto
/// de depuración) y el código se le pega por CDP. No se abre con
/// Playwright: así el buscador no contesta «tráfico inusual».
///
/// Cambio de este port (portado del prototipo Python validado):
///   - esperarRespuesta() ya NO se conforma con que el texto deje de
///     crecer: espera a que aparezca la FICHA REAL (que exista «Razón
///     social»). Antes se quedaba con el estado intermedio «Buscando…»
///     y devolvía 0 campos de forma intermitente.
///   El reintento por corrida floja ahora lo hace la capa de consenso
///   (web.service consulta N veces), así que aquí no se reintenta solo.

import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright';

import { hayPantalla, rutaDelNavegador } from '../../comun/navegador';

import { leerFichaWeb } from './leer-ficha-web';
import { laPregunta, type ProveedorWeb, type RespuestaWeb } from './proveedor-web';

const MODO_IA = 'https://www.google.com/search';

function direccion(pregunta: string): string {
  const q = new URLSearchParams({ q: pregunta, udm: '50', hl: 'es' });
  return `${MODO_IA}?${q.toString()}`;
}

const ESPERA_MAXIMA = 100_000;
const QUIETO = 3500;
const CADA = 700;
const LARGO_MINIMO = 120;

const DONDE_RESPONDE = [
  '[data-subtree="aimc"]',
  '[data-async-context] [role="main"]',
  '#rcnt',
  '#main',
  'main',
  'body',
];

const CAJA_DE_SEGUIMIENTO = [
  'textarea[aria-label*="seguimiento" i]',
  'textarea[aria-label*="follow" i]',
  'textarea[placeholder*="pregunt" i]',
  'textarea[placeholder*="ask" i]',
  '[contenteditable="true"][role="textbox"]',
  'textarea',
];

const NO_NOS_DEJARON =
  /antes de continuar|before you continue|acepto|i agree|unusual traffic|tráfico inusual|no soy un robot|not a robot|recaptcha|consent\.google/i;

const PERFIL =
  process.env.WEB_NAVEGADOR_PERFIL ?? join(process.cwd(), '.perfil-buscador');

const ARRANQUE = 20_000;

function rutaDeChrome(): string | null {
  return rutaDelNavegador(process.env.WEB_NAVEGADOR_RUTA);
}

@Injectable()
export class ProveedorWebNavegador implements ProveedorWeb, OnModuleDestroy {
  private readonly log = new Logger('BuscadorWeb');
  private contexto: BrowserContext | null = null;
  private proceso: ChildProcess | null = null;
  private pegado = false;

  private async abrir(): Promise<BrowserContext> {
    if (this.contexto) return this.contexto;

    const donde = process.env.WEB_NAVEGADOR_CDP ?? (await this.arrancar());
    const navegador = await chromium.connectOverCDP(donde);

    const suyo = navegador.contexts()[0];
    if (!suyo) throw new Error(`No hay ninguna ventana abierta en ${donde}.`);

    this.contexto = suyo;
    this.pegado = Boolean(process.env.WEB_NAVEGADOR_CDP) || !this.proceso;
    return suyo;
  }

  private async arrancar(): Promise<string> {
    const puerto = Number(process.env.WEB_NAVEGADOR_PUERTO ?? 9222);
    const donde = `http://127.0.0.1:${puerto}`;

    if (await this.contesta(donde)) {
      this.log.log(`Ya había un Chrome en ${donde}: se usa ese.`);
      return donde;
    }

    const chrome = rutaDeChrome();
    if (!chrome) {
      throw new Error(
        'No encontré Chrome instalado. Póngale la ruta en ' +
          'WEB_NAVEGADOR_RUTA, o abra Chrome con ' +
          `--remote-debugging-port=${puerto} y póngalo en WEB_NAVEGADOR_CDP.`,
      );
    }

    /// Sin `--headless`, y fuera de la pantalla: existe y dibuja (el
    /// buscador no la rechaza como headless) pero nadie la ve.
    const escondido = ['--window-position=-32000,-32000', '--window-size=1400,1000'];

    const conPantalla = hayPantalla();
    if (!conPantalla) {
      this.log.warn(
        'No hay pantalla: el navegador va a arrancar oculto, y el buscador ' +
          'suele rechazar eso con «tráfico inusual». En un servidor use ' +
          'WEB_PROVEEDOR=API, o levante una pantalla virtual con WEB_CON_CABEZA=1.',
      );
    }

    const enContenedor =
      process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];

    this.proceso = spawn(
      chrome,
      [
        `--remote-debugging-port=${puerto}`,
        `--user-data-dir=${PERFIL}`,
        '--no-first-run',
        '--no-default-browser-check',
        ...enContenedor,
        ...(conPantalla ? [] : ['--headless=new']),
        ...(conPantalla && process.env.WEB_CON_CABEZA !== '1' ? escondido : []),
        'about:blank',
      ],
      { detached: false, stdio: 'ignore' },
    );
    this.proceso.on('error', (e) => this.log.error(`No pude arrancar Chrome: ${e.message}`));

    const hasta = Date.now() + ARRANQUE;
    while (Date.now() < hasta) {
      if (await this.contesta(donde)) {
        this.log.log(`Chrome arrancado en ${donde}.`);
        return donde;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    throw new Error(`Chrome no abrió el puerto ${puerto} a tiempo.`);
  }

  private async contesta(donde: string): Promise<boolean> {
    try {
      const r = await fetch(`${donde}/json/version`, { signal: AbortSignal.timeout(1500) });
      return r.ok;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.pegado) return;
    await this.contexto?.close().catch(() => undefined);
    this.proceso?.kill();
  }

  async consultar(nit: string): Promise<RespuestaWeb> {
    let pagina: Page | undefined;
    try {
      const contexto = await this.abrir();
      pagina = await contexto.newPage();
      return await this.preguntar(pagina, nit);
    } catch (e) {
      /// Que el buscador no conteste NO es «no existe»: la cola reintenta.
      const razon = e instanceof Error ? e.message : String(e);
      this.log.warn(`El buscador no respondió (NIT ${nit}): ${razon}`);
      return { estado: 'FALLO', error: razon.slice(0, 300) };
    } finally {
      await pagina?.close().catch(() => undefined);
    }
  }

  private async preguntar(pagina: Page, nit: string): Promise<RespuestaWeb> {
    const pregunta = laPregunta(nit);
    await pagina.goto(direccion(pregunta), { timeout: 45_000, waitUntil: 'domcontentloaded' });

    const primera = await this.esperarRespuesta(pagina, pregunta);
    if (primera.muro) return this.muro(nit, primera.texto);

    let texto = this.sinEco(primera.texto, pregunta);

    // ¿contestó en prosa, sin las etiquetas? se vuelve a pedir por la caja.
    if (!leerFichaWeb(texto).razonSocial) {
      this.log.log(`NIT ${nit}: contestó sin etiquetas, se lo pido de nuevo.`);
      if (await this.preguntarDeNuevo(pagina, pregunta)) {
        const otra = await this.esperarRespuesta(pagina, pregunta, primera.texto.length);
        if (otra.muro) return this.muro(nit, otra.texto);
        const limpia = this.sinEco(otra.texto, pregunta);
        if (leerFichaWeb(limpia).razonSocial) texto = limpia;
      }
    }

    if (texto.length < LARGO_MINIMO) {
      return { estado: 'SIN_RESULTADO', crudo: texto };
    }

    const ficha = leerFichaWeb(texto);
    if (!ficha.razonSocial) {
      this.log.warn(`NIT ${nit}: contestó pero sin razón social. Texto: ${texto.slice(0, 160)}`);
      return { estado: 'SIN_RESULTADO', crudo: texto };
    }

    return { estado: 'ENCONTRADO', ficha, crudo: texto };
  }

  private muro(nit: string, texto: string): RespuestaWeb {
    this.log.warn(
      `NIT ${nit}: el buscador pidió aceptar algo o verificar que no somos un ` +
        'robot. Se puede resolver una vez a mano con WEB_CON_CABEZA=1.',
    );
    return {
      estado: 'FALLO',
      error:
        'El buscador no dejó pasar: pide aceptar condiciones o verificar que ' +
        'no es un robot. ' +
        texto.slice(0, 120),
    };
  }

  /**
   * Espera a que aparezca la FICHA REAL, no el estado «Buscando…».
   *
   * El Modo IA muestra «Buscando…» varios segundos (texto quieto) antes
   * de escribir la ficha. Por eso no basta con que el texto deje de
   * crecer: se espera a que exista «Razón social» (ficha de verdad) Y el
   * texto lleve un rato sin crecer.
   */
  private async esperarRespuesta(
    pagina: Page,
    pregunta: string,
    largoPrevio = 0,
  ): Promise<{ texto: string; muro: boolean }> {
    const hasta = Date.now() + ESPERA_MAXIMA;
    let mejor = '';
    let ultimoCambio = Date.now();
    let visto = false;

    while (Date.now() < hasta) {
      const texto = await this.leer(pagina);

      if (NO_NOS_DEJARON.test(texto.slice(0, 600))) {
        return { texto, muro: true };
      }

      // ¿ya apareció la ficha de verdad? (miramos el texto sin el eco)
      if (leerFichaWeb(this.sinEco(texto, pregunta)).razonSocial) visto = true;

      if (texto.length > mejor.length) {
        mejor = texto;
        ultimoCambio = Date.now();
      }

      const yaCrecio = mejor.length > largoPrevio + LARGO_MINIMO;
      if (visto && yaCrecio && Date.now() - ultimoCambio > QUIETO) break;

      await pagina.waitForTimeout(CADA);
    }

    return { texto: mejor, muro: false };
  }

  private sinEco(texto: string, pregunta: string): string {
    const final = pregunta.slice(-45).trim();
    const donde = texto.lastIndexOf(final);
    if (donde < 0) return texto;
    return texto.slice(donde + final.length).trim();
  }

  private async leer(pagina: Page): Promise<string> {
    for (const donde of DONDE_RESPONDE) {
      const trozo = pagina.locator(donde).first();
      const texto = await trozo.innerText({ timeout: 2000 }).catch(() => '');
      if (texto.trim().length >= LARGO_MINIMO) return texto.trim();
    }
    return '';
  }

  private async preguntarDeNuevo(pagina: Page, pregunta: string): Promise<boolean> {
    for (const sel of CAJA_DE_SEGUIMIENTO) {
      const caja = pagina.locator(sel).last();
      if ((await caja.count()) === 0) continue;
      if (!(await caja.isVisible().catch(() => false))) continue;

      try {
        await caja.click({ timeout: 3000 });
        await caja.fill(pregunta, { timeout: 3000 });
        await caja.press('Enter');
        return true;
      } catch {
        // esa no era: se prueba la siguiente
      }
    }
    return false;
  }
}
