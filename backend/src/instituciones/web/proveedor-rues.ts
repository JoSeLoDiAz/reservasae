/** El registro mercantil, que es de donde salen estos datos. */

/**
 * El buscador web le pregunta a una IA que resume directorios. Esto le
 * pregunta al RUES, que es la fuente: el registro que llevan las cámaras
 * de comercio y que sincroniza Confecámaras.
 *
 * Frente al navegador:
 *
 *   - No hay muro, ni captcha, ni ventana, ni pantalla virtual. Es una
 *     petición HTTP.
 *   - No hay clave ni cuenta. El registro mercantil es información
 *     pública de circulación libre.
 *   - Tarda milisegundos, no minuto y medio.
 *   - Y NO necesita consenso: no es una IA que conteste distinto cada
 *     vez, es el registro. Lo que dice, dice.
 *
 * A cambio trae menos campos. El RUES no publica dirección, teléfono,
 * correo ni página web —se comprobó en varias empresas: los campos
 * existen y vienen vacíos—, y no sabe de tamaño ni de número de
 * empleados. Esos cinco siguen saliendo del buscador web o los pone el
 * asesor.
 *
 * Son dos llamadas:
 *
 *   1. Datos abiertos (Socrata) para encontrar la empresa por su NIT.
 *      Devuelve la matrícula y la cámara.
 *   2. El detalle del RUES con esa matrícula, que añade la DESCRIPCIÓN
 *      de la actividad CIIU. Esa descripción es el sector económico, y
 *      es el único sitio donde viene.
 *
 * La segunda es opcional: si falla, se devuelve lo de la primera.
 */

import { Injectable, Logger } from '@nestjs/common';

import type { FichaWeb } from './leer-ficha-web';
import type { ProveedorWeb, RespuestaWeb } from './proveedor-web';

/// Personas Naturales, Personas Jurídicas y Entidades Sin Ánimo de Lucro.
/// Lo publica Confecámaras y se refresca solo.
const DATOS_ABIERTOS = 'https://www.datos.gov.co/resource/c82u-588k.json';

/// El expediente, por cámara y matrícula. Sin autenticación.
const DETALLE_RUES = 'https://ruesapi.rues.org.co/WEB2/api/Expediente/DetalleRM';

const ESPERA = 15_000;

/// Lo que se necesita de cada fila del registro. Hay más columnas; estas
/// son las que se usan.
type FilaRegistro = {
  codigo_camara?: string;
  camara_comercio?: string;
  matricula?: string;
  razon_social?: string;
  sigla?: string;
  clase_identificacion?: string;
  numero_identificacion?: string;
  digito_verificacion?: string;
  cod_ciiu_act_econ_pri?: string;
  fecha_matricula?: string;
  fecha_renovacion?: string;
  ultimo_ano_renovado?: string;
  organizacion_juridica?: string;
  categoria_matricula?: string;
  estado_matricula?: string;
  fecha_actualizacion?: string;
};

type Detalle = {
  desc_ciiu_act_econ_pri?: string;
  cod_ciiu_act_econ_pri?: string;
  organizacion_juridica?: string;
  estado?: string;
  sigla?: string;
  razon_social?: string;
};

@Injectable()
export class ProveedorWebRues implements ProveedorWeb {
  private readonly log = new Logger('BuscadorWeb');

  async consultar(nit: string): Promise<RespuestaWeb> {
    const numero = nit.replace(/\D/g, '');
    if (!numero) return { estado: 'FALLO', error: 'Ese NIT no tiene dígitos.' };

    /// Antes de preguntar: los números de relleno traen basura, y de la
    /// peor clase -- empresas reales que no tienen nada que ver.
    if (esDeRelleno(numero)) {
      this.log.warn(`NIT ${numero}: es un número de relleno, no se consulta.`);
      return { estado: 'SIN_RESULTADO' };
    }

    let filas: FilaRegistro[];
    try {
      filas = await this.buscarPorNit(numero);
    } catch (e) {
      /// Un fallo de red sí se reintenta: mañana el portal está en pie.
      return { estado: 'FALLO', error: `No pude consultar el RUES: ${(e as Error).message}` };
    }

    const fila = elMejorRegistro(filas);
    if (!fila) {
      this.log.log(`NIT ${numero}: no está en el registro mercantil, o es ambiguo.`);
      return { estado: 'SIN_RESULTADO' };
    }

    /// Best effort: si el detalle no contesta, se sigue con lo que hay.
    const detalle = await this.detalle(fila).catch(() => null);

    const ficha = aFichaWeb(fila, detalle);
    if (!ficha.razonSocial) return { estado: 'SIN_RESULTADO', crudo: JSON.stringify(fila) };

    if (fila.estado_matricula && fila.estado_matricula !== 'ACTIVA') {
      this.log.warn(
        `NIT ${numero}: en el registro figura como ${fila.estado_matricula}, no ACTIVA.`,
      );
    }

    return {
      estado: 'ENCONTRADO',
      ficha,
      /// Se guarda lo que contestaron las dos fuentes. Si mañana cambian
      /// de forma, esto es lo único que dice en qué cambiaron. Lleva
      /// además el estado de la matrícula y el representante legal, que
      /// no caben en los catorce campos pero le sirven a quien revisa.
      crudo: JSON.stringify({ registro: fila, detalle }, null, 2),
    };
  }

