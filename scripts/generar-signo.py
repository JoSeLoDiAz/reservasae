"""El signo de Convoca como PNG, para los correos.

En el panel el signo es un SVG dibujado que toma `currentColor`.
Un correo no puede usarlo: Gmail no renderiza SVG en <img> ni
admite `data:`. Así que se rasteriza aquí, con la MISMA
geometría que `frontend/src/components/admin/signo-convoca.tsx`
— si allí cambia el radio o el trazo, hay que volver a correr
esto.

Salen dos, claro y oscuro, porque el signo va del color del
TEXTO del encabezado y ese lo elige el administrador: sobre una
banda oscura va el blanco y sobre una clara el oscuro. Es la
misma razón por la que en el panel va en `currentColor`.

    python scripts/generar-signo.py
"""

import math

from PIL import Image, ImageDraw

# el mismo lienzo del SVG: viewBox 0 0 32 32
ESCALA = 24
LADO = 32 * ESCALA
CENTRO = (16 * ESCALA, 15.15 * ESCALA)
RADIO = 10.6 * ESCALA
TRAZO = 2.75 * ESCALA

# el arco: 260 grados, abierto ABAJO. La puerta va abajo y no
# es indiferente -- al nordeste seria la insignia de no leido.
DESDE, HASTA = 140, 400

DISCO = (16 * ESCALA, 25.75 * ESCALA, 3.1 * ESCALA)

SALIDAS = [
    ("frontend/public/signo-convoca.png", (255, 255, 255, 255)),
    ("frontend/public/signo-convoca-oscuro.png", (20, 16, 26, 255)),
]


def dibujar(color):
    im = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    caja = [
        CENTRO[0] - RADIO,
        CENTRO[1] - RADIO,
        CENTRO[0] + RADIO,
        CENTRO[1] + RADIO,
    ]
    d.arc(caja, start=DESDE, end=HASTA, fill=color, width=int(round(TRAZO)))

    # las puntas redondas, que arc() no pone
    for angulo in (DESDE, HASTA % 360):
        x = CENTRO[0] + RADIO * math.cos(math.radians(angulo))
        y = CENTRO[1] + RADIO * math.sin(math.radians(angulo))
        r = TRAZO / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)

    # la persona formada, en la abertura
    cx, cy, r = DISCO
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    return im.resize((128, 128), Image.LANCZOS)


if __name__ == "__main__":
    for ruta, color in SALIDAS:
        dibujar(color).save(ruta)
        print(f"escrito {ruta}")
