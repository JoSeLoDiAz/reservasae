import { ConsultaReservas } from "@/components/consulta-reservas";

export const metadata = { title: "Estado de mi solicitud · Grupo AE" };

export default function PaginaConsulta() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        {/* sin enlace a la raíz */}
        <span className="text-sm font-medium text-marca">Grupo AE</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Consultar mis solicitudes
        </h1>
        <p className="mt-3 text-texto-suave">
          Escriba el NIT de su organización para ver el estado de sus
          solicitudes, actualizarlas o cancelarlas.
        </p>
      </header>

      <ConsultaReservas />
    </main>
  );
}
