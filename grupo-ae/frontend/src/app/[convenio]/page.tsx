import { FormularioReserva } from "@/components/formulario-reserva";
import { FondoPublico } from "@/components/fondo-publico";
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
      {/* 720 px y no 768: es el mismo tope que el formulario
          del panel, y el mismo que la preinscripción y el pie.
          El aire de la pública se da en vertical, no
          ensanchando la columna. */}
      <main className="mx-auto w-full max-w-[720px] px-6 py-12">
        <EncabezadoPublico />
        <div className="mt-8">
          <FormularioReserva slug={convenio} />
        </div>
      </main>
      <FondoPublico />
      <PiePublico />
    </>
  );
}
