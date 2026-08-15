/** Portada solo del entorno de pruebas: por donde entrar. */

import Link from "next/link";

type Destino = { href: string; titulo: string; descripcion: string };

const PUBLICO: Destino[] = [
  {
    href: "/britcham-adee",
    titulo: "Formulario · BRITCHAM ADEE",
    descripcion: "Lo que ve una empresa: elige curso y ubicación y aparta cupos.",
  },
  {
    href: "/adecopria",
    titulo: "Formulario · ADECOPRIA",
    descripcion: "El otro convenio, con su propia apariencia y sus preguntas.",
  },
  {
    href: "/consulta",
    titulo: "Consulta por NIT",
    descripcion: "Una empresa vuelve con su NIT a ver o cambiar lo que pidió.",
  },
];

const PANEL: Destino[] = [
  {
    href: "/admin",
    titulo: "Tablero",
    descripcion: "Avance contra la meta, ritmo y proyección.",
  },
  {
    href: "/admin/participantes",
    titulo: "Inscripciones",
    descripcion: "El CRM: tablero por etapas, lista y métricas.",
  },
  {
    href: "/admin/participantes/academico",
    titulo: "Seguimiento académico",
    descripcion: "Quién va al día y quién no, contra el calendario del grupo.",
  },
  {
    href: "/admin/participantes/brecha",
    titulo: "Brecha de nombres",
    descripcion: "Cupos reservados sin nadie detrás. A quién llamar hoy.",
  },
  {
    href: "/admin/marca",
    titulo: "Apariencia",
    descripcion: "Las plantillas, los 37 colores y las etapas del CRM.",
  },
];

function Lista({ titulo, destinos }: { titulo: string; destinos: Destino[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-wide text-texto-suave uppercase">
        {titulo}
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {destinos.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block h-full rounded-xl border border-borde bg-superficie p-4 transition hover:border-marca"
            >
              <span className="font-medium text-marca">{d.titulo}</span>
              <span className="mt-1 block text-sm text-texto-suave">{d.descripcion}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IndicePruebas() {
  return (
    <main className="mx-auto w-full max-w-3xl grow px-6 py-12">
      <h1 className="text-2xl font-semibold">Convoca — entorno de pruebas</h1>
      <p className="mt-2 text-texto-suave">
        Una copia completa del sistema con datos inventados. El sitio real no tiene
        esta portada: su raíz responde 404 a propósito, y aquí existe solo para no
        dejarle sin por dónde empezar.
      </p>

      <div className="mt-10 space-y-10">
        <Lista titulo="Lo que ve el público" destinos={PUBLICO} />
        <Lista titulo="El panel" destinos={PANEL} />
      </div>

      <p className="mt-10 rounded-xl border border-borde bg-superficie-alterna p-4 text-sm text-texto-suave">
        Para entrar al panel: <strong>ana.jaramillo@ejemplo.test</strong> con la
        contraseña <strong>Prueba2026*</strong>. Hay cuatro asesores sembrados y todos
        usan la misma.
      </p>
    </main>
  );
}
