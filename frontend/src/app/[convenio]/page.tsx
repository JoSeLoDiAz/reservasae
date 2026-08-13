import { FormularioReserva } from "@/components/formulario-reserva";
import { EncabezadoPublico, PiePublico } from "@/components/marca-publica";

/** Una página para todos los convenios. */
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
