import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

function exigirSecretoDeSesion() {
  // sin secreto no se arranca: se podrian fabricar sesiones
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

  // sin esto req.cookies llega vacio
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      // solo lo que declara el DTO; lo demas es 400
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
