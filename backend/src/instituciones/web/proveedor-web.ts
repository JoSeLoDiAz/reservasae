/** Quién le pregunta al buscador web por un NIT. */

/// La pregunta es la misma que hace Mauricio a mano, y va
/// escrita aquí tal cual para que se pueda comparar:
///
///     CUAL ES EL NOMBRE PARA EL NIT 860031945
///     DAME LA SIGUIENTE INFORMACIÓN: Razón social, ...
///
/// Lo que cambia es quién contesta.
///
/// NO se automatiza el buscador de Google con un navegador.
/// Sus condiciones prohíben las consultas automáticas, lo
/// detectan rápido, y el precio de que lo detecten no lo paga
/// este código: lo paga la IP de la oficina, que se queda sin
/// Google para todo el mundo. Se pregunta por API, que es la
/// puerta que existe para esto.
///
/// Y pase lo que pase, la respuesta NUNCA escribe en el
/// maestro: entra como `PropuestaInstitucion` y una persona
/// acepta campo por campo. La propia IA lo dice al final de
/// sus respuestas -- «te sugiero consultar directamente el
/// RUES» --: es un punto de partida, no una fuente de fe.

import { Injectable, Logger } from '@nestjs/common';

import { leerFichaWeb, type FichaWeb } from './leer-ficha-web';

export const PROVEEDOR_WEB = 'PROVEEDOR_WEB';

export type RespuestaWeb =
  | { estado: 'ENCONTRADO'; ficha: FichaWeb; crudo: string }
  /// Contestó, pero de ahí no salió nada aprovechable. Se
  /// guarda igual lo que dijo: si mañana el buscador cambia
  /// la forma de responder, esto es lo único que dice en qué
  /// cambió.
  | { estado: 'SIN_RESULTADO'; crudo?: string }
  | { estado: 'FALLO'; error: string };

export interface ProveedorWeb {
  consultar(nit: string): Promise<RespuestaWeb>;
}

/** Los catorce campos, en el orden en que se piden. */
export const LO_QUE_SE_PIDE = [
  'Razón social',
  'Nombre comercial',
  'Fecha de fundación',
  'Dirección',
  'Teléfono',
  'Correo',
  'Página web',
  'Ciudad',
  'Departamento',
  'Sector económico',
  'Código CIIU',
  'Clasificación',
  'Tamaño',
  'Número de empleados',
];

/**
 * La pregunta, y por qué está redactada así.
 *
 * Probada contra el buscador de verdad. Dos cosas se
 * aprendieron ahí, y cada una está por algo:
 *
 * - Sin pedirle que busque, se rinde rápido: contestaba
 *   «No disponible» en nueve de los catorce campos aunque el
 *   dato estuviera publicado. Por eso se le dice de dónde
 *   sacarlo -- RUES, Cámara de Comercio, la página de la
 *   propia empresa -- antes de darse por vencido.
 *
 * - Y aun así se le deja «No disponible» a la mano, porque
 *   entre un campo vacío y un campo inventado, el vacío es el
 *   que no termina en un reporte al SENA.
 */
export function laPregunta(nit: string): string {
  return (
    `¿Cuál es el nombre de la empresa con NIT ${nit} en Colombia?\n\n` +
    'Busca en el RUES, en la Cámara de Comercio, en la página web de la ' +
    'propia empresa y en directorios empresariales, y dame:\n' +
    LO_QUE_SE_PIDE.map((c) => `${c}:`).join('\n') +
    '\n\nResponde solo con esa lista, un campo por línea, con el formato ' +
    '«Campo: valor». Busca cada dato antes de decir que no está. ' +
    'Si de verdad no lo encuentras, escribe «No disponible»: ' +
    'prefiero un campo vacío a un dato inventado.'
  );
}

export type ComoSeConsulta = 'NAVEGADOR' | 'API' | 'APAGADO';

