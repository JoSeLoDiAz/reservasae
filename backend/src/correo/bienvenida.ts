/** El correo de quien estrena cuenta. */

/// Va con LOS COLORES DE LA MARCA y no con un gris cualquiera:
/// lo pidió la dirección. Salen de la tabla `temas` —y del
/// formulario del gremio, si la cuenta es de uno—, así que
/// cambiar la paleta del panel cambia también el correo.

import { escaparHtml } from './escapar';

export type PuertaDelPanel = { etiqueta: string; url: string };

export type GremioDeLaCuenta = { slug: string; sigla: string };

export type DatosDeBienvenida = {
  nombre: string;
  correo: string;
  claveTemporal: string;
  /// El nombre de su papel, ya en palabras.
  papel: string;
  gremios: string[];
  puertas: PuertaDelPanel[];
  /// Del tema CLARO ya fusionado. Se cae a un neutro si falta.
  colores: Record<string, string | undefined>;
  /// El signo de Convoca, ya elegido claro u oscuro. Null sin
  /// `URL_PUBLICA`.
  signo: string | null;
  /// Los de la entidad: Grupo AE, o los del gremio. Absolutos
  /// y públicos, o ninguno — una imagen rota arriba del todo es
  /// peor que no poner nada. La `alt` es el nombre de la
  /// entidad, que es para lo que existe la etiqueta.
  logos: Array<{ url: string; alt: string }>;
  nombreApp: string;
  eslogan: string;
};

const NEUTRO = {
  marca: '#4b3f52',
  texto: '#1c1720',
  textoSuave: '#5d5364',
  superficie: '#ffffff',
  fondo: '#f6f3f7',
  borde: '#e2dce6',
  encabezadoFondo: '#2b2333',
  encabezadoTexto: '#ffffff',
};

const color = (c: Record<string, string | undefined>, k: keyof typeof NEUTRO) =>
  /^#[0-9a-fA-F]{6}$/.test(c[k] ?? '') ? (c[k] as string) : NEUTRO[k];

/**
 * Si ese color es claro.
 *
 * Decide cuál de los dos signos va: el blanco sobre una banda
 * oscura y el oscuro sobre una clara. Es la misma pregunta que
 * en el panel resuelve `currentColor` sin preguntar nada.
 */
