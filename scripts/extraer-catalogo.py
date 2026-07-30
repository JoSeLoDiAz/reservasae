# -*- coding: utf-8 -*-
"""
Extrae el catálogo de acciones de formación desde los proyectos oficiales
(docs/proyectos/*.xlsx) y lo deja en backend/prisma/seed/catalogo.json.

Se ejecuta a mano cuando cambien los proyectos:

    python scripts/extraer-catalogo.py

El seed de Prisma lee el JSON, no el Excel: en producción no hay Python ni
openpyxl, y el Excel es un formato que se rompe con solo abrirlo y guardarlo.

De dónde sale cada cosa:
  - Hoja `Datos_AF`         → una fila por acción de formación (nombre, modalidad, horas).
  - Hoja `Datos_Cobertura`  → una fila por GRUPO. Las columnas `DEPARTAMENTO PRE` /
                              `CIUDAD PRE` / `BENEFICIARIOS` son la sede presencial;
                              los pares `DEPARTAMENTO n` / `BENEFICIARIOS n` son la
                              cobertura virtual repartida por departamento.
  - Hoja `Datos_Basicos`    → identidad de la entidad proponente (NIT, razón social).

El 30 % de sobrecupo se calcula sobre el total de CADA GRUPO y después se
reparte entre sus ubicaciones (ver `repartir_sobrecupo`). Así los totales
coinciden con la tabla oficial del proyecto: 2717 en BRITCHAM y 2080 en
ADECOPRIA.

OJO: el dashboard `docs/dahsboardexcel/Base Cursos.xlsx` da 2714 porque trunca
cada celda por separado. Ese número es el que está mal, no este.
"""

import json
import math
import os
import unicodedata

import openpyxl

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, "backend", "prisma", "seed", "catalogo.json")

SOBRECUPO = 0.30

PROYECTOS = [
    {
        "slug": "britcham-adee",
        "archivo": os.path.join(RAIZ, "docs", "proyectos", "06 - BRITCHAM - ADEE.xlsx"),
    },
    {
        "slug": "adecopria",
        "archivo": os.path.join(RAIZ, "docs", "proyectos", "01 - ADECOPRIA.xlsx"),
    },
]


def limpiar(valor):
    """Los proyectos traen espacios sobrantes y saltos de línea de Word."""
    if valor is None:
        return None
    texto = str(valor).replace("_x000D_", " ").replace("\r", " ").replace("\n", " ")
    texto = " ".join(texto.split()).strip()
    return texto or None


def normalizar_ubicacion(valor):
    """Mismo departamento escrito de tres formas distintas = un solo registro."""
    texto = limpiar(valor)
    if texto is None:
        return None
    return texto.upper()


def clave_sin_tildes(texto):
    """Para comparar 'BOGOTÁ' con 'BOGOTA' sin que sean dos ubicaciones."""
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def repartir_sobrecupo(celdas):
    """
    Reparte el 30 % de sobrecupo entre las ubicaciones de UN grupo.

    La regla no es redondear cada celda por su cuenta: el 30 % se calcula sobre
    el total del grupo y luego se reparte, de forma que las partes sumen
    exactamente ese total. Es lo que hace la tabla oficial del proyecto, donde
    la columna "BENEF. X GRUPO" es un número redondo: 50 -> 65 y 250 -> 325.

    Ejemplo real, el grupo 2 de la AF08: 250 x 1,3 = 325 exactos. Cuatro de sus
    celdas caen en ",5" (Santander 45,5 y tres de 32,5). Truncarlas todas daría
    323 y subirlas todas 327; ninguno de los dos es el número comprometido, así
    que dos suben y dos bajan.

    Método del mayor resto: se trunca todo, se cuenta cuántas unidades faltan
    para llegar al total del grupo y se reparten entre las celdas de fracción
    más alta. Los empates se rompen por base descendente y luego por nombre,
    para que el resultado no dependa del orden en que se leyó el Excel.
    """
    total_base = sum(c["cuposBase"] for c in celdas)
    # floor(x + 0,5) y no round(): round() en Python redondea 0,5 al par, que
    # aquí daría resultados sorprendentes según el número.
    total_maximo = int(math.floor(total_base * (1 + SOBRECUPO) + 0.5))

    exactos = [c["cuposBase"] * (1 + SOBRECUPO) for c in celdas]
    asignados = [int(math.floor(v)) for v in exactos]
    faltan = total_maximo - sum(asignados)

    orden = sorted(
        range(len(celdas)),
        key=lambda i: (
            -(exactos[i] - asignados[i]),
            -celdas[i]["cuposBase"],
            celdas[i]["ubicacion"],
        ),
    )
    for i in orden[:faltan]:
        asignados[i] += 1

    for celda, maximo in zip(celdas, asignados):
        celda["cuposMaximos"] = maximo


