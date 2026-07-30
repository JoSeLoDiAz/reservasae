import { FormularioReserva } from "@/components/formulario-reserva";
import { EncabezadoPublico, PiePublico } from "@/components/marca-publica";

/*
 * Una sola pagina sirve a los dos convenios: /britcham-adee y /adecopria. El
 * catalogo, los cupos y los textos salen del slug, asi que anadir un tercer
 * convenio no toca este archivo.
 *
 * El catalogo se pide desde el navegador y no aqui: en el servidor no aplica
 * el rewrite de next.config, y hacerlo desde el cliente ademas evita servir
 * una disponibilidad ya caducada por la cache.
 */
export default async function PaginaConvenio({
  params,
}: {
  params: Promise<{ convenio: string }>;
}) {
  const { convenio } = await params;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <EncabezadoPublico />
        <FormularioReserva slug={convenio} />
      </main>
      <PiePublico />
    </>
  );
}
