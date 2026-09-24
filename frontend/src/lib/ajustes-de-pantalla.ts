/** Los ajustes de Accesibilidad de UNA persona, guardados en su cuenta. */

/// Por qué existe.
///
/// La escala del texto y las dos ayudas vivían solo en el
/// `localStorage`, o sea en el equipo: quien subía la letra al 110 %
/// en el monitor grande volvía al 100 % al entrar desde el portátil y
/// creía que la interfaz había cambiado de tamaño sola. «Que viaje con
/// su cuenta, como ya viajan sus colores propios» (23 sep 2026).
///
/// El navegador SIGUE guardando su copia, y es a propósito: es la que
/// pinta el tamaño antes de que React monte --sin ella la primera
/// pantalla saldría al 100 % y daría un salto--. El servidor es la
/// fuente que manda cuando las dos no coinciden.

import { pedir } from "./pedir";
import type { Ajustes } from "./accesibilidad";

export const ajustesDePantallaApi = {
  /// Nulo = esa cuenta nunca guardó ajustes. No es lo mismo que el
  /// 100 %: con nulo, lo que vale es lo que haya en este navegador, y
  /// es lo que se sube a la cuenta.
  leer: () => pedir<Ajustes | null>("/admin/perfil/ajustes"),

  /// Solo lo que se tocó: el servidor lo suma a lo que ya tenía, así
  /// que mover la escala no apaga las ayudas.
  guardar: (cambios: Partial<Ajustes>) =>
    pedir<Ajustes>("/admin/perfil/ajustes", {
      method: "PATCH",
      body: JSON.stringify(cambios),
    }),
};