def columna(encabezados, *fragmentos):
    """Los encabezados del formato SENA tienen espacios dobles y tildes; se busca por fragmento."""
    for indice, texto in enumerate(encabezados):
        arriba = clave_sin_tildes(texto.upper())
        if all(clave_sin_tildes(f.upper()) in arriba for f in fragmentos):
            return indice
    return None


def leer_datos_basicos(libro):
    hoja = libro["Datos_Basicos"]
    filas = list(hoja.iter_rows(values_only=True))
    encabezados = [str(h) if h is not None else "" for h in filas[0]]
    fila = filas[1]

    def dato(*fragmentos):
        indice = columna(encabezados, *fragmentos)
        return limpiar(fila[indice]) if indice is not None else None

    return {
        "nombre": dato("NOMBRE DE LA ENTIDAD"),
        "sigla": dato("SIGLA"),
        "nit": dato("NUMERO DE IDENTIFICACION") or dato("NÚMERO DE IDENTIFICACION"),
        "digitoVerificacion": dato("DIGITO VERIFICACION"),
        "correo": dato("CORREO"),
        "telefono": dato("TELEFONO"),
        "departamento": dato("DEPARTAMENTO DE DOMICILIO"),
        "ciudad": dato("CIUDAD/MUNICIPIO DE DOMICILIO"),
        "direccion": dato("DIRECCION DE DOMICILIO"),
        "paginaWeb": dato("PAGINA WEB"),
    }


def leer_acciones(libro):
    hoja = libro["Datos_AF"]
    filas = list(hoja.iter_rows(values_only=True))
    encabezados = [str(h) if h is not None else "" for h in filas[0]]

    indices = {
        "consecutivo": columna(encabezados, "CONSECUTIVO DE LA ACCION"),
        "nombre": columna(encabezados, "NOMBRE DE LA ACCION"),
        "modalidad": columna(encabezados, "MODALIDAD DE FORMACION"),
        "evento": columna(encabezados, "EVENTO DE FORMACION"),
        "enfoque": columna(encabezados, "ENFOQUE DE LA ACCION"),
        "metodologia": columna(encabezados, "METODOLOGIA DE FORMACION"),
        "horas": columna(encabezados, "NUMERO DE HORAS POR GRUPO"),
        "objetivo": columna(encabezados, "OBJETIVO"),
        "ambiente": columna(encabezados, "AMBIENTE DE APRENDIZAJE"),
    }

    acciones = {}
    for orden, fila in enumerate(filas[1:], start=1):
        if indices["consecutivo"] is None or fila[indices["consecutivo"]] is None:
            continue
        consecutivo = int(fila[indices["consecutivo"]])
        acciones[consecutivo] = {
            "codigo": "AF%d" % consecutivo,
            "consecutivo": consecutivo,
            "orden": orden,
            "nombre": limpiar(fila[indices["nombre"]]),
            "modalidad": (limpiar(fila[indices["modalidad"]]) or "").upper() or None,
            "evento": limpiar(fila[indices["evento"]]),
            "enfoque": limpiar(fila[indices["enfoque"]]),
            "metodologia": limpiar(fila[indices["metodologia"]]),
            "horas": int(fila[indices["horas"]]) if fila[indices["horas"]] else None,
            "objetivo": limpiar(fila[indices["objetivo"]]),
            "ambiente": limpiar(fila[indices["ambiente"]]),
            "grupos": [],
        }
    return acciones


