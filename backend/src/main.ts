import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

function exigirSecretoDeSesion() {
  // Se comprueba antes de arrancar y no cuando alguien intenta entrar: sin
  // secreto, @nestjs/jwt firma con `undefined` y cualquiera podria fabricarse
  // una sesion de administrador. Es mejor no levantar el servidor.
  if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 32) {
    throw new Error(
      'Falta ADMIN_JWT_SECRET (minimo 32 caracteres) en el entorno. ' +
        'Generar uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
}

async function bootstrap() {
  exigirSecretoDeSesion();

  const app = await NestFactory.create(AppModule);

  // La sesion del panel viaja en una cookie httpOnly; sin esto req.cookies
  // llega vacio y el guard rechaza a todo el mundo.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` descarta lo que no está en el DTO y `forbidNonWhitelisted`
      // devuelve 400 si llega de más: sin esto, un cliente podría mandar
      // `cuposConfirmados` y colarlo hasta la base.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 0.0.0.0 es obligatorio dentro del contenedor: si Nest escucha solo en
  // localhost, nginx (que vive en otro contenedor) recibe 502.
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
void bootstrap();
