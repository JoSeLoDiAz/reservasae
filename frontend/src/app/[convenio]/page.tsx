import { FormularioReserva } from "@/components/formulario-reserva";
import { EncabezadoPublico, PiePublico } from "@/components/marca-publica";

/** Una sola página para todos los convenios; sale del slug. */
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
