import { CompletarFicha } from "@/components/completar-ficha";

/** La persona termina de diligenciar sus propios datos. */
export default async function PaginaCompletar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CompletarFicha token={token} />;
}
