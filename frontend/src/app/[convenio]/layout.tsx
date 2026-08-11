import { estilosDeMarca } from "@/lib/marca-servidor";

/**
 * Pinta la paleta del formulario ya en el HTML.
 *
 * Sin esto, la primera visita se ve con los colores por defecto hasta que el
 * navegador pide la marca. Si el backend no responde no emite nada y todo
 * sigue como antes.
 */
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