  private async buscarPorNit(numero: string): Promise<FilaRegistro[]> {
    const url = `${DATOS_ABIERTOS}?numero_identificacion=${encodeURIComponent(numero)}&$limit=50`;
    const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA) });
    if (!r.ok) throw new Error(`datos.gov.co contestó ${r.status}`);
    return (await r.json()) as FilaRegistro[];
  }

  /// El id del expediente es la cámara a dos dígitos y la matrícula a
  /// diez. No viene dado: se arma con lo que trajo el registro.
  private async detalle(fila: FilaRegistro): Promise<Detalle | null> {
    const camara = (fila.codigo_camara ?? '').padStart(2, '0');
    const matricula = (fila.matricula ?? '').replace(/\D/g, '').padStart(10, '0');
    if (!camara.trim() || !Number(matricula)) return null;

    const r = await fetch(`${DETALLE_RUES}/${camara}${matricula}`, {
      signal: AbortSignal.timeout(ESPERA),
    });
    if (!r.ok) return null;

    const cuerpo = (await r.json()) as { codigo_error?: string; registros?: Detalle };
    if (cuerpo.codigo_error !== '0000') return null;
    return cuerpo.registros ?? null;
  }
}

/**
 * Un NIT puede salir en varias cámaras: la sede principal y sucursales
 * de otras ciudades, o matrículas viejas que nunca se cancelaron. Manda
 * la que está ACTIVA, y entre ellas la renovada más recientemente, que
 * es la que la empresa mantiene viva.
 */
export function elMejorRegistro(filas: FilaRegistro[]): FilaRegistro | null {
  const conNombre = filas.filter(
    (f) =>
      (f.razon_social ?? '').trim() &&
      /// Las filas «SIN IDENTIFICACION» son las que el registro no pudo
      /// atribuir a nadie. No sirven para responder por un NIT.
      f.clase_identificacion !== 'SIN IDENTIFICACION',
  );
  if (conNombre.length === 0) return null;

  const puntos = (f: FilaRegistro): number => (f.estado_matricula === 'ACTIVA' ? 1 : 0);
  const anio = (f: FilaRegistro): number => Number(f.ultimo_ano_renovado ?? 0) || 0;
  const renovacion = (f: FilaRegistro): number => Number(f.fecha_renovacion ?? 0) || 0;

  const ordenadas = [...conNombre].sort(
    (a, b) => puntos(b) - puntos(a) || anio(b) - anio(a) || renovacion(b) - renovacion(a),
  );

  /// Un mismo NIT en varias cámaras es normal: la principal y sus
  /// sucursales, con la misma razón social. Nombres DISTINTOS con el
  /// mismo número significan que el número no identifica a nadie, y
  /// entonces es mejor no contestar que contestar la empresa de otro.
  const activas = ordenadas.filter((f) => f.estado_matricula === 'ACTIVA');
  if (activas.length > 1 && !mismaEmpresa(activas)) return null;

  return ordenadas[0];
}

/// Genéricas: aparecen en media Colombia y no distinguen a nadie.
const DE_RELLENO = new Set([
  'LTDA', 'LIMITADA', 'ANONIMA', 'SOCIEDAD', 'SOCIEDADES', 'COMPANIA', 'EMPRESA',
  'EMPRESAS', 'GRUPO', 'SERVICIOS', 'SERVICIO', 'ASESORES', 'ASESORIAS',
  'CONSULTORES', 'SOLUCIONES', 'COLOMBIA', 'NACIONAL', 'LIQUIDACION',
  'SIMPLIFICADA', 'ACCIONES', 'COMERCIALIZADORA', 'DISTRIBUIDORA', 'INVERSIONES',
]);

