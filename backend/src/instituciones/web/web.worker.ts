/** El que va vaciando la cola del buscador web. */

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { comoSeConsulta } from './proveedor-web';
import { WebService } from './web.service';

/// Apagado salvo que se encienda a propósito, igual que el
/// del RUI: el `.env` de un portátil puede apuntar a la base
/// de producción, y un worker que arranca solo con
/// `pnpm dev:backend` se pone a consultar -- y a cobrar -- de
/// verdad.
const ENCENDIDO = process.env.WEB_WORKER === '1';

/// Uno a la vez y con pausa, igual que el del RUI. Diez
/// navegadores en paralelo contra el mismo buscador se ganan
/// un bloqueo, y ese bloqueo no lo paga la cola: lo paga la
/// oficina entera, que se queda sin buscador.
const PAUSA = 6000;
const PAUSA_SIN_TRABAJO = 10_000;

@Injectable()
export class WebWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('BuscadorWeb');
  private corriendo = false;
  private parar = false;

  constructor(private readonly web: WebService) {}

  onModuleInit(): void {
    if (!ENCENDIDO) {
      this.log.log('Apagado. Se enciende con WEB_WORKER=1.');
      return;
    }

    const quien = comoSeConsulta();
    if (quien === 'APAGADO') {
      // que quede claro en el registro por qué no pasa nada
      this.log.warn('Encendido pero apagado: la cola se queda quieta.');
      return;
    }

    // que quede claro contra qué corre
    this.log.log(
      quien === 'NAVEGADOR'
        ? 'Con un navegador, contra el buscador, igual que el RUI.'
        : 'Por API, con búsqueda en internet.',
    );

    void this.bucle();
  }

  onModuleDestroy(): void {
    this.parar = true;
  }

  private async bucle(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;
    this.log.log('Encendido.');

    while (!this.parar) {
      let hubo = false;
      try {
        hubo = await this.web.procesarUna();
      } catch (e) {
        // que un fallo no mate el bucle entero
        this.log.error(`Fallo procesando: ${(e as Error).message}`);
      }

      await new Promise((r) => setTimeout(r, hubo ? PAUSA : PAUSA_SIN_TRABAJO));
    }

    this.corriendo = false;
    this.log.log('Detenido.');
  }
}
