import { estilosDeMarca } from "@/lib/marca-servidor";

/** Pinta la paleta del formulario ya en el HTML. */
export default async function LayoutConvenio({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ convenio: string }>;
}) {
  const { convenio } = await params;
  const estilos = await estilosDeMarca(convenio);

  return (
    <>
      {estilos && <style dangerouslySetInnerHTML={{ __html: estilos }} />}
      {children}
    </>
  );
}
