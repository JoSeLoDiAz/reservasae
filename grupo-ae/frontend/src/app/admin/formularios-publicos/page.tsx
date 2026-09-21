"use client";

/** Los dos formularios que están en la calle, en una vista. */

/// Estaban en dos pantallas separadas y eso obligaba a ir y
/// volver para responder una pregunta que se hace todo el
/// tiempo: «¿esto en cuál de los dos se pide?». Son dos
/// momentos de UNA misma recolección -- lo que se pregunta en
/// el corto no se vuelve a pedir en el largo -- así que se
/// leen juntos o no se entienden.

import { useEffect, useState } from "react";

import { BloqueDeBanda } from "@/components/admin/bloques";
import {
  EnlacePublico,
  LoQuePregunta,
  type Bloque as BloqueDePreguntas,
} from "@/components/admin/formulario-publico";
import { useAdmin } from "@/components/admin/marco-admin";
import { CabeceraDePantalla, Seccion } from "@/components/admin/secciones";
import { adminApi } from "@/lib/admin-api";
import { campanasApi } from "@/lib/campanas-api";

const CORTO: BloqueDePreguntas[] = [
  {
    titulo: "Quién es",
    campos: [
      { etiqueta: "Tipo de documento", obligatorio: true },
      { etiqueta: "Número de documento", obligatorio: true },
      { etiqueta: "Primer nombre", obligatorio: true },
      { etiqueta: "Segundo nombre" },
      { etiqueta: "Primer apellido", obligatorio: true },
      { etiqueta: "Segundo apellido" },
      { etiqueta: "Género" },
    ],
  },
  {
    titulo: "Cómo ubicarlo",
    campos: [
      { etiqueta: "Celular" },
      { etiqueta: "Correo" },
      { etiqueta: "Departamento" },
      { etiqueta: "Ciudad" },
    ],
  },
  {
    titulo: "Qué necesita",
    campos: [{ etiqueta: "Servicio de interés", obligatorio: true }],
  },
  {
    titulo: "Permiso",
    campos: [
      {
        etiqueta: "Política y Tratamiento de Datos Personales",
        obligatorio: true,
      },
    ],
  },
];

const LARGO: BloqueDePreguntas[] = [
  {
    titulo: "Primero, su organización",
    campos: [
      { etiqueta: "¿A nombre de quién es la compra?" },
      { etiqueta: "NIT y dígito de verificación" },
      { etiqueta: "Razón social" },
      { etiqueta: "Dirección" },
      { etiqueta: "Teléfono" },
      { etiqueta: "Departamento y municipio" },
      { etiqueta: "Sector económico" },
      { etiqueta: "Número de trabajadores" },
      { etiqueta: "Quién aprueba la compra: nombre, cargo y correo" },
      { etiqueta: "O bien: «trabajo por mi cuenta», y su cédula es su RUT" },
      { etiqueta: "O bien: «no estoy trabajando», y ahí se le agradece" },
    ],
  },
  {
    titulo: "Después, lo suyo",
    campos: [
      { etiqueta: "Fecha de nacimiento" },
      { etiqueta: "Estrato" },
      { etiqueta: "Dirección y barrio" },
      { etiqueta: "Departamento y municipio donde vive" },
      { etiqueta: "Nivel educativo" },
      { etiqueta: "Cargo en la empresa" },
      { etiqueta: "Área de la empresa" },
      { etiqueta: "Si ya fue cliente antes" },
      { etiqueta: "Presupuesto estimado, opcional" },
    ],
  },
];

/// Lo que el Formulario 2 YA NO PREGUNTA en Grupo AE.
///
/// La fecha de nacimiento, el estrato y el «no estoy
/// trabajando» eran de la convocatoria del SENA; a quien viene a
/// cotizar licencias no se le piden. El enlace los oculta según
/// `NO_SE_PREGUNTAN` y `PREGUNTA_DEL_VINCULO`, en
/// `backend/src/crm/lo-que-no-se-pregunta.ts`, y esta lista tiene
/// que decir lo mismo que el enlace: una pantalla que le cuenta al
/// asesor que se pregunta el estrato, cuando no se pregunta, le
/// hace prometer un dato que nunca va a llegar.
///
/// Ocultos, no borrados: siguen en `LARGO`, y si el servidor los
/// vuelve a preguntar basta con sacarlos de aquí.
const OCULTOS_EN_EL_LARGO = new Set([
  "Fecha de nacimiento",
  "Estrato",
  "O bien: «no estoy trabajando», y ahí se le agradece",
]);

