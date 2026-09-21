import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Estado {
  servicio: string;
  estado: string;
  version: string;
  /// De la misma variable que la franja naranja del panel. «Mi
  /// perfil» adivinaba el entorno por si la versión decía «prueba»,
  /// y como no lo dice, en pruebas afirmaba «Producción · datos
  /// reales» debajo de una franja que dice lo contrario.
  entorno: 'prueba' | 'produccion';
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
      servicio: 'crm-grupo-ae-backend',
      estado: 'ok',
      version: process.env.APP_VERSION ?? VERSION,
      entorno: process.env.ENTORNO === 'prueba' ? 'prueba' : 'produccion',
      hora: new Date().toISOString(),
    };
  }
}