export function esClaro(hex: string | undefined): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex ?? '')) return true;
  const n = parseInt((hex as string).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

/** Lista en palabras: «A», «A y B», «A, B y C». */
export function enPalabras(cosas: string[]): string {
  if (cosas.length === 0) return '';
  if (cosas.length === 1) return cosas[0];
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/**
 * Por dónde puede entrar DE VERDAD esta cuenta.
 *
 * La puerta general solo si la deja entrar: en producción está
 * cerrada a quien no es superadmin, y mandarle a alguien un
 * enlace que lo rechaza es el mismo defecto que ofrecerle un
 * botón que después da 403.
 */
export function puertasDe(datos: {
  hostDelSitio: string;
  esSuperadmin: boolean;
  puertaGeneralSoloSuperadmin: boolean;
  gremios: GremioDeLaCuenta[];
  hostDeGremio: (slug: string) => string;
}): PuertaDelPanel[] {
  const puertas: PuertaDelPanel[] = [];

  const general = !datos.puertaGeneralSoloSuperadmin || datos.esSuperadmin;
  if (general) {
    puertas.push({
      etiqueta: 'Panel general',
      url: `https://${datos.hostDelSitio}/admin`,
    });
  }

  for (const g of datos.gremios) {
    puertas.push({
      etiqueta: g.sigla,
      url: `https://${datos.hostDeGremio(g.slug)}/admin`,
    });
  }
  return puertas;
}

/** El asunto, el texto plano y el HTML. */
export function armarBienvenida(d: DatosDeBienvenida): {
  asunto: string;
  texto: string;
  html: string;
} {
  const c = (k: keyof typeof NEUTRO) => color(d.colores, k);
  const donde = enPalabras(d.gremios);
  const asunto = `Su acceso a ${d.nombreApp}`;

  const texto = [
    `Hola, ${d.nombre}.`,
    '',
    `Ya tiene cuenta en ${d.nombreApp}.`,
    '',
    'SU ACCESO',
    `  Usuario:    ${d.correo}`,
    `  Contraseña: ${d.claveTemporal}`,
    '  Es temporal: al entrar se le pide cambiarla.',
    '',
    'SU PAPEL',
    `  ${d.papel}${donde ? ` en ${donde}` : ''}`,
    '',
    'POR DÓNDE ENTRA',
    ...d.puertas.map((p) => `  ${p.etiqueta}: ${p.url}`),
    '',
    'Si no esperaba este correo, no haga nada y avísenos.',
  ].join('\n');

  /// La firma va PRIMERO: el signo, el nombre y DEBAJO el
  /// eslogan, con la línea entre medias. Es la misma de la
  /// barra del panel, en el mismo orden.
  const signo = d.signo
    ? `<tr><td align="center" style="padding:0 0 14px">
         <img src="${escaparHtml(d.signo)}" alt="" width="46" height="46" style="display:block;width:46px;height:46px;border:0">
       </td></tr>`
    : '';

  const firma = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${signo}
      <tr><td align="center" style="font:800 22px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif;color:${c('encabezadoTexto')};letter-spacing:-.02em">${escaparHtml(d.nombreApp)}</td></tr>
      <tr><td align="center" style="padding:9px 0 8px"><div style="width:120px;height:1px;background:${c('encabezadoTexto')};opacity:.35;font-size:0;line-height:0">&nbsp;</div></td></tr>
      <tr><td align="center" style="font:400 13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:${c('encabezadoTexto')};opacity:.85">${escaparHtml(d.eslogan)}</td></tr>
    </table>`;

  /// Y DESPUÉS el de la entidad: Grupo AE, o los del gremio.
  /// Van sobre la tarjeta clara y no sobre la banda: están
  /// hechos para papel y necesitan su placa blanca.
  const deLaEntidad = d.logos.length
    ? `<tr><td class="aire" style="padding:26px 40px 0" align="center">${d.logos
        .map(
          (l) =>
            `<img src="${escaparHtml(l.url)}" alt="${escaparHtml(l.alt)}" height="46" style="height:46px;width:auto;margin:0 10px;vertical-align:middle;border:0">`,
        )
        .join('')}</td></tr>`
    : '';

  /// En el movil se apilan: en dos columnas, un correo largo
  /// se parte a mitad de palabra y no hay sitio que ganar.
  const fila = (etiqueta: string, valor: string) =>
    `<tr>
       <td class="et" style="padding:9px 0;font:600 12px/1.4 system-ui,sans-serif;color:${c('textoSuave')};text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">${etiqueta}</td>
       <td class="va" style="padding:9px 0 9px 18px;font:600 15px/1.4 ui-monospace,Menlo,Consolas,monospace;color:${c('texto')};word-break:break-word">${valor}</td>
     </tr>`;

  const puerta = (p: PuertaDelPanel) =>
    `<tr><td style="padding:7px 0">
       <a href="${escaparHtml(p.url)}" style="font:600 15px/1.4 system-ui,sans-serif;color:${c('marca')};text-decoration:none">${escaparHtml(p.etiqueta)}</a>
       <div style="font:400 13px/1.5 system-ui,sans-serif;color:${c('textoSuave')};word-break:break-all">${escaparHtml(p.url)}</div>
     </td></tr>`;

  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(asunto)}</title>
<style>
  @media (max-width:620px){
    .caja{width:100%!important}
    .aire{padding-left:22px!important;padding-right:22px!important}
    .et,.va{display:block!important;width:100%!important}
    .et{padding:11px 0 0!important}
    .va{padding:3px 0 11px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c('fondo')}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c('fondo')};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" class="caja" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${c('superficie')};border:1px solid ${c('borde')};border-radius:14px;overflow:hidden">

      <tr><td class="aire" style="background:${c('encabezadoFondo')};padding:34px 40px 32px">${firma}</td></tr>

      ${deLaEntidad}

      <tr><td class="aire" style="padding:26px 40px 0;font:400 16px/1.6 system-ui,sans-serif;color:${c('texto')}">
        <div style="border-top:1px solid ${c('borde')};padding:24px 0 0">
          Hola, <strong>${escaparHtml(d.nombre)}</strong>.
          <div style="padding:10px 0 0;color:${c('textoSuave')}">Ya tiene cuenta en ${escaparHtml(d.nombreApp)}.</div>
        </div>
      </td></tr>

      <tr><td class="aire" style="padding:24px 40px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c('borde')};border-radius:11px">
          <tr><td style="padding:6px 20px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${fila('Usuario', escaparHtml(d.correo))}
              ${fila('Contraseña', escaparHtml(d.claveTemporal))}
            </table>
          </td></tr>
        </table>
        <div style="padding:9px 2px 0;font:400 13px/1.5 system-ui,sans-serif;color:${c('textoSuave')}">Esa contraseña es temporal: al entrar se le pide cambiarla.</div>
      </td></tr>

      <tr><td class="aire" style="padding:26px 40px 0">
        <div style="font:700 11px/1.4 system-ui,sans-serif;color:${c('textoSuave')};text-transform:uppercase;letter-spacing:.1em">Su papel</div>
        <div style="padding:6px 0 0;font:600 16px/1.45 system-ui,sans-serif;color:${c('texto')}">${escaparHtml(d.papel)}</div>
        ${donde ? `<div style="padding:2px 0 0;font:400 14px/1.5 system-ui,sans-serif;color:${c('textoSuave')}">en ${escaparHtml(donde)}</div>` : ''}
      </td></tr>

      <tr><td class="aire" style="padding:26px 40px 0">
        <div style="font:700 11px/1.4 system-ui,sans-serif;color:${c('textoSuave')};text-transform:uppercase;letter-spacing:.1em;padding:0 0 4px">Por dónde entra</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.puertas.map(puerta).join('')}</table>
      </td></tr>

      <tr><td class="aire" style="padding:28px 40px 34px">
        <div style="font:400 13px/1.6 system-ui,sans-serif;color:${c('textoSuave')};border-top:1px solid ${c('borde')};padding:18px 0 0">Si no esperaba este correo, no haga nada y avísenos.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { asunto, texto, html };
}
