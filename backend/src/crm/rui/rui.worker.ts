/** El que va vaciando la cola del RUI. */

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { RuiService } from './rui.service';

/// Apagado salvo que se encienda a propósito, igual que el
/// worker de mensajería: el `.env` de un portátil puede
/// apuntar a la base de producción, y un worker que arranca
/// solo con `pnpm dev:backend` se pone a consultar de verdad.
const ENCENDIDO = process.env.RUI_WORKER === '1';

/// Un solo hilo y una pausa entre consultas. La Ventanilla
/// Social es un portal del Estado: diez navegadores en
/// paralelo se ganan un bloqueo de IP, y entonces el
/// proceso se cae para todos, no solo para el que corría.
const PAUSA_CON_TRABAJO = 800;
const PAUSA_SIN_TRABAJO = 5000;

@Injectable()
export class RuiWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('RuiWorker');
  private corriendo = false;
  private parar = false;

  constructor(private readonly rui: RuiService) {}

  onModuleInit(): void {
    if (!ENCENDIDO) {
      this.log.log('Apagado. Se enciende con RUI_WORKER=1.');
      return;
    }
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
        hubo = await this.rui.procesarUna();
      } catch (e) {
        // que un fallo no mate el bucle entero
        this.log.error(`Fallo procesando: ${(e as Error).message}`);
      }

      await new Promise((r) =>
        setTimeout(r, hubo ? PAUSA_CON_TRABAJO : PAUSA_SIN_TRABAJO),
      );
    }

    this.corriendo = false;
    this.log.log('Detenido.');
  }
}
