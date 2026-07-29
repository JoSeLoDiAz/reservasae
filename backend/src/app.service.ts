import { Injectable } from '@nestjs/common';

export interface Estado {
  servicio: string;
  estado: string;
  version: string;
  hora: string;
}

@Injectable()
export class AppService {
  getEstado(): Estado {
    return {
      servicio: 'reservasae-backend',
      estado: 'ok',
      version: process.env.APP_VERSION ?? '0.1.0',
      hora: new Date().toISOString(),
    };
  }
}
