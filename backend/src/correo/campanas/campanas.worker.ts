/** El que va vaciando las campañas, despacio. */

import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { correoConectado } from '../correo.service';
import { API_EN_LOCAL, urlPublicaDeLaApi } from '../url-publica';
import { CampanasService } from './campanas.service';
import { pausa } from './ritmo';

/// Apagado salvo que se encienda a propósito, igual que los
/// demás: un `.env` de portátil puede apuntar a la base de
/// producción, y un worker que arranca solo se pone a mandar
/// correos de verdad a gente de verdad.
const ENCENDIDO = process.env.CAMPANAS_WORKER === '1';

/// Cuando no hay nada que mandar -- o está fuera de horario --
/// se pregunta cada tanto. Un minuto: no hay ninguna prisa, y
/// consultar cada segundo por algo que solo cambia a las ocho
/// de la mañana es gastar por gastar.
const PAUSA_SIN_TRABAJO = 60_000;

@Injectable()
export class CampanasWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Campanas');
  private corriendo = false;
  private parar = false;

  constructor(private readonly campanas: CampanasService) {}

  onModuleInit(): void {
    if (!ENCENDIDO) {
      this.log.log('Apagado. Se enciende con CAMPANAS_WORKER=1.');
      return;
    }
    if (!correoConectado()) {
      this.log.warn(
        'Encendido pero sin correo configurado: no va a salir nada.',
      );
      return;
    }

    this.log.log(
      'Encendido. Sale de a uno, en horario de Colombia y con los topes puestos.',
    );
    void this.bucle();
  }

  onModuleDestroy(): void {
    this.parar = true;
  }

  /// La URL con la que se arman los enlaces del correo. Tiene
  /// que ser la PÚBLICA: quien pulsa el enlace es una persona
  /// en su casa, y `localhost` allí no lleva a ninguna parte.
  ///
  /// Y lleva `/api`. Las TRES direcciones que salen de aquí
  /// --el banner, el píxel de apertura y el enlace medido-- son
  /// endpoints del backend, y nginx solo manda al backend lo
  /// que empieza por `/api/`. Sin él, cada enlace de cada
  /// correo de una campaña llevaba al 404 del Next en vez de a
  /// su destino. Ver `correo/url-publica.ts`.
  private get baseApi(): string {
    return urlPublicaDeLaApi() ?? API_EN_LOCAL;
  }

  private async bucle(): Promise<void> {
    if (this.corriendo) return;
    this.corriendo = true;

    while (!this.parar) {
      let hubo = false;
      try {
        hubo = await this.campanas.enviarUno(this.baseApi);
      } catch (e) {
        // que un fallo no mate el bucle entero
        this.log.error(`Fallo mandando: ${(e as Error).message}`);
      }

      /// Entre 20 y 45 segundos cuando manda; un minuto cuando
      /// no hay nada. La pausa larga NO es pereza: es lo que
      /// hace que esto parezca una persona escribiendo y no un
      /// robot vaciando una lista.
      await new Promise((r) =>
        setTimeout(r, hubo ? pausa() : PAUSA_SIN_TRABAJO),
      );
    }

    this.corriendo = false;
    this.log.log('Detenido.');
  }
}
