"use client";

import { useState } from "react";

import { Bloque, Encabezado } from "@/components/admin/piezas";
import { FormularioCambioClave } from "@/components/admin/cambio-clave";
import {
  Aviso,
  Boton,
  Campo,
  CLASE_CONTROL,
  useAdmin,
} from "@/components/admin/marco-admin";
import { FirmaConvoca, useEstado } from "@/components/firma-convoca";
import { adminApi } from "@/lib/admin-api";
import { ErrorApi } from "@/lib/api";

const ROLES: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  GESTOR: "Gestor",
  CONSULTA: "Consulta",
};

export default function PaginaPerfil() {
  const { admin, refrescar } = useAdmin();

  const [datos, setDatos] = useState({
    nombre: admin.nombre,
    cargo: admin.cargo ?? "",
    celular: admin.celular ?? "",
    organizacion: admin.organizacion ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function cambiar(campo: keyof typeof datos, valor: string) {
    setDatos((p) => ({ ...p, [campo]: valor }));
    setGuardado(false);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await adminApi.actualizarPerfil(datos);
      await refrescar();
      setGuardado(true);
    } catch (e) {
      setError((e as ErrorApi).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    /// Sin `gap` y sin relleno: las bandas SE TOCAN y las
    /// separa una regla de 1 px. El aire se gana quitando alto
    /// muerto, no metiendo bloques ni margen entre cajas.
    <div className="flex min-h-0 grow flex-col">
      <Encabezado
        titulo="Mi perfil"
        descripcion={`${admin.correo} · ${ROLES[admin.rol] ?? admin.rol}`}
      />

      {/* LOS DOS FORMULARIOS, UNO AL LADO DEL OTRO.

          Cada uno topa en 720 px, que está bien —un campo de
          correo no mide 1350 px nunca—, pero apilados dejaban
          novecientos píxeles en blanco a la derecha de los dos:
          a 1920 esta pantalla usaba el 44 % del ancho. Eso no es
          la regla del formulario, es el hueco otra vez. Es la
          respuesta b) de la regla de lista: el sobrante se dedica
          a una segunda región útil, y aquí la segunda región ya
          existía, estaba debajo.

          UNA banda con dos bloques dentro, y no dos bandas: los
          bloques dentro de una banda no llevan borde ni fondo, se
          separan por su rótulo en versalita y por el aire.

          1480 px es 720 + 40 + 720. Por debajo no caben los dos
          sin recortar un campo, y se apilan como antes. Y es
          consulta de CONTENEDOR: la barra lateral se pliega y la
          banda gana 180 px sin que la ventana cambie. */}
      <section className="banda @container">
        <div className="grid gap-x-10 gap-y-8 @[1480px]:grid-cols-2">
          <Bloque plano titulo="Mis datos">
            {/* Cada campo mide lo que mide su dato.

                Median 1530 px de ancho para escribir un nombre y un
                celular: no sobraba aire, sobraba ANCHO. Celular 180,
                nombre 320, porque una caja de mil pixeles para diez
                digitos dice que ahi caben mil caracteres. */}
            <form onSubmit={guardar} className="formulario">
              <div className="formulario-doble">
                <Campo etiqueta="Nombre completo">
                  <input
                    required
                    value={datos.nombre}
                    onChange={(e) => cambiar("nombre", e.target.value)}
                    className={CLASE_CONTROL + " ancho-nombre"}
                  />
                </Campo>

                <Campo etiqueta="Cargo">
                  <input
                    value={datos.cargo}
                    onChange={(e) => cambiar("cargo", e.target.value)}
                    className={CLASE_CONTROL + " ancho-nombre"}
                  />
                </Campo>

                <Campo etiqueta="Celular">
                  <input
                    value={datos.celular}
                    onChange={(e) => cambiar("celular", e.target.value)}
                    inputMode="tel"
                    className={CLASE_CONTROL + " ancho-celular"}
                  />
                </Campo>

                <Campo etiqueta="Organización">
                  <input
                    value={datos.organizacion}
                    onChange={(e) => cambiar("organizacion", e.target.value)}
                    className={CLASE_CONTROL + " ancho-nombre"}
                  />
                </Campo>
              </div>

              {(error || (guardado && !error)) && (
                <div className="mt-4">
                  {error && <Aviso tipo="error">{error}</Aviso>}
                  {guardado && !error && <Aviso tipo="exito">Datos guardados.</Aviso>}
                </div>
              )}

              {/* Separado por la raya: es el final del formulario y
                  nacía contra la caja de «Organización». */}
              <div className="border-hairline mt-6 border-t pt-4">
                <Boton type="submit" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </Boton>
              </div>
            </form>
          </Bloque>

          <Bloque
            plano
            titulo="Cambiar mi contraseña"
            descripcion="El correo no se puede cambiar desde aquí: es el identificador de la cuenta."
          >
            <div className="formulario">
              <FormularioCambioClave alTerminar={refrescar} />
            </div>
          </Bloque>
        </div>
      </section>

      <SobreConvoca />
    </div>
  );
}

/**
 * Qué es esto y qué versión está corriendo.
 *
 * Va en el perfil porque es donde uno mira cuando quiere
 * saber «¿dónde estoy y con qué?»: al reportar un problema,
 * el dato que siempre falta es la versión, y hasta ahora la
 * única forma de saberla era abrir /api/estado a mano.
 */
function SobreConvoca() {
  const estado = useEstado();
  const ano = estado ? new Date(estado.hora).getFullYear() : null;
  /// La misma fuente que la franja naranja (ENTORNO). La versión
  /// queda como respaldo por si el backend es anterior.
  const enPruebas =
    estado?.entorno === "prueba" || (estado?.version ?? "").includes("prueba");

  return (
    <Bloque titulo="Sobre el CRM">
      <FirmaConvoca tamano={40} />

      {/* LOS CUATRO DATOS SALEN DE LA PROSA.

          Estaban dentro del tope de 68 caracteres, así que cuatro
          rótulos de una palabra se apretaban en dos columnas de
          240 px con mil de blanco al lado. No son prosa: son
          datos, y los datos van en columna. El tope de 68 ch se
          queda donde manda, que es el párrafo de abajo. */}
      <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-4">
        <Dato titulo="Versión" valor={estado?.version ?? "…"} mono />
        <Dato
          titulo="Entorno"
          valor={
            !estado
              ? "…"
              : enPruebas
                ? "Pruebas · los datos son inventados"
                : "Producción · datos reales"
          }
        />
        <Dato titulo="Gestionado para" valor="Grupo AE" />
        <Dato
          titulo="Derechos"
          valor={ano ? `© ${ano}, todos los derechos reservados` : "…"}
        />
      </dl>

      <p className="secundario prosa mt-6">
        La versión sale del propio servidor, no de una constante escrita a mano:
        es la que de verdad está corriendo. Si va a reportar algo, es el dato que
        conviene copiar.
      </p>
    </Bloque>
  );
}

/** Una etiqueta con su valor. */
function Dato({
  titulo,
  valor,
  mono,
}: {
  titulo: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="rotulo-bloque">{titulo}</dt>
      <dd className={`dato mt-1 ${mono ? "tabular-nums" : ""}`}>{valor}</dd>
    </div>
  );
}