def leer_cobertura(libro, acciones):
    hoja = libro["Datos_Cobertura"]
    filas = list(hoja.iter_rows(values_only=True))

    for fila in filas[1:]:
        if fila[0] is None:
            continue
        consecutivo = int(fila[0])
        accion = acciones.get(consecutivo)
        if accion is None:
            continue

        # "GRUPO 3" → 3. El número importa: es el identificador del grupo dentro
        # de la acción, y admins y SENA se refieren a él por ese número.
        etiqueta = limpiar(fila[1]) or ""
        digitos = "".join(c for c in etiqueta if c.isdigit())
        numero = int(digitos) if digitos else len(accion["grupos"]) + 1

        coberturas = []

        # Sede presencial: departamento + ciudad + cuántos asisten en el sitio.
        ciudad = normalizar_ubicacion(fila[3])
        if ciudad and fila[4]:
            coberturas.append(
                {
                    "ubicacion": ciudad,
                    "tipo": "CIUDAD",
                    "departamento": normalizar_ubicacion(fila[2]),
                    "modalidad": "PRESENCIAL",
                    "cuposBase": int(fila[4]),
                }
            )

        # Cobertura virtual: hasta 25 pares departamento/beneficiarios.
        for i in range(5, 55, 2):
            if i + 1 >= len(fila):
                break
            if fila[i] and fila[i + 1]:
                coberturas.append(
                    {
                        "ubicacion": normalizar_ubicacion(fila[i]),
                        "tipo": "DEPARTAMENTO",
                        "departamento": normalizar_ubicacion(fila[i]),
                        "modalidad": "VIRTUAL",
                        "cuposBase": int(fila[i + 1]),
                    }
                )

        repartir_sobrecupo(coberturas)

        sede = next((c for c in coberturas if c["modalidad"] == "PRESENCIAL"), None)
        accion["grupos"].append(
            {
                "numero": numero,
                "sedeCiudad": sede["ubicacion"] if sede else None,
                "sedeDepartamento": sede["departamento"] if sede else None,
                "coberturas": coberturas,
            }
        )

    for accion in acciones.values():
        accion["grupos"].sort(key=lambda g: g["numero"])


def construir_ofertas(accion):
    """
    Lo que el público ve y reserva es (acción × ubicación), no el grupo: la
    persona elige curso y departamento/ciudad, y el reparto en grupos lo hace
    después el equipo. Por eso los cupos de los grupos se suman aquí.

    Se suman los máximos que ya repartió `repartir_sobrecupo` por grupo. No se
    vuelve a redondear aquí: el reparto ya garantiza que cada grupo suma su
    total exacto, y sumar grupos enteros conserva esa propiedad.
    """
    acumulado = {}
    for grupo in accion["grupos"]:
        for cobertura in grupo["coberturas"]:
            clave = (cobertura["ubicacion"], cobertura["tipo"])
            if clave not in acumulado:
                acumulado[clave] = {
                    "ubicacion": cobertura["ubicacion"],
                    "tipo": cobertura["tipo"],
                    "departamento": cobertura["departamento"],
                    "modalidad": cobertura["modalidad"],
                    "cuposBase": 0,
                    "cuposMaximos": 0,
                    "grupos": [],
                }
            acumulado[clave]["cuposBase"] += cobertura["cuposBase"]
            acumulado[clave]["cuposMaximos"] += cobertura["cuposMaximos"]
            acumulado[clave]["grupos"].append(grupo["numero"])
    return sorted(acumulado.values(), key=lambda o: (o["tipo"], o["ubicacion"]))


def main():
    convenios = []
    for proyecto in PROYECTOS:
        libro = openpyxl.load_workbook(proyecto["archivo"], data_only=True)
        basicos = leer_datos_basicos(libro)
        acciones = leer_acciones(libro)
        leer_cobertura(libro, acciones)

        lista = []
        for accion in sorted(acciones.values(), key=lambda a: a["consecutivo"]):
            accion["ofertas"] = construir_ofertas(accion)
            lista.append(accion)

        convenios.append(
            {
                "slug": proyecto["slug"],
                "entidad": basicos,
                "archivoOrigen": os.path.basename(proyecto["archivo"]),
                "acciones": lista,
            }
        )

    catalogo = {
        "sobrecupo": SOBRECUPO,
        "nota": (
            "Generado por scripts/extraer-catalogo.py desde docs/proyectos/. "
            "cuposMaximos ya incluye el 30% de sobrecupo por deserción."
        ),
        "convenios": convenios,
    }

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as destino:
        json.dump(catalogo, destino, ensure_ascii=False, indent=2)

    for convenio in convenios:
        grupos = sum(len(a["grupos"]) for a in convenio["acciones"])
        ofertas = sum(len(a["ofertas"]) for a in convenio["acciones"])
        base = sum(o["cuposBase"] for a in convenio["acciones"] for o in a["ofertas"])
        maximo = sum(o["cuposMaximos"] for a in convenio["acciones"] for o in a["ofertas"])
        print(
            "%-16s acciones=%-3d grupos=%-3d ofertas=%-3d base=%-5d maximo=%d"
            % (convenio["slug"], len(convenio["acciones"]), grupos, ofertas, base, maximo)
        )
    print("escrito en %s" % SALIDA)


if __name__ == "__main__":
    main()
