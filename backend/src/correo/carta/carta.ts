/** La carta: el HTML con el que sale un correo del sistema. */

/**
 * UNA sola, y esa es la decision.
 *
 * Habia TRES envoltorios distintos --`aHtml` de las
 * plantillas, `armarHtml` de las campanas y el de
 * `bienvenida.ts`--, y los dos primeros eran el mismo `<div>`
 * con parrafos: sin cabecera, sin logos, sin colores del
 * gremio y sin pie. El cliente lo dijo en una linea: «la
 * plantilla no gusta». Con dos renderizadores, arreglar uno
 * deja el otro atras en silencio, que es el patron que este
 * proyecto lleva cuatro rondas documentando.
 *
 * La forma sale del correo de acceso, que el cliente ya
 * aprobo: banda con la marca arriba, placa BLANCA para los
 * logos --estan hechos para papel, y Gmail en modo oscuro
 * invierte el correo--, tarjeta clara, bordes de 1px y el
 * color en marcas pequenas y no en fondos.
 *
 * Lo que cambia respecto de aquel: aqui la banda lleva LOS
 * LOGOS DEL GREMIO y no la firma de Convoca. Lo pidio el
 * cliente con esas palabras — «los logos de ADECOPRIA y Grupo
 * AE en vez de CRM Convoca y su eslogan».
 */

import { escaparHtml } from '../escapar';
import type { Bloque } from './formato';

const F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";

/// Los de respaldo, por si a un gremio le falta un token. Son
/// los mismos que usa el correo de acceso.
const NEUTRO: Record<string, string> = {
  marca: '#4b3f52',
  texto: '#1c1720',
  textoSuave: '#5d5364',
  superficie: '#ffffff',
  fondo: '#f6f3f7',
  borde: '#e2dce6',
  encabezadoFondo: '#2b2333',
  encabezadoTexto: '#ffffff',
};

export type MarcaDeLaCarta = {
  /// Del tema CLARO ya fusionado del gremio.
  colores: Record<string, string | undefined>;
  /// Los del gremio, ya filtrados a los que se ven sobre
  /// blanco y con su URL publica absoluta.
  logos: Array<{ url: string; alt: string }>;
  /// Como se llama quien firma: la sigla del gremio.
  gremio: string;
  /// A donde se contesta. Es el buzon que manda de verdad.
  correoDeContacto: string | null;
  /// Por que le llega este correo a esta persona.
  porQueLoRecibe: string;
};

export type PiezasDeLaCarta = {
  asunto: string;
  bloques: Bloque[];
  marca: MarcaDeLaCarta;
  /// La imagen de cabecera que subio un administrador. Si la
  /// hay MANDA sobre los logos: alguien la eligio a proposito.
  cabezote?: string | null;
};

/// El color, o el neutro. Se valida porque acaba dentro de un
/// atributo `style`: un token tecleado a mano no puede meter
/// CSS en el correo de nadie.
function color(c: Record<string, string | undefined>, k: string): string {
  const v = c[k];
  return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? (v as string) : NEUTRO[k];
}

