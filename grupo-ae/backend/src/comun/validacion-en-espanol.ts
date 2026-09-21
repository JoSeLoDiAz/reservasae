/** Los mensajes de validación que llegan a la pantalla, en español. */

/**
 * POR QUÉ HACE FALTA.
 *
 * Casi todos los DTO del CRM escriben su propio mensaje en español
 * («El valor va en pesos enteros.»). Pero un decorador sin
 * `{ message }` responde con el texto de fábrica de class-validator,
 * en inglés, y el panel lo pinta tal cual: el login decía «correo
 * must be an email» y el cajón «nota must be shorter than or equal to
 * 1000 characters» (auditoría del 18 sep 2026).
 *
 * Aquí NO se reescriben los mensajes propios: solo se traduce el que
 * se reconoce como de fábrica —empieza por el nombre del campo y
 * sigue en inglés—. Así un DTO que ya habla bien sigue diciendo
 * exactamente lo que dice, y ninguna validación se quita.
 *
 * La forma de la respuesta no cambia: `{ statusCode: 400, message:
 * string[], error }`, que es la que lee `pedir.ts` en el panel.
 */

import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/// Cómo se nombra cada campo en una frase. Lo que no está aquí se
/// dice genérico («Este dato»): mejor eso que el nombre de una
/// propiedad de código en la pantalla de un cliente.
const NOMBRES: Record<string, string> = {
  correo: 'El correo',
  clave: 'La contraseña',
  celular: 'El celular',
  nombre: 'El nombre',
  titulo: 'El título',
  nota: 'La nota',
  motivo: 'El motivo',
  valor: 'El valor',
  cantidad: 'La cantidad',
  nit: 'El NIT',
  razonSocial: 'La razón social',
  probabilidad: 'La probabilidad',
  etapa: 'La etapa',
  embudo: 'El embudo',
};

function nombreDe(campo: string): string {
  return NOMBRES[campo] ?? 'Este dato';
}

/// Un mensaje es «de fábrica» si empieza por el nombre de la
/// propiedad y sigue en inglés. Los propios del CRM nunca empiezan
/// así.
function esDeFabrica(mensaje: string, campo: string): boolean {
  return (
    mensaje.startsWith(`${campo} `) ||
    mensaje.startsWith('property ') ||
    /^(each value in )?\S+ (must|should|has failed)/.test(mensaje)
  );
}

function traducir(clave: string, campo: string, mensaje: string): string {
  const quien = nombreDe(campo);
  const numero = /(\d[\d.,]*)/.exec(mensaje)?.[1];
  switch (clave) {
    case 'isEmail':
      return 'Escriba un correo válido, por ejemplo nombre@empresa.com.';
    case 'maxLength':
      return `${quien} admite hasta ${numero ?? 'el máximo de'} caracteres.`;
    case 'minLength':
      return `${quien} necesita al menos ${numero ?? 'unos'} caracteres.`;
    case 'isEnum':
    case 'isIn':
      return `${quien}: elija una opción de la lista.`;
    case 'isInt':
      return `${quien} va en número entero.`;
    case 'isNumber':
    case 'isNumberString':
      return `${quien} va en número.`;
    case 'min':
      return `${quien} no puede ser menor que ${numero ?? 'el mínimo'}.`;
    case 'max':
      return `${quien} no puede ser mayor que ${numero ?? 'el máximo'}.`;
    case 'isString':
      return `${quien} va en texto.`;
    case 'isBoolean':
      return `${quien} va como sí o no.`;
    case 'isNotEmpty':
    case 'isDefined':
      return `Falta ${quien.toLowerCase()}.`;
    case 'isDateString':
    case 'isISO8601':
    case 'isDate':
      return `${quien} no es una fecha válida.`;
    case 'arrayMaxSize':
      return `${quien} trae demasiados elementos.`;
    case 'whitelistValidation':
      return 'La solicitud trae un dato que no se esperaba. Recargue la página e intente de nuevo.';
    default:
      return `${quien} no es válido.`;
  }
}

/// Aplana los errores anidados (DTO dentro de DTO) en frases.
function frases(errores: ValidationError[], padre = ''): string[] {
  const fuera: string[] = [];
  for (const e of errores) {
    const campo = e.property;
    for (const [clave, mensaje] of Object.entries(e.constraints ?? {})) {
      fuera.push(esDeFabrica(mensaje, campo) ? traducir(clave, campo, mensaje) : mensaje);
    }
    if (e.children?.length) fuera.push(...frases(e.children, `${padre}${campo}.`));
  }
  /// Sin repetir: dos decoradores del mismo campo pueden acabar en la
  /// misma frase traducida.
  return [...new Set(fuera)];
}

/** Para `new ValidationPipe({ exceptionFactory })`. */
export function errorDeValidacionEnEspanol(errores: ValidationError[]) {
  return new BadRequestException(frases(errores));
}
