import { ConsultaReservas } from "@/components/consulta-reservas";

export const metadata = { title: "Consultar mis reservas · Convoca" };

export default function PaginaConsulta() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        {/* Sin enlace a la raíz: devuelve 404 a propósito, no hay índice. */}
        <span className="text-sm font-medium text-marca">Convoca</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Consultar mis reservas
        </h1>
        <p className="mt-3 text-texto-suave">
          Escriba el NIT de su organización para ver los cupos reservados,
          cambiar la cantidad o cancelar.
        </p>
      </header>

      <ConsultaReservas />
    </main>
  );
}
