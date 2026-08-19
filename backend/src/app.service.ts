import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Estado {
  servicio: string;
  estado: string;
  version: string;
  hora: string;
}

/// Del package.json: src/ y dist/ cuelgan los dos de
/// backend/, así que la ruta resuelve igual compilado.
function versionDelPaquete(): string {
  try {
    const crudo = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
    return (JSON.parse(crudo) as { version?: string }).version ?? 'desconocida';
  } catch {
    // el estado no puede caerse por no saber su version
    return 'desconocida';
  }
}

const VERSION = versionDelPaquete();

@Injectable()
export class AppService {
  getEstado(): Estado {
    return {
      servicio: 'reservasae-backend',
      estado: 'ok',
      version: process.env.APP_VERSION ?? VERSION,
      hora: new Date().toISOString(),
    };
  }
}
