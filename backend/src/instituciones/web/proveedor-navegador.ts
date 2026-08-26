/** El buscador de verdad, en un navegador, como lo hace usted. */

/// Igual que el RUI: no hay API, hay una página. Se abre, se
/// pregunta, se lee el texto de la respuesta. Y como en el
/// RUI, lo que se lee es el TEXTO y no el HTML -- así un
/// cambio de colores no lo rompe. El que entiende la
/// respuesta es `leer-ficha-web.ts`, que ya está probado
/// contra las respuestas reales.
///
/// Los dos pasos son los que usted describió:
///   1. En la barra: CUAL ES EL NOMBRE PARA EL NIT 860031945
///   2. Modo IA, y ahí: DAME LA SIGUIENTE INFORMACIÓN: ...

import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright';

import { hayPantalla, rutaDelNavegador } from '../../comun/navegador';

import { leerFichaWeb } from './leer-ficha-web';
import {
  laPregunta,
  type ProveedorWeb,
  type RespuestaWeb,
} from './proveedor-web';

/// `udm=50` es el Modo IA. Es la misma pestaña que usted
/// pulsa, pedida por la dirección: llegar así evita depender
/// de que el botón se siga llamando «Modo IA» mañana.
const MODO_IA = 'https://www.google.com/search';

function direccion(pregunta: string): string {
  const q = new URLSearchParams({ q: pregunta, udm: '50', hl: 'es' });
  return `${MODO_IA}?${q.toString()}`;
}

/// Cuánto se espera a que termine de escribir. La respuesta
/// llega de a poquitos, así que no se puede leer apenas
/// aparece: se espera a que DEJE de crecer.
const ESPERA_MAXIMA = 90_000;
const QUIETO = 2500;
const CADA = 700;

/// Lo mínimo para creer que contestó algo y no es un aviso.
const LARGO_MINIMO = 120;

/// Donde la respuesta puede estar escrita. Se prueban en
/// orden y se usa la primera que traiga texto: si el buscador
/// cambia su maquetación, la siguiente lo sostiene, y si
/// ninguna sirve se dice en el registro en vez de devolver
/// vacío como si la empresa no existiera.
const DONDE_RESPONDE = [
  '[data-subtree="aimc"]',
  '[data-async-context] [role="main"]',
  '#rcnt',
  '#main',
  'main',
  'body',
];

/// Donde se escribe la segunda pregunta.
const CAJA_DE_SEGUIMIENTO = [
  'textarea[aria-label*="seguimiento" i]',
  'textarea[aria-label*="follow" i]',
  'textarea[placeholder*="pregunt" i]',
  'textarea[placeholder*="ask" i]',
  '[contenteditable="true"][role="textbox"]',
  'textarea',
];

/// Lo que aparece cuando NO nos dejaron pasar. Confundir esto
/// con «la empresa no existe» es lo que borraría un dato
/// bueno, así que se distingue a propósito.
const NO_NOS_DEJARON =
  /antes de continuar|before you continue|acepto|i agree|unusual traffic|tráfico inusual|no soy un robot|not a robot|recaptcha|consent\.google/i;

/// La carpeta donde el navegador guarda lo suyo entre
/// consultas. Sin esto cada consulta arranca en blanco, y un
/// navegador que nunca ha estado en ninguna parte es
/// justamente el que se ve raro.
const PERFIL =
  process.env.WEB_NAVEGADOR_PERFIL ?? join(process.cwd(), '.perfil-buscador');

