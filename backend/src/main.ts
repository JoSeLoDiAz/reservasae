import { exigirSecretoDeLeads } from './leads/secreto-de-leads';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

/// Los valores de los .env.example. Que alguien arranque con
/// uno de estos puestos es lo mismo que no tener secreto: son
/// publicos, estan en el repositorio.
const DE_EJEMPLO = [
  'cambiar-por-un-secreto-largo-y-aleatorio',
  'cambiar-por-otro-secreto-largo-y-aleatorio-solo-de-pruebas',
];

const COMO_GENERARLO =
  'Generelo con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"';

function exigirSecretoDeSesion() {
  const secreto = process.env.ADMIN_JWT_SECRET;

  // sin secreto no se arranca
  if (!secreto || secreto.length < 32) {
    throw new Error(
      `Falta ADMIN_JWT_SECRET (minimo 32 caracteres) en el entorno. ${COMO_GENERARLO}`,
    );
  }

  /// Y con el del ejemplo, tampoco.
  ///
  /// El largo minimo no basta: la frase que sugeria el
  /// .env.example tiene 40 caracteres y pasaba la puerta. Un
  /// secreto que esta escrito en un repositorio publico no es
  /// un secreto, y con el se firman sesiones de administrador.
  if (DE_EJEMPLO.includes(secreto)) {
    throw new Error(
      'ADMIN_JWT_SECRET es el valor de ejemplo, que esta publicado en el ' +
        `repositorio. ${COMO_GENERARLO}`,
    );
  }

  /// Y la del webhook, con la MISMA regla.
  ///
  /// Se le exigian 32 caracteres pero no se miraba si era el
  /// valor de ejemplo, y el .env.example proponia
  /// «cambiar-por-un-secreto-largo-y-aleatorio»: cuarenta
  /// caracteres, pasa el minimo, y esta escrito en un
  /// repositorio publico. El backend arrancaba contento con la
  /// llave que cualquiera puede leer, y esa llave escribe en
  /// el CRM sin sesion.
  const leads = process.env.LEADS_WEBHOOK_SECRET;
  if (leads && DE_EJEMPLO.includes(leads)) {
    throw new Error(
      'LEADS_WEBHOOK_SECRET es el valor de ejemplo, que esta publicado en ' +
        `el repositorio. ${COMO_GENERARLO}`,
    );
  }

  /// Si parece una frase escrita a mano, se avisa pero se
  /// arranca.
  ///
  /// Avisar y no impedir es a proposito: un despliegue que ya
  /// esta corriendo no se puede tumbar por esto, y aqui no hay
  /// forma de medir entropia de verdad. Pero una frase de
  /// palabras separadas por guiones, sin mayusculas ni
  /// digitos, se ataca con un diccionario en un portatil.
  const pareceFrase =
    !/[A-Z]/.test(secreto) && !/[0-9]/.test(secreto) && /[-_ ]/.test(secreto);
  if (pareceFrase) {
    console.warn(
      '[AVISO] ADMIN_JWT_SECRET parece una frase escrita a mano. Si alguna ' +
        'vez se filtra una sesion firmada con el, se ataca sin tocar el ' +
        `servidor. ${COMO_GENERARLO}`,
    );
  }
}

async function bootstrap() {
  exigirSecretoDeSesion();
  // el webhook escribe sin sesion: sin llave no se arranca
  exigirSecretoDeLeads();

  /// `rawBody`: el cuerpo TAL CUAL llegó, byte a byte.
  ///
  /// Meta firma sus webhooks con HMAC sobre el cuerpo crudo.
  /// Si se firma sobre el JSON ya parseado y vuelto a
  /// serializar, la firma NUNCA cuadra: basta con que cambie
  /// el orden de una clave o un espacio.
  ///
  /// Nest no lo guarda salvo que se le pida, y sin él la única
  /// alternativa era un orquestador intermedio que tradujera
  /// —una pieza más que mantener y que se puede caer sola.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // sin esto req.cookies llega vacio
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // solo lo que declara el DTO
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 0.0.0.0: nginx vive en otro contenedor
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
void bootstrap();
