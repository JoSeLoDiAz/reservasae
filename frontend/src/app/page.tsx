import { notFound } from "next/navigation";

/**
 * La raíz no existe: devuelve 404.
 *
 * Es una decisión de producto, no un descuido. El enlace de cada convenio se
 * envía directamente a sus organizaciones, así que un índice público que
 * listara toda la oferta le daría al sitio una puerta de entrada que no debe
 * tener: cualquiera que llegara a reservasae.com vería de qué va todo y qué
 * entidades participan.
 *
 * Lo que sí existe:
 *   /britcham-adee   /adecopria   /consulta   /admin
 *
 * Se deja el archivo en vez de borrarlo para que quede escrito el porqué: sin
 * esto, el siguiente que pase por aquí pensaría que falta la página de inicio
 * y la volvería a crear.
 */
export default function SinPaginaDeInicio() {
  notFound();
}
