/** El RUI de verdad: la Ventanilla Social del DNP. */

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { chromium, type Browser, type Page } from 'playwright';

import {
  documentoNoEncontrado,
  leerRespuesta,
  sigueConsultando,
} from './leer-respuesta';
import { conTildes, partirNombre } from './partir-nombre';
import type { ProveedorRui, ResultadoRui } from './proveedor';

const PORTAL = 'https://ventanillasocial.dnp.gov.co/';

/// El portal no tiene API: la consulta es el AJAX interno que
/// dispara el boton. La respuesta se lee del TEXTO del
/// recuadro y no del HTML, asi que un cambio de colores del
/// DNP no la rompe. Ver `leer-respuesta.ts`.

/// Cuanto se espera a que el portal conteste. Su AJAX tarda
/// entre dos y quince segundos segun la hora.
const ESPERA_RESULTADO = 25_000;

/// Cada cuanto se mira si ya contesto. El portal muestra el
/// recuadro de resultado de inmediato con un «Consultando
/// bases de datos...» dentro, asi que leerlo apenas aparece
/// devuelve el texto del spinner, no el nombre.
const CADA = 500;

/// Tipo del SEP -> valor del desplegable del portal.
///
/// El portal admite nueve tipos y usa su propia numeracion,
/// que no es la del SEP. Los que no estan en esta tabla --
/// «Otro», del formulario -- no se pueden consultar porque el
/// portal no tiene donde encajarlos.
const TIPO_EN_EL_PORTAL: Record<number, string> = {
  1: '3', // Cedula de ciudadania
  3: '4', // Cedula de extranjeria
  61: '9', // Permiso por Proteccion Temporal
  4: '8', // Permiso especial de permanencia
  41: '6', // Pasaporte -> DNI (Pasaporte)
};

/**
 * Consulta el RUI abriendo el portal en un navegador.
 *
 * El navegador se abre una vez y se reutiliza: arrancar
 * Chromium por consulta se lleva mas tiempo que la consulta.
 * Cada persona va en un contexto propio para que no se
 * compartan cookies entre consultas.
 */
@Injectable()
export class ProveedorRuiVentanilla implements ProveedorRui, OnModuleDestroy {
  private readonly log = new Logger('RuiVentanilla');
  private navegador: Browser | null = null;

  private async abrir(): Promise<Browser> {
    if (this.navegador?.isConnected()) return this.navegador;
    this.navegador = await chromium.launch({ headless: true });
    return this.navegador;
  }

  async onModuleDestroy() {
    await this.navegador?.close().catch(() => undefined);
  }

  async consultar(
    tipoDocumentoSepId: number,
    numeroDocumento: string,
  ): Promise<ResultadoRui> {
    const tipoPortal = TIPO_EN_EL_PORTAL[tipoDocumentoSepId];
    if (!tipoPortal) {
      // «Otro» no tiene equivalente: no es que la persona no
      // exista, es que no se puede preguntar por ella
      return {
        estado: 'FALLO',
        error: 'El portal del RUI no admite ese tipo de documento.',
      };
    }

    let contexto;
    try {
      const navegador = await this.abrir();
      contexto = await navegador.newContext();
      const pagina = await contexto.newPage();
      return await this.preguntar(pagina, tipoPortal, numeroDocumento);
    } catch (e) {
      // que el portal no conteste no es «no existe»: la cola
      // reintenta, y confundirlos borraria a alguien que si esta
      const razon = e instanceof Error ? e.message : String(e);
      this.log.warn(
        `El portal no respondió (doc. ${numeroDocumento}): ${razon}`,
      );
      return { estado: 'FALLO', error: razon.slice(0, 200) };
    } finally {
      await contexto?.close().catch(() => undefined);
    }
  }

  private async preguntar(
    pagina: Page,
    tipoPortal: string,
    documento: string,
  ): Promise<ResultadoRui> {
    await pagina.goto(PORTAL, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    });

    await pagina.getByText('Consulta RUI', { exact: false }).first().click();
    await pagina.waitForSelector('#ruiNumDoc', {
      state: 'visible',
      timeout: 15_000,
    });

    await pagina.locator('#ruiTipoDoc').selectOption({ value: tipoPortal });
    await pagina.fill('#ruiNumDoc', documento);
    await pagina
      .getByRole('button', { name: /consultar/i })
      .first()
      .click();

    await pagina.waitForSelector('#ruiResultado', {
      state: 'visible',
      timeout: 15_000,
    });

    // el recuadro aparece de una con el spinner dentro: hay que
    // esperar a que se vaya, no a que exista
    const hasta = Date.now() + ESPERA_RESULTADO;
    let texto = '';

    while (Date.now() < hasta) {
      texto = (await pagina.locator('#ruiResultado').innerText()).trim();

      if (documentoNoEncontrado(texto)) return { estado: 'SIN_RESULTADO' };
      if (!sigueConsultando(texto) && leerRespuesta(texto).nombre) break;

      await pagina.waitForTimeout(CADA);
    }

    if (sigueConsultando(texto)) {
      return { estado: 'FALLO', error: 'El portal no terminó de responder.' };
    }

    const ficha = leerRespuesta(texto);
    if (!ficha.nombre) {
      // el portal contesto pero no reconocemos su forma: casi
      // seguro cambio la pagina. Callarlo dejaria la cola
      // reintentando contra algo que ya no existe
      this.log.warn(
        `El portal respondió sin un nombre reconocible (doc. ${documento}). ` +
          `Puede que el DNP haya cambiado la página. Texto: ${texto.slice(0, 120)}`,
      );
      return {
        estado: 'FALLO',
        error: 'El portal cambió: no se reconoce el nombre.',
      };
    }

    return { estado: 'ENCONTRADO', nombreCompleto: conTildes(ficha.nombre) };
  }
}

/// Reexportado para que quien guarde el resultado no tenga que
/// conocer el modulo de nombres.
export { partirNombre };
