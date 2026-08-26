/** El que va vaciando la cola del RUI. */

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { ruiEsSimulado } from './proveedor';
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
/// Con el simulador la pausa es corta porque no sale a
/// ninguna parte. Contra el portal real se espera entre seis
/// y diez segundos, con algo de azar para no entrar siempre en
/// el mismo instante del reloj: es el ritmo con el que el
/// script original llevaba meses sin que lo bloquearan.
const PAUSA_SIMULADO = 800;
const PAUSA_MINIMA = 6000;
const PAUSA_MAXIMA = 10_000;
const PAUSA_SIN_TRABAJO = 5000;

function pausaEntreConsultas(): number {
  if (ruiEsSimulado()) return PAUSA_SIMULADO;
  return (
    PAUSA_MINIMA + Math.floor(Math.random() * (PAUSA_MAXIMA - PAUSA_MINIMA))
  );
}

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

    // que quede claro en el registro contra que corre
    this.log.log(
      ruiEsSimulado()
        ? 'Con el simulador: NO consulta el RUI. Se conecta con RUI_PROVEEDOR=VENTANILLA.'
        : 'Contra la Ventanilla Social del DNP, en serio.',
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
        hubo = await this.rui.procesarUna();
      } catch (e) {
        // que un fallo no mate el bucle entero
        this.log.error(`Fallo procesando: ${(e as Error).message}`);
      }

      await new Promise((r) =>
        setTimeout(r, hubo ? pausaEntreConsultas() : PAUSA_SIN_TRABAJO),
      );
    }

    this.corriendo = false;
    this.log.log('Detenido.');
  }
}
