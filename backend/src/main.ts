import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 0.0.0.0 es obligatorio dentro del contenedor: si Nest escucha solo en
  // localhost, nginx (que vive en otro contenedor) recibe 502.
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
void bootstrap();
