/** Dónde está el navegador, aquí y en el servidor. */

/// Dos cosas de este proyecto abren un navegador: la consulta
/// al RUI y la validación de empresas por buscador. Las dos
/// necesitan lo mismo, y por eso la búsqueda vive en un solo
/// sitio.
///
/// En el servidor NO hay navegador de fábrica. La imagen es
/// `node:22-alpine`, y ahí Playwright tampoco puede bajarse el
/// suyo: no publica binarios para Alpine. Por eso el
/// Dockerfile instala el `chromium` del sistema y lo anuncia
/// en `CHROMIUM_RUTA`. Sin eso, las dos consultas fallan en
/// producción aunque funcionen perfecto en el portátil.

import { existsSync } from 'node:fs';

/// Donde suele estar, según la máquina. Alpine primero
/// porque es lo que corre en el servidor.
const CANDIDATOS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/**
 * La ruta del navegador, o null si no hay ninguno.
 *
 * `especifica` es la variable de quien pregunta -- por
 * ejemplo `WEB_NAVEGADOR_RUTA` --, para poder darle una
 * distinta a una de las dos sin tocar la otra.
 *
 * Devolver null NO es un error: en el portátil, Playwright
 * usa el Chromium que se bajó él solo y no hace falta decirle
 * nada. Es en el servidor donde importa.
 */
export function rutaDelNavegador(especifica?: string): string | null {
  const puestas = [especifica, process.env.CHROMIUM_RUTA].filter(
    (r): r is string => Boolean(r),
  );

  for (const r of puestas) {
    // si alguien la puso a mano, se respeta aunque no exista:
    // que falle diciendo la ruta es más útil que ignorarla
    if (existsSync(r)) return r;
  }

  return CANDIDATOS.find((r) => existsSync(r)) ?? null;
}

/// Si hay una pantalla donde dibujar. En un servidor no la
/// hay, salvo que se levante una virtual con Xvfb -- que es
/// lo que hace el arranque de la imagen cuando se le pide.
export function hayPantalla(): boolean {
  return process.platform === 'win32' || Boolean(process.env.DISPLAY);
}
