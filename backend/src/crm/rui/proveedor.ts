/** De dónde sale el nombre del RUI. */

/// El CRM no sabe cómo se consulta el RUI, y no debe
/// saberlo: hoy es un navegador contra la Ventanilla
/// Social, mañana puede ser un servicio. Lo único
/// estable es esta forma, así que cambiar de método no
/// obliga a tocar la cola ni las pantallas.

export type ResultadoRui =
  | { estado: 'ENCONTRADO'; nombreCompleto: string }
  | { estado: 'SIN_RESULTADO' }
  | { estado: 'FALLO'; error: string };

export interface ProveedorRui {
  /** Un documento, un nombre. Puede tardar segundos. */
  consultar(tipoDocumentoSepId: number, numeroDocumento: string): Promise<ResultadoRui>;
}

export const PROVEEDOR_RUI = Symbol('PROVEEDOR_RUI');

/// El de local: NO sale a internet y NO consulta el RUI.
///
/// Devuelve un nombre marcado como simulado a proposito.
/// La primera version inventaba nombres humanos creibles
/// ("LUZ CAMILA PALMA RUIZ") y eso, puesto al lado de una
/// cedula real, se lee como un dato verdadero. Un simulador
/// tiene que parecer un simulador.
export class ProveedorRuiLocal implements ProveedorRui {
  constructor(private readonly demoraMs = 1500) {}

  async consultar(
    _tipoDocumentoSepId: number,
    numeroDocumento: string,
  ): Promise<ResultadoRui> {
    await new Promise((r) => setTimeout(r, this.demoraMs));

    const ultimo = Number(numeroDocumento.slice(-1));

    // un digito de cada diez no aparece en el RUI
    if (ultimo === 0) return { estado: 'SIN_RESULTADO' };
    // y otro falla, para ver el reintento
    if (ultimo === 9) return { estado: 'FALLO', error: 'La consulta no respondió.' };

    return {
      estado: 'ENCONTRADO',
      nombreCompleto: `SIMULADO · el RUI no está conectado (doc. ${numeroDocumento})`,
    };
  }
}

/** Verdadero mientras el detector sea el de mentira. */
export function ruiEsSimulado(): boolean {
  return !process.env.RUI_PROVEEDOR || process.env.RUI_PROVEEDOR === 'LOCAL';
}