/// Cuánto se le da a Chrome para abrir el puerto.
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

  /**
   * Abre el navegador, y lo deja abierto.
   *
   * Se arranca Chrome COMO SE ARRANCA CHROME -- el ejecutable,
   * con sus argumentos -- y luego el código se le pega por el
   * puerto de depuración. No se abre con Playwright.
   *
   * Esto no es un capricho, es lo único que funcionó. Abierto
   * por Playwright, el buscador contestaba «hemos detectado
   * tráfico inusual procedente de tu red» y no pasaba de ahí,
   * con Chrome de verdad y con ventana incluidos. Arrancado
   * así, contestó a la primera. Está probado de las dos
   * formas, no supuesto.
   *
   * Si ya hay un Chrome escuchando en ese puerto -- porque
   * usted lo abrió, o porque quedó de la consulta anterior --
   * se usa ese y no se abre otro.
   *
   * Se reusa el mismo para todas las consultas: abrir uno
   * nuevo cada vez borra las galletas, y volver a presentarse
   * desde cero en cada consulta es peor que quedarse.
   */
  private async abrir(): Promise<BrowserContext> {
    if (this.contexto) return this.contexto;

    const donde = process.env.WEB_NAVEGADOR_CDP ?? (await this.arrancar());
    const navegador = await chromium.connectOverCDP(donde);

    const suyo = navegador.contexts()[0];
    if (!suyo) throw new Error(`No hay ninguna ventana abierta en ${donde}.`);

    this.contexto = suyo;
    // si el navegador ya estaba, no es nuestro y no se cierra
    this.pegado = Boolean(process.env.WEB_NAVEGADOR_CDP) || !this.proceso;
    return suyo;
  }

  /// Arranca Chrome con el puerto de depuración abierto y
  /// espera a que conteste. Si ya hay uno, se reusa.
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

    /// Sin `--headless`, y fuera de la pantalla.
    ///
    /// Probado: en headless el buscador contesta «hemos
    /// detectado tráfico inusual» y no pasa de ahí. Con
    /// ventana de verdad, contesta. Pero una ventana que se
    /// abre encima de lo que usted está haciendo estorba, así
    /// que se manda a una coordenada que no existe en ninguna
    /// pantalla: sigue siendo un Chrome de verdad, dibujando
    /// de verdad, y usted no lo ve.
    ///
    /// Y en su PROPIO perfil, nunca en el suyo: esto no abre,
    /// cierra ni toca las ventanas que usted tenga.
    const escondido = [
      '--window-position=-32000,-32000',
      '--window-size=1400,1000',
    ];

    /**
     * En un servidor no hay pantalla donde dibujar.
     *
     * Un Chrome con ventana necesita una pantalla; sin ella
     * ni siquiera arranca. La imagen puede levantar una
     * virtual con Xvfb —se enciende con WEB_CON_CABEZA=1— y
     * entonces sí. Si no la hay, se cae a oculto para no
     * reventar... pero se avisa, porque oculto es justo lo
     * que el buscador bloquea, y quedarse callado aquí sería
     * dejar que alguien crea que esto funciona en el
     * servidor cuando lo más probable es que no.
     */
    const conPantalla = hayPantalla();
    if (!conPantalla) {
      this.log.warn(
        'No hay pantalla: el navegador va a arrancar oculto, y el buscador ' +
          'suele rechazar eso con «tráfico inusual». En un servidor use ' +
          'WEB_PROVEEDOR=API, o levante una pantalla virtual con ' +
          'WEB_CON_CABEZA=1 en la imagen.',
      );
    }

    /// Sin `--no-sandbox` un Chromium dentro de un contenedor
    /// no arranca: no tiene los permisos del núcleo que el
    /// aislamiento necesita. Solo se pone donde hace falta.
    const enContenedor =
      process.platform === 'linux'
        ? ['--no-sandbox', '--disable-dev-shm-usage']
        : [];

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
    this.proceso.on('error', (e) =>
      this.log.error(`No pude arrancar Chrome: ${e.message}`),
    );

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
      const r = await fetch(`${donde}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    // si el navegador ya estaba abierto, no es nuestro y se deja
    if (this.pegado) return;
    await this.contexto?.close().catch(() => undefined);
    this.proceso?.kill();
  }

  async consultar(nit: string): Promise<RespuestaWeb> {
    let pagina;
    try {
      const contexto = await this.abrir();
      pagina = await contexto.newPage();
      return await this.preguntar(pagina, nit);
    } catch (e) {
      /// Que el buscador no conteste NO es «no existe».
      ///
      /// La misma regla del RUI: la cola reintenta, y
      /// confundir las dos cosas dejaría una ficha marcada
      /// como que no se encontró cuando lo que pasó fue que se
      /// cayó internet.
      const razon = e instanceof Error ? e.message : String(e);
      this.log.warn(`El buscador no respondió (NIT ${nit}): ${razon}`);
      return { estado: 'FALLO', error: razon.slice(0, 300) };
    } finally {
      // se cierra la pestaña, no el navegador: el navegador se
      // queda con sus galletas para la siguiente
      await pagina?.close().catch(() => undefined);
    }
  }

  private async preguntar(pagina: Page, nit: string): Promise<RespuestaWeb> {
    /// Todo de una vez, no en dos pasos.
    ///
    /// Usted lo hace en dos: primero el nombre, y ya en el
    /// Modo IA pide los catorce campos. Probado así, la
    /// segunda pregunta se perdía -- la caja de seguimiento
    /// no siempre está donde uno cree, y la respuesta que
    /// quedaba era la del nombre solo.
    ///
    /// La misma pregunta completa desde la dirección llega
    /// igual y no depende de encontrar ninguna caja. Si aun
    /// así vuelve prosa sin etiquetas, se reintenta por la
    /// caja, que para eso sigue ahí.
    const pregunta = laPregunta(nit);
    await pagina.goto(direccion(pregunta), {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });

    const primera = await this.esperarRespuesta(pagina);
    if (primera.muro) return this.muro(nit, primera.texto);

    let texto = this.sinEco(primera.texto, pregunta);

    // ¿contestó en prosa, sin las etiquetas? se vuelve a pedir
    if (!leerFichaWeb(texto).razonSocial) {
      this.log.log(`NIT ${nit}: contestó sin etiquetas, se lo pido de nuevo.`);
      if (await this.preguntarDeNuevo(pagina, pregunta)) {
        const otra = await this.esperarRespuesta(pagina, primera.texto.length);
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
      this.log.warn(
        `NIT ${nit}: contestó pero sin razón social. ` +
          `Texto: ${texto.slice(0, 160)}`,
      );
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
   * Espera a que termine de escribir.
   *
   * No se lee apenas aparece algo: la respuesta llega de a
   * pedazos y leerla temprano devuelve media frase. Se espera
   * a que el texto deje de crecer durante un rato seguido.
   */
  private async esperarRespuesta(
    pagina: Page,
    largoPrevio = 0,
  ): Promise<{ texto: string; muro: boolean }> {
    const hasta = Date.now() + ESPERA_MAXIMA;
    let mejor = '';
    let ultimoCambio = Date.now();

    while (Date.now() < hasta) {
      const texto = await this.leer(pagina);

      if (NO_NOS_DEJARON.test(texto.slice(0, 600))) {
        return { texto, muro: true };
      }

      if (texto.length > mejor.length) {
        mejor = texto;
        ultimoCambio = Date.now();
      }

      // creció respecto a la pregunta anterior y lleva un rato quieto
      const yaCrecio = mejor.length > largoPrevio + LARGO_MINIMO;
      if (yaCrecio && Date.now() - ultimoCambio > QUIETO) break;

      await pagina.waitForTimeout(CADA);
    }

    return { texto: mejor, muro: false };
  }

  /**
   * Quita el eco de la pregunta.
   *
   * La página muestra la pregunta ANTES de la respuesta, y a
   * veces dos veces. Como la pregunta lleva las catorce
   * etiquetas -- «Razón social:», «Ciudad:» -- el lector las
   * encontraba ahí primero, vacías, y daba la ficha por
   * vacía. Es el eco, no el buscador.
   *
   * Se corta por lo último que dice la pregunta: lo que venga
   * después es la respuesta, siempre.
   */
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

  /// Escribe la segunda pregunta en la caja de seguimiento.
  /// Devuelve si encontró dónde.
  private async preguntarDeNuevo(
    pagina: Page,
    pregunta: string,
  ): Promise<boolean> {
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
