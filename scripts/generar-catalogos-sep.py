"""Genera los catálogos del SEP desde docs/sep/*.csv.

Se corre a mano cuando el SEP cambie sus tablas:

    python scripts/generar-catalogos-sep.py

Escribe backend/src/crm/catalogos-sep.generado.ts, que NO se
edita a mano. Lo derivado del catálogo (validación, mapas,
reglas) vive en catalogos-sep.ts, que sí se edita.
"""

import csv
import io
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN = os.path.join(RAIZ, "docs", "sep")
DESTINO = os.path.join(RAIZ, "backend", "src", "crm", "catalogos-sep.generado.ts")

# los centinelas del SEP: existen en su tabla pero no son
# valores que una persona pueda elegir
CENTINELAS = {
    "departamento": {1, 100},
    "ciudad": {1, 68000, 100},
    "caracterizacion": set(),
}


def leer(fichero):
    ruta = os.path.join(ORIGEN, fichero)
    if not os.path.exists(ruta):
        sys.exit("Falta %s. Exporte la tabla del SEP a ese fichero." % ruta)
    with io.open(ruta, encoding="utf-8-sig", newline="") as fh:
        return [{k: (v or "").strip() for k, v in fila.items()} for fila in csv.DictReader(fh)]


def texto(valor):
    return "'" + valor.replace("\\", "\\\\").replace("'", "\\'") + "'"


def bloque(nombre, tipo, filas, comentario=""):
    cuerpo = "\n".join("  " + f + "," for f in filas)
    cabecera = "/// %s\n" % comentario if comentario else ""
    return "%sexport const %s: %s[] = [\n%s\n];\n" % (cabecera, nombre, tipo, cuerpo)


def main():
    partes = [
        "/** Catálogos del SEP. GENERADO: no editar a mano.",
        " *  Se rehace con: python scripts/generar-catalogos-sep.py",
        " */",
        "",
        "export type ValorSep = { id: number; etiqueta: string };",
        "",
    ]

    # ── tipo de documento ──
    docs = leer("tipodocumentoidentidad.csv")
    filas = []
    for d in docs:
        filas.append(
            "{ id: %s, etiqueta: %s, sigla: %s, persona: %s, empresa: %s }"
            % (
                d["TIPODOCUMENTOIDENTIDADID"],
                texto(d["TIPODOCUMENTOIDENTIDADNOMBRE"]),
                texto(d["TIPODOCUMENTOIDENTIDADSIGLA"].strip()),
                "true" if d["TIPODOCUMENTOIDENTIDADPERSONA"] == "1" else "false",
                "true" if d["TIPODOCUMENTOIDENTIDADEMPRESA"] == "1" else "false",
            )
        )
    partes.append(
        "export type TipoDocumentoSep = ValorSep & {\n"
        "  sigla: string;\n"
        "  /// Sirve para identificar a una persona.\n"
        "  persona: boolean;\n"
        "  /// Sirve para la empresa donde labora.\n"
        "  empresa: boolean;\n"
        "};\n"
    )
    partes.append(bloque("TIPOS_DOCUMENTO_SEP", "TipoDocumentoSep", filas))

    # ── género ──
    filas = [
        "{ id: %s, etiqueta: %s }" % (g["GENEROID"], texto(g["GENERONOMBRE"]))
        for g in leer("genero.csv")
    ]
    partes.append(bloque("GENEROS_SEP", "ValorSep", filas))

    # ── nivel ocupacional ──
    filas = [
        "{ id: %s, etiqueta: %s }" % (n["NIVELOCUPACIONALID"], texto(n["NIVELOCUPACIONALNOMBRE"]))
        for n in leer("nivelocupacional.csv")
    ]
    partes.append(bloque("NIVELES_OCUPACIONALES_SEP", "ValorSep", filas))

    # ── rango de edad ──
    filas = [
        "{ id: %s, etiqueta: %s }" % (r["RANGOEDADID"], texto(r["RANGOEDADNOMBRE"]))
        for r in leer("rangoedad.csv")
    ]
    partes.append(bloque("RANGOS_EDAD_SEP", "ValorSep", filas))

    # ── tamaño de empresa ──
    filas = [
        "{ id: %s, etiqueta: %s }" % (t["TAMANOEMPRESAID"], texto(t["TAMANOEMPRESANOMBRE"]))
        for t in leer("tamanoempresa.csv")
    ]
    partes.append(
        bloque(
            "TAMANOS_EMPRESA_SEP",
            "ValorSep",
            filas,
            "Decreto 957 de 2019: por ingresos y sector, no por empleados.",
        )
    )

    # ── caracterización de población ──
    filas = [
        "{ id: %s, etiqueta: %s, codigoVere: %s }"
        % (c["CARACTERIZACIONID"], texto(c["CARACTERIZACIONNOMBRE"]), c["CARACTERIZACIONCODIGOVERE"])
        for c in leer("caracterizacion.csv")
    ]
    partes.append("export type CaracterizacionSep = ValorSep & { codigoVere: number };\n")
    partes.append(
        bloque(
            "CARACTERIZACIONES_SEP",
            "CaracterizacionSep",
            filas,
            "DATO SENSIBLE (Ley 1581 art. 5). El reporte manda el id.",
        )
    )

    # ── departamentos ──
    centinelas = CENTINELAS["departamento"]
    filas = [
        "{ id: %s, etiqueta: %s, seleccionable: %s }"
        % (
            d["DEPARTAMENTOID"],
            texto(d["DEPARTAMENTONOMBRE"]),
            "false" if int(d["DEPARTAMENTOID"]) in centinelas else "true",
        )
        for d in sorted(leer("departamento.csv"), key=lambda x: int(x["DEPARTAMENTOID"]))
    ]
    partes.append("export type DepartamentoSep = ValorSep & { seleccionable: boolean };\n")
    partes.append(
        bloque("DEPARTAMENTOS_SEP", "DepartamentoSep", filas, "Su id es el código DANE.")
    )

    # ── municipios ──
    centinelas = CENTINELAS["ciudad"]
    ciudades = sorted(leer("ciudad.csv"), key=lambda x: int(x["CIUDADID"]))
    filas = [
        "[%s, %s, %s, %s]"
        % (
            c["CIUDADID"],
            c["DEPARTAMENTOID"],
            texto(c["CIUDADNOMBRE"]),
            "false" if int(c["CIUDADID"]) in centinelas else "true",
        )
        for c in ciudades
    ]
    partes.append(
        "/// [id, departamentoId, nombre, seleccionable]\n"
        "export type MunicipioSep = [number, number, string, boolean];\n"
    )
    partes.append(
        bloque("MUNICIPIOS_SEP", "MunicipioSep", filas, "Su id es el código DANE.")
    )

    io.open(DESTINO, "w", encoding="utf-8", newline="\n").write("\n".join(partes))

    print("escrito %s" % os.path.relpath(DESTINO, RAIZ))
    print(
        "  %d tipos de documento · %d generos · %d niveles · %d rangos"
        % (len(docs), len(leer("genero.csv")), len(leer("nivelocupacional.csv")), len(leer("rangoedad.csv")))
    )
    print(
        "  %d tamanos · %d caracterizaciones · %d departamentos · %d municipios"
        % (
            len(leer("tamanoempresa.csv")),
            len(leer("caracterizacion.csv")),
            len(leer("departamento.csv")),
            len(ciudades),
        )
    )


if __name__ == "__main__":
    main()
