/** Cuelga su nota a las conversaciones cuyo dueño apareció después. */

/**
 * POR QUE EXISTE: el orden dejo de importar.
 *
 * «Los que no estan registrados se ingresen de manera masiva y
 * POSTERIORMENTE guarde la gestion de los mensajes» (Josse, 8 oct
 * 2026). Hasta hoy eso no funcionaba: una conversacion de alguien que
 * todavia no esta en el CRM nace `SIN_DUENO`, y el unico proceso que
 * volvia a mirarla era el olvidador ---que a los 60 dias la BORRA---.
 * Asi que mandar las conversaciones antes que los leads las perdia.
 *
 * Con esto el orden es libre: Mauricio manda lo que tenga como le
 * salga y cuadra igual.
 *
 * EL MISMO MOLDE QUE EL OLVIDADOR, que es su gemelo: los dos recorren
 * las `SIN_DUENO` de la misma ventana, y uno las rescata antes de que
 * el otro las tire. Por eso comparten `limiteDelOlvido`: con dos
 * ventanas distintas habria conversaciones que el olvidador alcanza y
 * el repescador no.
 *
 * CADA MEDIA HORA Y NO CADA MINUTO. Lo que espera aqui es que alguien
 * cargue una base de leads, y eso no pasa cada minuto; cada pasada
 * pregunta por el celular de hasta 200 filas, asi que un reloj corto
 * seria una tormenta de consultas para no encontrar nada.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { LucidService } from './lucid.service';

const CADA = 30 * 60 * 1000;

/// Al arrancar se espera: el despliegue recrea los contenedores y lo
/// ultimo que hace falta es una tanda de consultas mientras la
/// aplicacion todavia esta levantandose.
const AL_ARRANCAR = 60_000;

@Injectable()
export class RepescadorDeConversaciones implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Lucid');
  private reloj: NodeJS.Timeout | null = null;

  constructor(private readonly lucid: LucidService) {}

  onModuleInit() {
    /// SE APAGA CON UNA VARIABLE, como los demas trabajadores de la
    /// casa. Y va ENCENDIDO por omision: lo que hace es colgar una
    /// nota que ya llego y que si no se cuelga se borra a los 60
    /// dias. No sale nada hacia afuera.
    if (process.env.REPESCAR_CONVERSACIONES === 'no') {
      this.log.warn(
        'Repescador apagado: una conversación cuyo dueño aparezca después se queda sin nota.',
      );
      return;
    }
    setTimeout(() => void this.pasar(), AL_ARRANCAR).unref();
    this.reloj = setInterval(() => void this.pasar(), CADA);
    this.reloj.unref();
  }

  onModuleDestroy() {
    if (this.reloj) clearInterval(this.reloj);
  }

  /**
   * UNA PASADA, Y NO TUMBA NADA SI FALLA.
   *
   * Corre sola y sin nadie mirando, asi que un error aqui no puede
   * subir: lo unico que haria es ensuciar el log del proceso. Se
   * apunta y se espera la siguiente.
   */
  private async pasar(): Promise<void> {
    try {
      const { miradas, pegadas } = await this.lucid.repescar();
      /// Solo se dice cuando PASO algo: una linea cada media hora
      /// diciendo «cero» se deja de leer, y entonces tampoco se lee
      /// la que importa.
      if (pegadas > 0) {
        this.log.log(`Repescadas ${pegadas} de ${miradas} conversaciones sin dueño.`);
      }
    } catch (e) {
      this.log.error(`No se pudo repescar: ${(e as Error).message}`);
    }
  }
}