/**
 * Quién contesta, y por defecto el navegador.
 *
 * Igual que el RUI: se abre la página y se pregunta, sin
 * clave, sin cuenta y sin que haya que pedirle permiso a
 * nadie. La API queda de repuesto para el día en que el
 * buscador se ponga bravo con el navegador -- entonces se
 * pone WEB_PROVEEDOR=API y una clave, y nada más cambia:
 * las dos hacen la misma pregunta y devuelven el mismo
 * texto, que lo entiende `leer-ficha-web.ts`.
 */
export function comoSeConsulta(): ComoSeConsulta {
  const elegido = process.env.WEB_PROVEEDOR?.toUpperCase();
  if (elegido === 'APAGADO') return 'APAGADO';
  if (elegido === 'API') return process.env.WEB_API_KEY ? 'API' : 'APAGADO';
  return 'NAVEGADOR';
}

export function webConectado(): boolean {
  return comoSeConsulta() !== 'APAGADO';
}

/**
 * El que no consulta, y lo dice.
 *
 * Solo se usa si alguien lo apaga a propósito, o si pidió la
 * API y no puso la clave. Se identifica en la propia
 * respuesta, igual que el simulador del RUI: un dato
 * inventado que parece bueno es peor que ninguno, porque
 * alguien lo acepta en la ficha y termina en el reporte al
 * SENA.
 */
@Injectable()
export class ProveedorWebApagado implements ProveedorWeb {
  private readonly log = new Logger('BuscadorWeb');

  consultar(nit: string): Promise<RespuestaWeb> {
    const porLaClave = process.env.WEB_PROVEEDOR?.toUpperCase() === 'API';
    this.log.warn(
      `No se consultó el NIT ${nit}: el buscador web está apagado` +
        (porLaClave ? ' (se pidió la API y falta WEB_API_KEY).' : '.'),
    );
    return Promise.resolve({
      estado: 'FALLO',
      error: porLaClave
        ? 'Se pidió consultar por API y falta WEB_API_KEY. Quite WEB_PROVEEDOR ' +
          'del entorno para volver al navegador, que no necesita clave.'
        : 'El buscador web está apagado (WEB_PROVEEDOR=APAGADO).',
    });
  }
}

/// Cuánto se espera por una respuesta. Estas consultas
/// buscan en internet antes de contestar, así que tardan.
const ESPERA = 90_000;

/**
 * Le pregunta a Claude, con búsqueda en internet.
 *
 * Se eligió una API con búsqueda y no una IA a secas porque
 * lo que se necesita son datos de HOY: un modelo contestando
 * de memoria daría la dirección que tenía la empresa cuando
 * lo entrenaron.
 */
@Injectable()
export class ProveedorWebClaude implements ProveedorWeb {
  private readonly log = new Logger('BuscadorWeb');

  async consultar(nit: string): Promise<RespuestaWeb> {
    const clave = process.env.WEB_API_KEY;
    if (!clave) return { estado: 'FALLO', error: 'Falta WEB_API_KEY.' };

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': clave,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.WEB_MODELO ?? 'claude-sonnet-5',
          max_tokens: 1500,
          // la búsqueda es lo que hace que el dato sea de hoy
          tools: [
            { type: 'web_search_20250305', name: 'web_search', max_uses: 4 },
          ],
          messages: [{ role: 'user', content: laPregunta(nit) }],
        }),
        signal: AbortSignal.timeout(ESPERA),
      });

      if (!r.ok) {
        const detalle = await r.text();
        return {
          estado: 'FALLO',
          error: `El buscador contestó ${r.status}: ${detalle.slice(0, 200)}`,
        };
      }

      const cuerpo = (await r.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };

      // la respuesta viene en trozos: los de texto son los
      // que llevan la ficha, los demás son la búsqueda
      const crudo = (cuerpo.content ?? [])
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text as string)
        .join('\n')
        .trim();

      if (!crudo) return { estado: 'SIN_RESULTADO' };

      const ficha = leerFichaWeb(crudo);
      if (!ficha.razonSocial) {
        this.log.warn(`Sin razón social para el NIT ${nit}.`);
        return { estado: 'SIN_RESULTADO' };
      }

      return { estado: 'ENCONTRADO', ficha, crudo };
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      return { estado: 'FALLO', error: mensaje.slice(0, 300) };
    }
  }
}