/** El HTML de un correo del sistema. */
export function cartaHtml(p: PiezasDeLaCarta): string {
  const c = (k: string) => color(p.marca.colores, k);
  const anio = new Date().getFullYear();

  /// LA CABECERA: o la imagen que subieron, o los logos sobre
  /// su placa blanca. Nunca las dos: serian los mismos logos
  /// dos veces, que es lo que pasaba con el cabezote puesto.
  const cabecera = p.cabezote
    ? `<tr><td style="padding:0;font-size:0;line-height:0">
         <img src="${escaparHtml(p.cabezote)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">
       </td></tr>`
    : p.marca.logos.length
      ? `<tr><td class="aire" align="center" style="background:${c('encabezadoFondo')};padding:26px 32px">
           <table role="presentation" cellpadding="0" cellspacing="0" align="center">
             <tr><td class="placa" bgcolor="#ffffff" style="background:#ffffff;border-radius:10px;padding:14px 22px">${p.marca.logos
               .map(
                 (l) =>
                   `<img src="${escaparHtml(l.url)}" alt="${escaparHtml(l.alt)}" height="42" style="height:42px;width:auto;margin:0 9px;vertical-align:middle;border:0">`,
               )
               .join('')}</td></tr>
           </table>
         </td></tr>`
      : `<tr><td class="aire" align="center" style="background:${c('encabezadoFondo')};padding:22px 32px">
           <div style="font:800 19px/1.2 ${F};color:${c('encabezadoTexto')};letter-spacing:-.01em">${escaparHtml(p.marca.gremio)}</div>
         </td></tr>`;

  /// La franja de acento: 4px del color del gremio. Es todo el
  /// color que lleva la carta fuera de la banda.
  const franja = `<tr><td style="height:4px;background:${c('marca')};font-size:0;line-height:0">&nbsp;</td></tr>`;

  const cuerpo = p.bloques.map((b) => bloque(b, c)).join('\n');

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(p.asunto)}</title>
<style>
  :root{color-scheme:light;supported-color-schemes:light}
  /* el cliente que invierte no puede llevarse la placa: esos
     logos estan hechos para papel */
  @media (prefers-color-scheme:dark){ .placa{background:#ffffff!important} }
  @media (max-width:620px){
    .caja{width:100%!important}
    .aire{padding-left:22px!important;padding-right:22px!important}
    /* en dos columnas un correo largo se parte a mitad de
       palabra: por debajo de 620 la etiqueta y el valor se
       apilan */
    .et,.va{display:block!important;width:100%!important}
    .et{padding:11px 0 0!important}
    .va{padding:2px 0 11px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c('fondo')}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c('fondo')};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" class="caja" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${c('superficie')};border:1px solid ${c('borde')};border-radius:14px;overflow:hidden">
      ${cabecera}
      ${franja}
      ${cuerpo}
      <tr><td class="aire" style="background:${c('encabezadoFondo')};padding:22px 32px">
        <div style="font:700 13px/1.5 ${F};color:${c('encabezadoTexto')}">${escaparHtml(p.marca.gremio)}</div>
        <div style="padding:4px 0 0;font:400 11.5px/1.6 ${F};color:${c('encabezadoTexto')};opacity:.8">
          ${p.marca.correoDeContacto ? `${escaparHtml(p.marca.correoDeContacto)}<br>` : ''}
          &copy; ${anio} ${escaparHtml(p.marca.gremio)}.<br>
          ${escaparHtml(p.marca.porQueLoRecibe)}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function bloque(b: Bloque, c: (k: string) => string): string {
  switch (b.tipo) {
    case 'TITULO':
      return `<tr><td class="aire" align="center" style="padding:30px 32px 6px">
        ${
          b.marca
            ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px"><tr>
                 <td width="54" height="54" align="center" valign="middle" style="background:${mezcla(c('marca'))};border-radius:27px;font:400 26px/54px ${F};color:${c('marca')}">${escaparHtml(b.marca)}</td>
               </tr></table>`
            : ''
        }
        <div style="font:800 22px/1.3 ${F};color:${c('texto')};letter-spacing:-.01em">${escaparHtml(b.texto)}</div>
      </td></tr>`;

    case 'SECCION':
      return `<tr><td class="aire" style="padding:24px 32px 0">
        <div style="font:700 11px/1.4 ${F};color:${c('textoSuave')};text-transform:uppercase;letter-spacing:.1em">${escaparHtml(b.texto)}</div>
      </td></tr>`;

    case 'PANEL':
      return `<tr><td class="aire" style="padding:16px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c('borde')};border-radius:11px">
          <tr><td style="padding:6px 20px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${b.filas
                .map(
                  (f) => `<tr>
                    <td class="et" width="170" valign="top" style="padding:9px 0;font:600 11.5px/1.4 ${F};color:${c('textoSuave')};text-transform:uppercase;letter-spacing:.06em">${escaparHtml(f.etiqueta)}</td>
                    <td class="va" valign="top" style="padding:9px 0 9px 16px;font:600 14.5px/1.45 ${F};color:${c('texto')};word-break:break-word">${escaparHtml(f.valor)}</td>
                  </tr>`,
                )
                .join('')}
            </table>
          </td></tr>
        </table>
      </td></tr>`;

    case 'LISTA':
      return `<tr><td class="aire" style="padding:14px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${b.puntos
            .map(
              (p) => `<tr>
                <td width="20" valign="top" style="padding:5px 0;font:400 15px/1.6 ${F};color:${c('marca')}">&#8226;</td>
                <td valign="top" style="padding:5px 0;font:400 15px/1.6 ${F};color:${c('texto')}">${enlazar(escaparHtml(p), c)}</td>
              </tr>`,
            )
            .join('')}
        </table>
      </td></tr>`;

    case 'NOTA':
      return `<tr><td class="aire" style="padding:18px 32px 0">
        <div style="border-left:3px solid ${c('marca')};padding:2px 0 2px 14px;font:400 14.5px/1.6 ${F};color:${c('textoSuave')}">${enlazar(escaparHtml(b.texto), c)}</div>
      </td></tr>`;

    default:
      return `<tr><td class="aire" style="padding:18px 32px 0;font:400 15px/1.65 ${F};color:${c('texto')}">
        ${enlazar(escaparHtml(b.texto), c).replace(/\n/g, '<br>')}
      </td></tr>`;
  }
}

/// El fondo del circulo: el mismo color de marca, muy
/// diluido. Un solo color da los dos, igual que en el panel.
function mezcla(hex: string): string {
  return `${hex}1f`;
}

/// Una direccion escrita a mano se vuelve enlace. Va DESPUES
/// de escapar, asi que lo que se enlaza ya es texto seguro.
function enlazar(escapado: string, c: (k: string) => string): string {
  return escapado.replace(
    /https?:\/\/[^\s<]+/g,
    (u) => `<a href="${u}" style="color:${c('marca')}">${u}</a>`,
  );
}
