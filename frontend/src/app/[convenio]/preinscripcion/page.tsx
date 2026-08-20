import { PreinscripcionPublica } from "@/components/preinscripcion";

/** El formulario con el que alguien se inscribe solo. */
export default async function PaginaPreinscripcion({
  params,
}: {
  params: Promise<{ convenio: string }>;
}) {
  const { convenio } = await params;
  return <PreinscripcionPublica slug={convenio} />;
}
