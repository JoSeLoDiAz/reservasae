import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('estado', () => {
    it('reporta el servicio en ok', () => {
      const estado = appController.getEstado();
      expect(estado.servicio).toBe('reservasae-backend');
      expect(estado.estado).toBe('ok');
    });
  });
});