/**
 * ¿Hablan todas de la misma empresa?
 *
 * Sí cuando comparten alguna palabra propia. «VISE LTDA» y «VIGILANCIA Y
 * SEGURIDAD LIMITADA VISE LTDA» comparten VISE: es la misma con su
 * nombre largo. «PREVEA ASESORES», «SUPER HELADOS OSITO» y
 * «DISTRIBUIDORA DE MINERALES» no comparten nada: son tres empresas
 * distintas apuntadas al mismo número de relleno.
 */
function mismaEmpresa(filas: FilaRegistro[]): boolean {
  const conjuntos = filas.map((f) => palabrasPropias(f.razon_social ?? ''));
  const [primera, ...resto] = conjuntos;
  if (!primera || primera.size === 0) return false;

  return resto.every((otra) => [...otra].some((p) => primera.has(p)));
}

function palabrasPropias(razonSocial: string): Set<string> {
  return new Set(
    razonSocial
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((p) => p.length > 3 && !DE_RELLENO.has(p)),
  );
}

/// Números que el registro usa como relleno, o que no pueden ser un
/// documento. Devuelven empresas reales que no tienen nada que ver.
export function esDeRelleno(numero: string): boolean {
  if (numero.length < 5) return true;
  return /^(\d)\1*$/.test(numero);
}

/**
 * Del registro a los catorce campos.
 *
 * Los que el RUES no publica se dejan en null a propósito, y hay uno que
 * merece explicación: la CIUDAD. Se podría poner la cámara de comercio,
 * pero una cámara no es un municipio -- la de Bogotá cubre decenas --, y
 * meter ahí un valor verosímil pero falso es justo lo que este sistema
 * evita en todas partes. Se deja vacío y lo pone quien sepa.
 */
export function aFichaWeb(fila: FilaRegistro, detalle: Detalle | null): FichaWeb {
  return {
    razonSocial: limpio(fila.razon_social),
    nombreComercial: limpio(fila.sigla ?? detalle?.sigla),
    fechaFundacion: aIso(fila.fecha_matricula),
    direccion: null,
    telefono: null,
    correo: null,
    paginaWeb: null,
    ciudadNombre: null,
    departamentoNombre: null,
    sectorEconomico: limpio(detalle?.desc_ciiu_act_econ_pri),
    codigoCiiu: limpio(fila.cod_ciiu_act_econ_pri ?? detalle?.cod_ciiu_act_econ_pri),
    clasificacion: clasificar(fila.organizacion_juridica ?? detalle?.organizacion_juridica),
    tamano: null,
    numeroEmpleados: null,
  };
}

/// «19820531» -> «1982-05-31», que es lo que `leerFecha` entiende. El
/// registro usa 00000000 y 99991231 como «no hay fecha».
export function aIso(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  if (!/^\d{8}$/.test(t) || t === '00000000' || t.startsWith('9999')) return null;

  const anio = Number(t.slice(0, 4));
  const mes = Number(t.slice(4, 6));
  const dia = Number(t.slice(6, 8));
  if (anio < 1800 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

/**
 * La figura jurídica del registro, dicha con las palabras que entiende
 * la tabla de `ficha-a-propuesta`.
 *
 * Lo que no se reconoce se deja en null: es mejor un campo vacío que
 * clasificar mal a una entidad en un reporte al SENA.
 */
export function clasificar(organizacion: string | undefined): string | null {
  const t = (organizacion ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (!t.trim()) return null;

  if (/sin animo de lucro|\besal\b|fundacion|corporacion/.test(t)) {
    return 'entidad sin animo de lucro';
  }
  if (/cooperativ|solidaria|fondo de empleados|mutual|precooperativ/.test(t)) {
    return 'entidad de economia solidaria';
  }
  if (/empresa asociativa de trabajo/.test(t)) return 'empresa asociativa de trabajo';
  if (/economia mixta|\bmixta\b/.test(t)) return 'economia mixta';
  if (/empresa (publica|industrial)|entidad publica|estado/.test(t)) return 'empresa publica';
  if (/\bgremio\b|agremiacion/.test(t)) return 'gremio';
  if (/\basociacion\b/.test(t)) return 'asociacion';

  /// Las formas mercantiles corrientes: sociedades de todo tipo,
  /// unipersonales y la persona natural comerciante.
  if (/sociedad|\bsas\b|limitada|anonima|comandita|colectiva|unipersonal|persona natural/.test(t)) {
    return 'empresa privada';
  }

  return null;
}

function limpio(v: string | undefined): string | null {
  const t = (v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t : null;
}