const LARGO_VISIBLE: BloqueDePreguntas[] = LARGO.map((b) => ({
  ...b,
  campos: b.campos.filter((c) => !OCULTOS_EN_EL_LARGO.has(c.etiqueta)),
}));

type Cual = "CORTO" | "LARGO";

export default function FormulariosActivos() {
  const { gremios, gremio } = useAdmin();
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [cual, setCual] = useState<Cual>("CORTO");
  const [campanas, setCampanas] = useState<string[]>([]);

  useEffect(() => {
    void adminApi
      .convenios()
      .then((cs) => {
        const m: Record<string, string> = {};
        for (const c of cs) m[c.id] = c.slug;
        setSlugs(m);
      })
      .catch(() => undefined);
    /// Sugerencias para el enlace. Si el correo está caído, el
    /// enlace se sigue armando escribiendo el nombre a mano.
    void campanasApi
      .listar()
      .then((cs) => setCampanas([...new Set(cs.map((c) => c.nombre))]))
      .catch(() => undefined);
  }, []);

  const cuales = gremio
    ? gremios.filter((g) => g.convenioId === gremio)
    : gremios;

  return (
    <div className="flex min-h-0 grow flex-col">
      {/* El nombre entero va AQUI. En el menu se llama
          «Formularios Personas», hermano de «Formularios
          Empresas»: los dos juntos se leen como los dos que
          son, y ninguno sale cortado en la barra. */}
      <CabeceraDePantalla
        titulo="Formularios activos"
        nota="Los dos momentos de una misma recolección. El corto es público y trae a la persona al embudo; el largo se le manda después, uno por uno, y solo le pregunta lo que le falte."
      />

      {/* Pestañas y no dos páginas: la pregunta que uno trae
          aquí casi siempre es «¿esto en cuál se pide?», y esa
          se responde comparando, no navegando.

          El azul de marca marca LO SELECCIONADO AHORA MISMO,
          que es uno de sus cuatro usos. No hay bandeja teñida
          debajo: sería un cuarto fondo para no decir nada. */}
      <Seccion>
        <div
          role="tablist"
          aria-label="Cuál de los dos formularios"
          className="flex gap-1 px-6 py-2.5"
        >
          {(
            [
              ["CORTO", "Formulario 1 · Corto"],
              ["LARGO", "Formulario 2 · Largo"],
            ] as Array<[Cual, string]>
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={cual === valor}
              onClick={() => setCual(valor)}
              className={`rounded-[6px] px-3 py-[6px] transition ${
                cual === valor
                  ? "bg-marca text-marca-texto"
                  : "text-texto-suave hover:text-texto"
              }`}
              style={{ fontSize: "0.8125rem", fontWeight: cual === valor ? 600 : 400 }}
            >
              {texto}
            </button>
          ))}
        </div>
      </Seccion>

      {cual === "CORTO" ? (
        <>
          {/* UNA banda con dos bloques dentro, no dos bandas.
              Lo que se dice del formulario corto y lo que
              pregunta son la misma cosa contada seguida: los
              separa el aire y su rótulo, no una franja. */}
          <Seccion>
            <div className="space-y-6 px-6 pt-5 pb-6">
              <BloqueDeBanda
                rotulo="Formulario 1 · Corto"
                nota="Público, el mismo para todos. Se reparte por QR y por enlace."
              >
                <p
                  className="max-w-[68ch] text-texto"
                  style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
                >
                  Los datos básicos. Con esto la persona ya entra al embudo y se le
                  puede hacer seguimiento. Pedirle más en este punto es perderlo.
                </p>
              </BloqueDeBanda>

              <BloqueDeBanda rotulo="Lo que le pregunta">
                <LoQuePregunta bloques={CORTO} />
                <p
                  className="mt-4 max-w-[68ch] text-texto-suave"
                  style={{ fontSize: "0.71875rem" }}
                >
                  Lo marcado con <span aria-hidden>*</span> es obligatorio. El resto
                  se le vuelve a pedir en el Formulario 2, y solo lo que falte.
                </p>
              </BloqueDeBanda>
            </div>
          </Seccion>

          {/* LAS DOS DIRECCIONES, UNA AL LADO DE LA OTRA.

              Cada una traía su propia banda, y cada banda
              gastaba 758 px —540 los dos campos con su
              dirección, 190 el QR— de los 1636 que mide la
              banda a 1920. Novecientos píxeles de papel, dos
              veces, en la pantalla que se abre para copiar un
              enlace y pegarlo en un anuncio.

              Y no es solo ancho: la de empresas y la de personas
              no se reparten en los mismos sitios, así que lo que
              se viene a hacer aquí es elegir CUÁL, y eso se hace
              comparando. Apiladas, comparar es desplazarse.

              1560 px es 758 + 40 + 758. Por debajo se apilan, y
              entonces cada una usa su banda entera. Consulta de
              contenedor: la barra lateral se pliega y la banda
              gana 180 px sin que la ventana cambie. */}
          <Seccion>
            <div className="@container px-6 pt-5 pb-6">
              <div className="grid gap-x-10 gap-y-8 @[1560px]:grid-cols-2">
                {cuales.map((g) =>
                  slugs[g.convenioId] ? (
                    <EnlacePublico
                      key={g.convenioId}
                      sigla={g.sigla}
                      slug={slugs[g.convenioId]}
                      ruta={`/${slugs[g.convenioId]}/preinscripcion`}
                      campanas={campanas}
                    />
                  ) : null,
                )}
              </div>
            </div>
          </Seccion>
        </>
      ) : (
        <Seccion>
          <div className="@container space-y-6 px-6 pt-5 pb-6">
            {/* LOS DOS PÁRRAFOS, UNO AL LADO DEL OTRO.

                Son prosa y topan en 68 caracteres, que es lo
                correcto: una línea de 1350 px se pierde al
                volver al renglón siguiente. Pero dos bloques de
                68 ch apilados dejan mil cien píxeles en blanco a
                la derecha de los dos, y eso no es la regla de la
                prosa: es el hueco otra vez. Al lado, la banda se
                usa entera y la lista de preguntas —que es lo que
                se viene a mirar— sube ciento ochenta píxeles. */}
            <div className="grid gap-x-10 gap-y-6 @[1100px]:grid-cols-2">
              <BloqueDeBanda
                rotulo="Formulario 2 · Largo"
                nota="Personal y de un solo uso. No es público."
              >
                <p
                  className="max-w-[68ch] text-texto"
                  style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
                >
                  Lo que falta para poder cerrar el negocio con la persona. Se le
                  manda después de que llene el corto.
                </p>
              </BloqueDeBanda>

              <BloqueDeBanda rotulo="Este no tiene QR, y no es un olvido">
                <div
                  className="max-w-[68ch] space-y-2"
                  style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}
                >
                  <p>
                    Cada enlace de este formulario es{" "}
                    <strong className="font-normal text-titulo">
                      personal y de un solo uso
                    </strong>
                    : se emite desde la ficha del lead, caduca, y el siguiente anula
                    al anterior.
                  </p>
                  <p className="text-texto-suave">
                    Un QR pegado en una pared solo puede llevar a un sitio, y esta
                    dirección cambia por persona. {/* Mandaba a un botón «Enlace
                    para que complete sus datos» que en Grupo AE no existe: la
                    frase ya no promete lo que la pantalla no tiene. */}
                    Por ahora este enlace lo emite soporte a pedido; escríbale con
                    el nombre de la persona y se lo enviamos.
                  </p>
                </div>
              </BloqueDeBanda>
            </div>

            <BloqueDeBanda rotulo="Lo que le pregunta">
              <LoQuePregunta bloques={LARGO_VISIBLE} />
              <p
                className="mt-4 max-w-[68ch] text-texto-suave"
                style={{ fontSize: "0.71875rem" }}
              >
                Solo se le pregunta lo que falta. Lo que ya dio en el corto no se le
                vuelve a pedir.
              </p>
            </BloqueDeBanda>
          </div>
        </Seccion>
      )}
    </div>
  );
}
