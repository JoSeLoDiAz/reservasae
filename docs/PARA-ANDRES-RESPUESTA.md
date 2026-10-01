# La funcional está en producción — v0.16.0-JD

**1 de octubre de 2026, 23:52.** Commit `829b698`, etiqueta `v0.16.0`.

Entró `jose/funcional` entera, los 18 commits. Lee esto junto a `PARA-ANDRES.md`, que es
lo que se te pidió; aquí va lo que pasó con ello.

---

## Lo que se comprobó antes de subir

No se dio por bueno lo que dice tu mensaje: se verificó uno por uno, que es lo que tú
mismo pediste —«no te fíes de lo que entrego, sondea»—.

| Lo que afirmaste | Resultado |
|---|---|
| `jose/funcional` compila y pasa sola | ✅ las cuatro puertas · **2.383 pruebas en 210 suites**, el número exacto |
| `/admin/ocupacion` vuelve igual que en dev | ✅ `git diff dev jose/funcional` sobre los tres ficheros sale **vacío** |
| Tres migraciones aditivas | ✅ las tres como **altas nuevas**; ninguna edita una ya aplicada |
| Funde limpio | ✅ **fast-forward**, sin un conflicto |

Y las migraciones se probaron **contra una base con datos** antes de tocar producción:
desplegado primero en pruebas, pasaron de 77 a 80, el backend arrancó y las tres pantallas
contestaron 200.

### Los cuatro arreglos, comprobados en el código y no en la lista

- **`db:independientes`** importa `exigirBaseSegura` y lo llama en la línea 60, **antes**
  de la primera escritura (170, 184, 203), y solo con `--aplicar`. Además tiene **modo de
  solo mirar**, que es más de lo que se pidió y es lo que permitió ensayarlo antes de
  aplicarlo.
- **`propuestas-por-revisar.ts`** dejó la guarda por nombre y usa `guardia-de-base`.
- **`exigirQuienCargaPlano`** se llama **dentro del servicio** con `dto.convenioId`, en
  `crm.service.ts:4746` y `:5037`. El `puedeCargarPlano` de antes se queda solo para la
  pista del panel, y tu docblock lo explica.
- **`CrearNotaDto`** vuelve a declarar `resultado` como opcional, conviviendo con
  `categoriaId` y `subcategoriaId`. Con `forbidNonWhitelisted` lo que importa es que el
  campo esté declarado, y lo está.

### Y lo que más se miró: los dos specs que tocaste

`corregir-documento.spec.ts` y `dar-de-alta-organizacion.spec.ts` son de otra sesión, así
que se revisó el diff línea por línea. **Solo ganaron el séptimo argumento del
constructor**, con su comentario. Ni una aserción cambiada, ni una aflojada, y **ningún
spec borrado** en toda la rama. El aviso que diste sobre las resoluciones perdidas al
aplanar era exacto, y estaba bien resuelto.

## Lo que se corrió después

`pnpm db:independientes --aplicar`, una vez, como indicaste:

```
Aplicado: 35 con dígito nuevo, 41 añadidas al directorio, 40 independientes completados.
```

El directorio pasó de 233 a 274. Lo demás quedó intacto: 129 organizaciones, 289 fichas,
296 personas, 38 reservas, antes y después. Copia previa en
`~/reservasae-antes-de-v0.16.0-20261001-2349.sql.gz`.

## Lo que hiciste bien, y conviene que quede escrito

El corte es lo que permitió subirlo el mismo día. Tres cosas en particular:

- Que `jose/funcional` **compile y pase sola** no era gratis: tuviste que mover tres
  commits funcionales al otro lado porque arrastraban props que solo añade el bloque de
  forma. Sin eso, partir no habría servido de nada.
- Avisar de que al aplanar se perdían las resoluciones de los commits de fusión, **y decir
  cuál**. Eso es lo que convierte un fallo de compilación en un rato en vez de una tarde.
- Comprobar que el árbol de `jose/forma` es idéntico al de la rama mezclada. Es la prueba
  de que no se quedó nada suelto, y es exactamente la comprobación que había que hacer.

Y lo de `cf9a638`: darlo por bueno sin pelearlo, y además **partir el bloque de forma por
tu cuenta** separando lo que arregla de lo que decora, es lo que hace que la otra mitad sea
discutible en lugar de un todo o nada.

---

## Lo que sigue, y lo que falta

**El bloque de forma espera la fecha de José.** Está en `jose/forma` (`7cbda0b`), partido
en `forma-arregla` (12 commits, 21 ficheros) y `forma-apariencia` (1 commit, 43). Ninguna
de las dos está en `origin` todavía: **empújalas cuando él te diga**, que la fecha es suya
y no mía.

Lo que sí quedó claro al revisarlo es que `forma-arregla` **no es decoración** y así se le
presentó: filtros de columna inalcanzables en tablas de veintiuna columnas, la cabecera
comiéndose «Seguimiento de asesores», y Gestión de leads pintando más de 1.600 tarjetas en
vez de una tabla. Eso son defectos, no gusto.

**Las nueve brechas.** El reporte las da abiertas y dos no son código —el LMS, que sin
avance del aula impide certificar a nadie, y qué espera la columna `ESTADO` del SENA para
un retiro—. De las otras siete, José dirá el orden.

**Lo que hay que quitar en la siguiente.** `resultado` vuelve al DTO solo por la ventana
del despliegue, tal como lo dejaste escrito. Queda apuntado aquí para que no se quede.

**Y una cosa por si acaso:** la rama vieja `jose/dev-26sep` sigue en `origin`. Como dices,
es la mezclada — no se usó.
