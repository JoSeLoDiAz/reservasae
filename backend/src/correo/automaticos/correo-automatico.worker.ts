/** El que va vaciando la cola de los correos automaticos. */

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { CorreoAutomaticoService } from './correo-automatico.service';

/// ENCENDIDO salvo que se apague, al reves que el del RUI y
/// que el de campanas, y por lo que hacen los tres: aquellos
/// salen a un portal del Estado y a listas de cientos: un
/// portatil apuntando por descuido a produccion hace dano de
/// verdad. Este manda UN acuse a quien acaba de dejar su
/// correo en el formulario, y el peor caso de tenerlo
/// encendido es que ese acuse salga dos veces --y ni eso,
/// que el `@@unique` lo impide--. El caro es el contrario:
/// apagado por omision, nadie se entera de que no sale.
const APAGADO = process.env.CORREO_AUTOMATICO === 'no';

/// Sin trabajo se duerme un minuto; con trabajo, lo justo
/// para no encadenar SMTP sin respirar. No lleva el horario
/// de las campanas a proposito: esto es un acuse de algo que
/// la persona acaba de hacer, y a las nueve de la noche
/// sirve igual.
const PAUSA_CON_TRABAJO = 1500;
const PAUSA_SIN_TRABAJO = 60_000;

@Injectable()
export class CorreoAutomaticoWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('CorreoAutomaticoWorker');
  private corriendo = false;
  private parar = false;

  constructor(private readonly correos: CorreoAutomaticoService) {}

  onModuleInit(): void {
    if (APAGADO) {
      this.log.warn(
        'Apagado por CORREO_AUTOMATICO=no: nadie recibira el acuse de su preinscripcion.',
      );
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
        hubo = await this.correos.mandarUno();
      } catch (e) {
        // que un fallo no mate el bucle entero
        this.log.error(`Fallo mandando: ${(e as Error).message}`);
      }

      await new Promise((r) =>
        setTimeout(r, hubo ? PAUSA_CON_TRABAJO : PAUSA_SIN_TRABAJO),
      );
    }

    this.corriendo = false;
    this.log.log('Detenido.');
  }
}
