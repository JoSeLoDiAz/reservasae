# Para José — lo que hay que hacer

**Una sola lista.** Solo está aquí lo que **no puedo hacer yo**: ejecutar migraciones, y
decisiones o datos que solo tú tienes. Todo lo demás ya está hecho y commiteado.

Rama: `arq/crm-hardening`.
Estado hoy (23 sep 2026): **`tsc` limpio en backend y frontend · 1.918 pruebas en 171 suites, verde.**

**Lo nuevo está en la Parte B, justo debajo** --la entrega del 23 de septiembre, que es la más
grande--. Después viene la Parte A (21 de septiembre) y luego lo anterior, que puede que ya lo
hayas hecho.

---

## Parte A · Desplegar la entrega del 21 de septiembre de 2026

Son **17 commits encima de tu `dev` (v0.8.2-JD)**, de `8d045c9` a `0538c29`. Se funden
**sin conflictos**: comprobado con `git merge-tree --write-tree origin/dev arq/crm-hardening`
el 21 sep. Tú no tienes ninguna migración que la rama no tenga.

### A.1 · Una migración, y hay que reconstruir el backend

- **`20260921190000_tema_propio_por_persona`**: añade `administradores."temaPropio" JSONB`,
  nullable y sin relleno. No toca ninguna fila: quien no ha elegido colores sigue viendo la
  paleta general, igual que hoy. Está en `backend/prisma/migrations/`, así que se aplica sola
  al arrancar el contenedor. Rollback: `ALTER TABLE "administradores" DROP COLUMN "temaPropio";`.
- **El backend cambia de API**, así que el orden importa: **backend primero, después
  frontend**. Con el frontend nuevo contra el backend viejo, Apariencia y el informe de
  Reservas dan 404.
  - Nuevas: `GET /admin/perfil/tema`, `PATCH /admin/perfil/tema/:esquema`,
    `POST /admin/perfil/tema/:esquema/restablecer` y `GET /admin/tableros/informe-reservas`.
  - `GET /admin/yo` devuelve además `puede.editarMarca`.
  - `porDia` de `/admin/embudo-publico` trae además `personas` y `eligieron`.
  - La lista de participantes acepta `asesorId=NINGUNO` y `cola=POR_TRABAJAR`.
  - Nueve rutas de marca y logos, más `PATCH /admin/formularios/:id/apariencia`, dejan de
    pedir SUPERADMIN y piden estar en `EDITORES_DE_MARCA` (A.2).

### A.2 · Una variable nueva en el backend: `EDITORES_DE_MARCA`

Correos de acceso separados por comas: **el tuyo, el de Diana y el de la Sra. Catalina**.
Según el correo de Adrián, el de Catalina es `catalina@grupo-ae.com.co`; confírmalo.

- Solo esas cuentas cambian logos, textos, colores del sistema y colores de cada gremio.
  **Ser superadmin ya no basta**: Mauricio pidió expresamente que ni él pueda.
- **Sin la variable no los cambia nadie.** Es a propósito: un olvido de configuración no
  puede dejar la puerta abierta.
- Los colores de cada persona no dependen de esto: cualquiera elige los suyos en
  Apariencia y le quedan solo a ella.
- Para editar los colores de un gremio **entrando por su subdominio**, además de estar en
  la lista hace falta permiso de configuración en ese gremio: el ámbito es lo que dice de
  quién es el formulario.

Está documentada en `backend/.env.example`.

### A.3 · Después de desplegar, a mano

1. **Devolver el panel a sus colores.** Producción amaneció granate porque el antiguo
   «Guardar colores» escribía la paleta de todos. Uno de los tres editores entra a
   Apariencia y pulsa **«Restablecer los colores del sistema»**.
2. **`pnpm db:datos-completos`**, primero sin `--aplicar` para ver cuántas pasaría, y
   después con `--aplicar` y `PERMITIR_PRODUCCION=si`. Con `cae50ad`, llenar los datos
   propios ya mueve la etapa, pero lo que quedó mal antes no se arregla solo.
3. **Rotar la llave de Lucid**: se pegó dos veces en el chat.
4. La **ficha de prueba de Mauricio** que quedó en producción.
5. Antes de cargar personas reales, sigue en pie lo de `PANEL_POR_TUNEL` (Parte 0, punto 4).

### A.4 · Lo que va a notar el equipo

| Qué cambió | Dónde |
|---|---|
| **Apariencia** sale en el menú para todos; los colores que cada quien guarda son solo suyos | Configuración → Apariencia |
| Logos, textos y colores de todos, solo para los tres correos | Apariencia; a los demás ni se les ven esos botones |
| **Pasar a Inscrito** solo exige que la persona tenga organización; que a la organización le falten sector o jefe ya no bloquea (la ficha sigue avisando qué falta) | Gestión de leads |
| Llenar los datos propios ya mueve a «Datos completos», sin llegar al paso de la empresa | Formulario de completar |
| Control de Inscritos tiene un menú **«Informes»**: Tráfico del formulario, Proceso de inscripción, Comité Marketing y **Reservas** (nuevo). Tráfico salió del menú Inscripciones y `/admin/trafico` redirige | Inscripciones → Control de Inscritos |
| «Qué atender primero» abre la lista ya filtrada | Proceso de inscripción |
| El embudo se dibuja como cintas; la tira de arriba da porcentajes que suman 100 | Proceso de inscripción |
| Tráfico vuelve al diseño que conocen (tarjetas de color, Día a día, tres cortes) | Tráfico del formulario |
| **«Ficha» pasa a «lead»** en todo el texto del panel y en los mensajes del servidor. En la Mesa, «Ya son ficha» pasa a «Convertidos». La bitácora ya escrita sigue diciendo «Ficha creada»: no se reescribió la base | Todo el panel |

### A.5 · Te devuelvo la pelota: dudas para que decidas e implementes

Salieron al construir esto. En cada una va qué pasa hoy, qué genera la duda, qué haría yo
y dónde se cambia. Si no haces nada, queda como hoy.

**1. ¿Un cupo sigue «con nombre» si la persona deserta?**
- *Hoy:* en el informe de Reservas y en «Cupos apartados por empresas», un cupo tiene
  nombre cuando una persona vinculada a esa reserva llegó **alguna vez** a inscrito,
  deserte después o no. En los datos locales, 8 de los 46 cupos con nombre son de personas
  que desertaron.
- *La duda:* el informe sirve para pedirle nombres a cada empresa. Si alguien deserta, la
  silla vuelve a estar libre y la empresa tendría que mandar a otra persona, pero el
  informe la sigue dando por cubierta.
- *Qué haría:* descontar a los que desertaron del «ya tienen nombre», para que vuelvan a
  «siguen sin nombre», y decir aparte «N desertaron» para que no desaparezcan. Antes de
  cambiarlo, confirma que el SENA no los cuenta como cupo usado.
- *Dónde:* el `con_nombre` de `backend/src/tableros/informe-de-reservas.ts` y el de la
  cobertura en `backend/src/crm/control.ts`, que **tienen que llevar la misma regla**: con
  reglas distintas el informe abría con una cifra y el bloque desde el que se hizo clic
  decía otra. Pruebas: `el-informe-de-reservas-cuadra.spec.ts` y
  `cupos-con-nombre-por-reserva.spec.ts`.

**2. ¿Cuentan como nombre las personas que siguen en proceso?**
- *Hoy:* solo cuenta quien llegó a inscrito. En una organización hay 21 personas
  vinculadas a su reserva y 13 inscritas; las otras 8 están en Interesado, Contactado o
  Datos completos.
- *La duda:* esas 8 ya tienen nombre, pero pueden no inscribirse nunca.
- *Qué haría:* dejar la regla como está, porque contarlas inflaría la cobertura, y añadir
  una columna **«En proceso»** para que se vea que hay nombres en camino y no se les pidan
  otra vez.
- *Dónde:* los mismos dos `con_nombre` y la tabla «Resumen por acción de formación» de
  `frontend/src/components/admin/panel-reservas.tsx`.

**3. ¿«Se preinscribieron» cuenta preinscripciones o leads nuevos?**
- *Hoy:* la cifra de la tarjeta sale del hito `REGISTRADO`, que incluye los `REPETIDA`
  (alguien que ya estaba; el servidor contesta lo mismo). La serie por día y los cortes
  cuentan solo los nuevos. La tarjeta lo dice en su pie: «N leads nuevos · M ya estaban».
- *La duda:* la cifra y su gráfica pequeña no suman lo mismo cuando hay repetidos.
- *Qué haría:* dejarlo así: la cifra es lo que pasó en el formulario, y el pie dice cuánto
  fue nuevo. Si prefieres que todo cuente solo los nuevos, cambia `hitos()`.
- *Dónde:* `hitos()` contra `porDia()` en `backend/src/embudo/embudo.service.ts`, y la
  tarjeta en `frontend/src/components/admin/panel-trafico.tsx`.

**4. La palabra «ficha» que no es de una persona**
- *Hoy:* Mauricio dijo «nada de nada es ficha, todo es lead», y así quedó todo lo que
  nombra a una persona. Se dejaron dos usos que no son personas:
  - La **ficha de una organización**: `instituciones/[id]/page.tsx` (líneas 430, 716,
    770, 776 y 1030), `propuestas-pendientes.tsx` y
    `backend/src/instituciones/instituciones.service.ts:407`.
  - La **ficha del SENA**, que es un grupo o cohorte: `panel-proceso.tsx:2226`.
- *Qué haría:* la de la organización, decir «la organización» o «el registro de la
  organización»; la del SENA, dejarla, porque es el término oficial y los formatos SEP son
  el contrato.

**5. «De dónde salen estos datos» nunca aparece en la ficha del lead.** Esto es de código,
no de decisión.
- *Hoy:* `useDatosVivos(cargar, { activo: false })` también se salta la primera carga
  (`if (!activo) return;` en `frontend/src/lib/datos-vivos.ts:73`), así que nunca se pide
  `/admin/leads/comparativo`. Ya pasaba antes de esta entrega.
- *Qué haría:* que `activo: false` apague solo el refresco periódico y no la primera carga.

**6. Punto 3 de Adrián: fechas de inicio de las acciones.**
- *Hoy:* Adrián reporta que las fechas de inicio del catálogo no coinciden con el
  cronograma oficial del Drive de Grupo AE. No tengo acceso a ese Drive (el conectado es
  de otra cuenta).
- *Qué haría:* compararlas acción por acción y corregirlas en Calendario → Catálogo, con
  la cuenta que tenga permiso. Es dato, no código.

### A.6 · Detalles menores conocidos (no bloquean)

- Embudo de cintas: a 320 px uno de los textos de caída parte en dos renglones; al
  imprimir, las cintas se montan sobre los rótulos por la regla de `globals.css`
  `section [class*="grid-cols"]`.
- Día a día en el celular con 16 a 30 días de datos: las columnas quedan finas para tocar
  una con el dedo.
- Ficha del lead a 390 px, pestaña Empresa: el editor se sale por la derecha. Ya pasaba.
- Cabecera a 1024 px: el chevron de «Configuración» se monta sobre el rótulo del usuario.
- `eslint` marca `setPagina(1)` dentro de un efecto en
  `frontend/src/app/admin/participantes/page.tsx:105`. Ya estaba.

---

## Parte B · La entrega del 23 de septiembre de 2026

**Esta es la más grande de todas, y casi toda es interfaz.** El cliente se sentó una noche
entera frente al panel y fue corrigiendo pantalla por pantalla. No es un rediseño mío: cada
cambio de abajo tiene su frase suya detrás, y las dejé citadas en los comentarios del código
por si mañana alguien se pregunta por qué.

Hay **dos cosas que cambian números** y **una decisión que te toca a ti**. Empiezo por esas.

---

### B1 · Las reservas dejaron de descontar cupo (cambia el presupuesto de pauta)

En **Comité Marketing** la cuenta de «Cupos pend.» era
`total cupos − reservados − inscritos`. El cliente lo paró: *«las reservas no descuentan, no
entiendo por qué cambias esto, se materializa cuando llega, ahí sí»*.

Y tiene razón: una reserva es una **intención** —una organización aparta cupos en una ciudad,
sin nombres, y puede no llegar nadie—. El cupo se consume cuando la persona queda **inscrita**,
y eso ya lo cuenta la columna «Inscritos». Restar las dos cosas contaba el mismo cupo dos
veces y **hacía comprar menos pauta de la que hace falta**.

Ahora es `total cupos − inscritos`. La columna «Reservados» se queda como información, pero no
toca la cuenta. Con los datos de prueba, el total pasó de 465 a 497 cupos pendientes, de 1.290
a 1.386 leads de pauta y de 15,5 a **16,6 M** de presupuesto. En producción el salto será
parecido: **avisa a quien use esa cifra para comprar.**

Está en `frontend/src/components/admin/comite-marketing.tsx`, función `calcular`, con el
comentario que explica el porqué. El backend no cambió: manda los mismos datos.

### B2 · Los ajustes de pantalla ahora viajan con la cuenta (migración nueva)

La escala de texto de Accesibilidad (90-140 %) y las dos ayudas vivían en el `localStorage`
del navegador, así que se quedaban en el equipo: quien subía la letra al 110 % en el monitor
grande volvía al 100 % al entrar desde el portátil.

Ahora van en la fila del admin, al lado de sus colores propios:

- columna nueva `ajustesDePantalla Json?` en `administradores`,
- migración `20260923020000_ajustes_de_pantalla_por_persona`,
- `GET/PATCH /admin/perfil/ajustes`, sin `@Roles` y solo sobre sí mismo —igual que
  `perfil/tema`—, porque pedir permiso de ESCRIBIR para agrandar la letra dejaría sin poder
  hacerlo justo a quien solo consulta,
- `backend/src/admin/ajustes-de-pantalla.ts` con 10 pruebas: una escala fuera del recorrido o
  escrita a mano cae al 100 %, y un campo roto no arrastra a los demás.

**Detalle que importa:** `GET` devuelve **nulo** si esa cuenta nunca guardó nada. No es lo
mismo que el 100 %: con nulo, el panel **sube** lo que haya en ese navegador en vez de
bajárselo, así que nadie pierde el ajuste que ya tenía puesto.

### B3 · Nada se llama «ficha»: se llama **lead**

Palabras del cliente, primero el 23 de septiembre por la madrugada --*«que no llame nada
ficha, que él defina si lo deja como cupo o lead, pero que no use ficha porque no es
ficha»*-- y después, ya decidido: **«se debe cambiar todo lo que diga ficha a cupo o lead,
aunque realmente sería lead; que lead, porque es un lenguaje que usaría un CRM»**.

Así que la palabra es **lead**, y no es cosmética: es el vocabulario del producto.

**Lo que ya está hecho:**

- En las pantallas de personas no queda ninguna: todo dice *lead* (se hizo el 22 de
  septiembre).
- Las que sobrevivían en las pantallas de organizaciones las cambié el 23 de septiembre:
  `app/admin/instituciones/[id]/page.tsx` y `components/admin/propuestas-pendientes.tsx`
  ya dicen **«el registro de la empresa»** en lugar de «la ficha».

**Y aquí va el matiz, que es lo único que te pido mirar:** en esas dos pantallas el sujeto
es una **empresa**, no una persona, así que *lead* habría sido falso --una empresa no es un
lead-- y puse *registro*. Si prefieres otra palabra para el caso de las organizaciones,
dila y la cambio; lo que ya no queda en ninguna parte visible es «ficha».

**Lo que queda por hacer, y es tuyo:**

- **Tu código.** `grep -rn ficha backend/src frontend/src` sigue dando resultados en
  nombres de variables, de tipos y en comentarios --por ejemplo la variable `ficha` en
  `instituciones/[id]`, o `gestionDe()` y su comentario sobre «la ficha»--. Nada de eso lo
  ve el usuario, así que no lo toqué: renombrar identificadores en tu rama es pisarte el
  trabajo. Pero conviene hacerlo de una pasada cuando te cuadre.
- **Los correos y los formatos.** Si alguna plantilla de correo o algún encabezado de
  reporte dice «ficha», eso sí lo ve gente de fuera. No lo revisé: dime si quieres que lo
  barra.

---

### B4 · La redistribución del menú, y qué pasó con lo que desapareció

El menú se reorganizó **por áreas de trabajo**, no por tipo de pantalla, y los tableros se
agruparon. Quedó así (`frontend/src/components/admin/navegacion.ts`):

| Módulo | Entradas |
|---|---|
| **Tableros** | Tráfico Formulario · Control de inscritos · Control de Reservas · Seguimiento Académico |
| **Oferta formativa** | Acciones de formación · Calendario |
| **Inscripciones** | Gestión de leads · Reservas · Mesa de entrada · Comité Marketing |
| **Académica** | Seguimiento del aula |
| **Mailing** | Campañas · Plantillas · Cuenta de correo |
| **Sistemas** | Empresas registradas · Empresas aliadas - afiliadas · Reportes SENA |
| **Formularios** | Empresas · Personas · Habeas Data |
| **Configuración** | Apariencia · Webhook de Meta · Usuarios · Mi perfil |

Tres cosas que conviene que sepas antes de que alguien pregunte:

1. **Los cuatro informes tienen ruta propia** (`/admin/informes/trafico`, `/admin/informes/proceso`,
   `/admin/informes/reservas`, `/admin/informes/asesores`). Antes eran pestañas de
   `/admin/control`, y con una sola ruta el menú subrayaba las cuatro entradas a la vez:
   *«¿se subrayan casi todas las vistas, no soy claro?»*. `/admin/control` sigue existiendo y
   redirige, así que los enlaces viejos y los favoritos no se rompen.
2. **Dos pantallas salieron del menú y siguen vivas en su dirección:**
   - «Inscritos por acción» → `/admin/inscritos`, se llega desde Gestión de leads con un botón.
   - «Propuestas por revisar» → `/admin/instituciones/pendientes` (*«propuestas por revisar se
     vuela»*). Existía sin entrada en el menú hasta hace poco; volvió a ese estado.
   - «Ocupación contra la meta» salió de Sistemas por petición suya en la tanda anterior.
3. **Comité Marketing vive en Inscripciones**, no en Tableros: es trabajo del área comercial,
   no un tablero de seguimiento. Los «Reportes SENA» sí van en Sistemas, «si o si» según él.

### B5 · Las reglas de diseño que quedaron fijadas (sirven para lo que hagas después)

El cliente insistió tanto en esto que lo dejé escrito en la memoria del proyecto. Resumido,
porque te va a ahorrar rebotes:

- **Nada de medida fija dentro de algo que escala.** El caso que lo destapó: la píldora del pie
  va en `em` —sigue al ajuste de texto y al zoom— dentro de una banda de `min-h-[40px]`, y en
  cuanto la letra subía se montaba sobre la raya. La banda ahora mide lo que mide su contenido.
- **Proporción, no anchos fijos:** una fila de tres campos en `1fr 260px 260px` deja el primero
  gigante en 1.920 px; en fracciones (2:1:1) los tres crecen juntos.
- **Los cantos, iguales entre bandas:** `Encabezado` trae su propio `mx-4`; si la pantalla añade
  `px-4`, el título queda 16 px más adentro que el bloque de abajo y lo ve al instante.
- **La burbuja del título es de las pantallas de segundo nivel** (Inscritos por acción, Asignar
  grupo por lote, Importar participantes, Informes), con su botón «Volver a…». Las pantallas a
  las que se llega por el menú —Gestión de leads, Reservas— **no** la llevan: costaría 68 px de
  tabla y el menú ya dice dónde estás. Hay variante `compacto` (54 px) para cabeceras que solo
  llevan título.
- **Un solo cuerpo de letra por pantalla:** la cabecera de todas las tablas subió de 10,5 a
  12 px (`globals.css`, `.tabla-datos thead th`) para que no desentone con los 12,5 de los
  controles y las celdas.
- **La franja de abajo de las tablas** bajó de 8 a 4 px, en el componente `Tabla`, o sea en
  todas las vistas.
- **Los `<select>` nativos se van.** El de la casa (`Desplegable`) pinta su propia lista, y
  ahora además **decide de qué lado abrirse**: mide lo que pide la lista y, si no cabe, se
  ancla al canto derecho o se abre hacia arriba. Medido: en Mesa de entrada abría hasta 1.601 px
  en una ventana de 1.600, y como el `<main>` scrollea, lo que sobresalía se recortaba.
  **Quedan 54 nativos en 24 archivos.** Los de las pantallas que él recorre ya están cambiados
  (Mesa de entrada, Comité Marketing). Los de los formularios de edición y los **públicos**
  siguen pendientes, y los públicos **no se tocan sin su visto bueno**.

### B6 · Un defecto de verdad que salió de todo esto

**La fila de módulos se montaba sobre el nombre del usuario** por debajo de ~1.100 px de ancho
(`cabecera-topbar.tsx`). La cabecera mide el hueco disponible para decidir cuánto encoger la
fila, y **la referencia con la que medía el bloque de usuario nunca se enganchó**: la cuenta
tomaba su ancho como 0 y creía que sobraban 214 px. Medido a 958: la fila pedía 795 y su caja
daba 696, así que «Configuración» se metía 75 px por debajo de «Ana Jaramillo».

Enganchada la referencia, a 958 la fila baja a 10,8 px de letra y entra justa; por debajo de
~900 entra el cajón con la hamburguesa, que es lo que ya estaba diseñado. De paso, el factor
de escala se calculaba encadenando el de la pasada anterior —un lazo con memoria que se quedaba
pegado—; ahora se deduce el ancho a escala 1 de la medida actual, así que se autocorrige con
cualquier zoom y con el ajuste de texto.

### B7 · Lo demás, en una lista (todo es interfaz)

- **Importar participantes** quedó terminado de punta a punta: plantilla de Excel con
  desplegables encadenados (AF → departamento → ciudad), hoja «Organización» con NIT y jefe
  inmediato que se aplica a toda la lista, y validación que resuelve la acción y el grupo de
  cada fila. Backend: `carga.ts`, `columnas-de-carga.ts`, `accion-de-la-fila.ts`,
  `organizacion-de-carga.ts`, `plantilla-de-carga.ts`, con 26 pruebas nuevas.
- **«Asignar grupo por lote» se rehízo en cascada**: acción → departamento → grupo → personas,
  con los cupos libres a la vista en cada opción. **El sobrecupo ya no se avisa: no se deja
  armar** —las casillas se apagan al llegar al cupo del grupo—.
- **«Inscritos por acción»** tiene ahora cinco tarjetas (Inscritos · Listos para el SENA · Sin
  grupo · Sin asesor · Datos a medias); la de «Sin grupo» es un enlace a «Asignar grupo por lote».
- **Reservas** tiene su fila de tarjetas (Reservas · Cupos apartados · En espera · Canceladas ·
  Organizaciones). «Cupos apartados» cuenta solo las **confirmadas**: los de una cancelada
  volvieron a la oferta.
- **Tráfico del formulario:** las cuatro tarjetas pasaron a la pieza simple (rótulo, cifra, pie
  corto) y el texto lo dictó él —«Aperturas / Se registraron clics en el enlace.» y «Personas /
  Se detectó interacción humana»—. El «Día a día» muestra **la fecha de cada columna y el valor
  de cada barra**, y tanto ese bloque como «Paso a paso» tienen interruptor **Barras /
  Tendencia**. El bloque de después de la preinscripción se replanteó entero: ahora es
  «Completaron sus datos» con tres tarjetas —se les pidió, ya entregaron, faltan por entregar—.
- **Textos que se eliminaron por petición suya:** la descripción de Tráfico, la de Comité
  Marketing, el pie de fórmulas de «Planeación de pauta», la nota de `utm_campaign`, el rango
  de fechas del «Día a día» y el «Se cuenta a hoy…». No los borré por gusto: los pidió quitar
  uno por uno.

---

### B8 · Cómo desplegar esto

```bash
git checkout arq/crm-hardening && git pull

# 1 · Backend primero: hay migraciones y rutas nuevas
docker compose build backend
docker compose up -d backend
docker compose exec backend pnpm prisma:deploy

# 2 · Frontend
docker compose build frontend
docker compose up -d frontend
```

**Las migraciones son dos**, las dos una columna nueva y nula por omisión, así que no hay
riesgo de datos:

1. `20260921190000_tema_propio_por_persona` (de la entrega anterior, si no se corrió aún)
2. `20260923020000_ajustes_de_pantalla_por_persona` (esta)

**Y antes de que entre gente real:**

- `EDITORES_DE_MARCA` en el `.env` del backend, con los correos que pueden tocar los logos y la
  marca del gremio. **Sin esa variable, nadie puede** —ni un superadmin—, que es justo lo que
  pidió el cliente: *«que nadie pueda modificar los logos, solo con el correo de acceso de
  Josse, Diana y la Sra Catalina; ni yo puedo hacerlo»*. Los colores propios de cada persona no
  dependen de esta lista: eso lo edita cualquiera sobre su propia cuenta.
- Revisa que en producción `PANEL_POR_TUNEL` esté **apagado**.
- Los colores del sistema en producción quedaron granate de una prueba vieja; si nadie los ha
  restablecido, hay que hacerlo desde Apariencia.

**Verificación después de desplegar (cinco minutos):**

1. Abre el panel a **media pantalla** (~960 px): la fila de módulos no debe pisar el nombre del
   usuario, y por debajo de ~900 debe aparecer la hamburguesa.
2. Sube la letra al 140 % en Accesibilidad, recarga y **entra desde otro navegador**: la letra
   debe seguir grande. Después devuélvela al 100 %.
3. En Comité Marketing, mira «Cupos pend.» de un departamento con reservados: ahora **no** los
   descuenta.
4. En Mesa de entrada abre el filtro «Qué lista ve» con la ventana angosta: la lista debe
   abrirse hacia el lado que quepa, sin salirse.
5. Con una cuenta que **no** esté en `EDITORES_DE_MARCA`, entra a Apariencia: debe poder
   cambiar sus colores y **no** los logos ni la marca del gremio.

### B8 bis · Los datos de prueba, ahora sí coherentes (no toca producción)

El cliente se topó con esto y tenía razón: **Gestión de leads enseñaba 115 leads y Tráfico
del formulario decía 50 aperturas y 5 registros**. No era un fallo del panel: las siembras
crean personas directamente en el CRM --hace falta gente para probar leads, grupos y
reportes-- pero el formulario público no se abre nunca, así que `pasos_de_visita` y
`enlaces_completado` se quedaban casi vacías.

Guion nuevo, **solo para pruebas**:

```bash
export ENTORNO=prueba
pnpm db:sembrar-trafico
```

Por cada persona cuyo `origen` es de formulario --autogestión, redes, WhatsApp, correo,
evento, referido-- escribe:

- su visita completa por los diez peldaños, fechada en su propia ficha y con la procedencia
  que corresponde a su campaña de entrada (mailing → correo; pauta → Meta, la mitad con
  `fbclid`; reserva → reserva);
- nueve visitas caídas por cada una que llegó al final, parándose en peldaños distintos, que
  es lo que le da al embudo la forma que tiene en producción (12.243 aperturas contra 972
  registros);
- su enlace para completar datos, usado solo si la persona ya pasó de CONTACTADO.

Lleva la guardia `soloEnPruebas`, así que **se niega a correr si la base no lleva «prueba» en
el nombre o si `ENTORNO` no vale `prueba`**. Y es idempotente: el `visitaId` y el token se
derivan del id de la persona, y los índices únicos descartan lo repetido.

En la base local quedó así: 1.100 aperturas, 110 preinscripciones medidas, y la cadena del CRM
en 102 personas del formulario, 51 con datos completos y 51 a medias. **En producción no hay
que correr nada de esto**: allí los datos ya vienen del formulario de verdad.

---

### B9 · Lo que quedó pendiente y es tuyo decidir

1. **Los 54 `<select>` nativos** que faltan (ver B5): dime si sigo por los formularios de
   edición del panel, y si autorizas tocar los públicos.
3. **«Formularios AF»** que pidió el cliente no existe como pantalla. Hay que definir qué es
   antes de construir algo.
4. **Nueve líneas por peldaño en «Paso a paso»**: el cliente quiere ver la tendencia de cada
   paso a lo largo de los días. Hoy el servidor manda cuatro series por día
   (`embudo.service.ts`, `porDia`), no las nueve. Es una consulta más, no un rediseño.
5. **`useDatosVivos(cargar, { activo: false })`** se salta la primera carga, así que en la ficha
   de un lead nunca aparece «De dónde salen estos datos». Es de tu código y es de una línea,
   pero prefiero que lo mires tú.

---

## Parte 0 · Desplegar la entrega del 12 de septiembre de 2026

**Es la más fácil de todas: solo frontend.**

### 1 · No hay migraciones y no hay que tocar el backend

Son 38 ficheros y **todos están bajo `frontend/src`**. Comprobado con
`git diff --name-only 7b80c82..HEAD`: no aparece `schema.prisma`, ni
`backend/prisma/migrations/`, ni un solo fichero de `backend/`. Por tanto:

- **no** se corre `prisma migrate deploy`,
- **no** hace falta reconstruir el backend,
- y el orden no importa: este frontend contra el backend que ya está corriendo
  funciona igual. Es justo lo contrario de la entrega del 4 de septiembre, que sí
  exigía backend primero.

```bash
git checkout arq/crm-hardening && git pull
docker compose build backend frontend
docker compose up -d backend frontend

# Y esto, que es lo que arregla el logo de ADECOPRIA:
docker compose exec backend pnpm db:sembrar-logos
```

> **Corrección:** esta parte decía «solo frontend» y ya no es exacta. Sigue sin
> haber migraciones ni cambios de API —el orden de despliegue da igual—, pero la
> siembra de logos vive en `backend/`, así que el backend hay que reconstruirlo
> para poder correrla.

**Sin ese `db:sembrar-logos` el logo de ADECOPRIA se queda con la letra oscura
sobre la cabecera verde, donde no se lee.** Los logos viven en la base de cada
entorno y el de pruebas nunca tuvo las dos variantes; ahora los archivos están en
el repo y ese comando los deja puestos. Es idempotente y retira la fila vieja
marcada `AMBOS`, que si se queda hace que salgan dos logos, uno ilegible.

### 2 · Lo que va a notar el equipo el primer día

| Qué cambió | Dónde se ve |
|---|---|
| La cabecera bajó de 127 px a 88 | En todas: la tabla gana 38 px de alto |
| El lema «Relaciones que generan resultados» **ya no sale en el panel** | Cabecera. Sigue en el acceso y en el pie público |
| Catálogo y Cronograma son **dos entradas del menú Calendario**, cada una con su URL | Antes eran pestañas dentro de una pantalla |
| Seguimiento y Tablero académico, igual, en el menú Académica | El tablero volvió a ser una pantalla |
| Los botones de exportar a PDF son **rojos y sin icono** | Resumen, Calendario, Cronograma, fichas, respuestas |
| «Todavía no se le ha preguntado» ahora dice **«Sin registro de caracterización»** | Ficha de un lead. Dice lo que el sistema sabe, no lo que supone |
| El panel ya no desplaza el documento | Antes, en ventanas bajas, la cabecera se iba de la pantalla y no volvía |

### 3 · Dos rutas nuevas, y una que dejó de redirigir

- `/admin/acciones/cronograma` — nueva.
- `/admin/participantes/academico/tablero` — **llevaba un año redirigiendo** a su
  padre y ahora pinta el tablero. Quien tenga ese enlace guardado va a ver lo que
  esperaba cuando lo guardó.

No hay rutas eliminadas, así que ningún enlace antiguo se rompe.

### 4 · Antes de cargar personas de verdad

`PANEL_POR_TUNEL=si` sigue activo en `frontend/.env.local` (ese fichero está
fuera de git, es local de cada máquina). Con eso el panel queda **abierto a
cualquiera que tenga el enlace**, y la cookie de sesión viaja sin `Secure`. Es
cómodo para revisar por túnel y es inaceptable con datos de personas dentro:
hay que quitarlo antes de la primera carga real.

### 5 · Lo que está pendiente de DECISIÓN, no de trabajo

Tres cosas que Mauricio pidió y que no se hicieron porque tocan cifras que se
reportan al SENA o porque el arreglo obvio empeora otra cosa:

- **«Cupos con dueño»** sigue llamándose así en el Resumen. El cambio de rótulo
  es trivial; lo que hay que confirmar es que nadie dependa del nombre.
- **El avance grande va sobre la META** (14,6 %) y él lo quiere **sobre el TOPE**
  (11,2 %). Son dos denominadores distintos, no un redondeo: hay que decidir cuál
  es el número oficial antes de tocarlo.
- **Las tarjetas de cifra en un renglón** (rótulo izquierda, cifra derecha).
  Medido: 14 de las 16 llevan un pie, así que se ganan ~7 px por tarjeta y no la
  mitad; y subir el ancho mínimo para que quepan las dos cosas **parte la fila de
  cinco del cronograma en un portátil de 1280**, con lo que el bloque queda más
  alto. Hace falta decidir qué pasa con el pie.

### 6 · Un fallo de contraste real, y su arreglo toca backend y datos

Medido con canvas sobre el color compuesto, en las 30 pantallas y en los dos
temas: **el texto secundario de 12 px da 4,39:1 sobre las bandas tintadas** y el
mínimo es 4,5. Sale en once pantallas (Apariencia, Control, Cuenta de correo,
Seguimiento, Habeas Data, Reportes al SENA, el tablero académico y las cabeceras
de grupo de las dos listas de acciones). **El tema oscuro está limpio: cero
fallos.**

Lo que hay que saber antes de tocarlo, porque yo me equivoqué primero:

- **No se arregla en `globals.css`.** Lo intenté y no cambió ni una décima. Ese
  token lo pisa la **paleta del gremio**, que se inyecta en el `<head>` y viene
  **guardada en la base**: en ADECOPRIA `--texto-suave` vale `#687573`.
- El valor nace en `backend/src/admin/derivar.ts`, en la receta
  `textoSuave: { l: 0.55, c: 0.015 }` — se deriva del color de marca en OKLCH, de
  ahí que sea un gris verdoso y no un gris.
- En `backend/src/admin/temas.ts` **sí** hay comprobación de contraste para ese
  token, pero solo contra `superficie` (blanco), donde pasa con 4,76:1. El par que
  falla —contra la banda tintada— **no está en la lista**, y por eso nadie lo vio.

Así que el arreglo son tres pasos, y el tercero es el que pide tu decisión:

1. bajar la `l` de la receta (backend),
2. añadir el par que falta a las comprobaciones para que no se repita (backend),
3. **re-derivar la paleta de cada gremio**, porque la actual está guardada. Eso
   recolorea el texto secundario de todos los convenios a la vez.

Lo dejé sin hacer a propósito: son 0,11 de contraste en un texto de apoyo, y el
paso 3 cambia el aspecto de dieciséis plantillas de tema. Prefiero que lo decidas
tú antes de mover la paleta de nadie.

---

## Parte 0 bis · Desplegar la entrega del 4 de septiembre de 2026 (si aún no se hizo)

**Rama `arq/crm-hardening`. Ya trae `origin/dev` fusionado** (fusión limpia, sin
conflictos) y verificado después de fusionar: `tsc` limpio en los dos lados,
1322 pruebas verdes y `next build` correcto.

### 1 · No hay migraciones

No se tocó `schema.prisma` ni se añadió nada en `backend/prisma/migrations/`.
**No hay que correr `prisma migrate deploy` para esta entrega.** Lo de la
Parte 1 de este documento sigue pendiente y es aparte.

### 2 · Hay que reconstruir el BACKEND, no solo el frontend

Es lo único que puede salir mal, y sale mal en silencio. Cambiaron
`crm.service.ts`, `tableros.service.ts`, `proyeccion.ts` y `etapas.ts`, y el
backend corre desde `dist/`. Si se despliega el frontend contra el backend
viejo:

- la columna **Grupo** de Gestión de leads sale vacía,
- los grupos desplegados en el Resumen salen en **NaN**,
- la proyección contra el cronograma no aparece.

Pasó en local exactamente así.

### 3 · El orden importa: backend primero

Frontend nuevo contra backend viejo es el fallo de arriba. Al revés no rompe
nada.

```bash
git checkout arq/crm-hardening && git pull
docker compose build backend frontend
docker compose up -d backend      # primero
docker compose up -d frontend     # después
```

### 4 · Avisar al equipo de un cambio de comportamiento

**El grupo de un participante ya no se puede cambiar una vez asignado.** Es lo
que viaja al SENA junto a la persona, y moverlo después de reportarla deja dos
verdades. Hoy **no tiene escape**: si alguien lo pone mal, solo se corrige
desde la base de datos. Si eso estorba en la operación, la salida limpia es
dejar que un líder pueda corregirlo.

---

## Parte 1 · Aplicar migraciones (4 pasos)

Están escritas, con SQL, rollback y verificación, en
[`docs/arquitectura/migraciones-propuestas/`](arquitectura/migraciones-propuestas/).

**No están en `backend/prisma/migrations/` a propósito**: ahí el arranque del contenedor las
ejecutaría solas. Se mueven a mano, una a una.

### El procedimiento, igual para todas

```
1. Mover el .sql a backend/prisma/migrations/<nombre>/migration.sql
2. Aplicar el cambio de schema.prisma EN LA MISMA ENTREGA
   (si no, el siguiente `migrate dev` ve drift y genera la migración que las tira)
3. Correr la VERIFICACIÓN PREVIA que trae el fichero. Si no da lo que dice, no desplegar.
4. Desplegar.
5. Correr la VERIFICACIÓN POSTERIOR. Si no cuadra, revertir con el rollback del fichero.
```

> ⚠️ **Antes de nada, renumerar.** Las mías empiezan en `20260831090000` y tú ya metiste
> `20260831230000_lead_con_su_accion` y `20260901180000_lead_con_su_ubicacion`. Prisma aplica
> por orden alfabético: hay que ponerles fecha posterior a la tuya más reciente.

### 1.1 · La que más rinde, y ya puedes

**`09-…_lead_por_participante_deja_de_ser_unico.sql`**

Quita el `participanteId String? @unique` de `LeadEntrante` (`schema.prisma:820`).

**Por qué importa, y por qué ahora es más urgente que antes:** tu `llave-del-lead.ts` mete el
código del curso en la llave **a propósito**, para que la misma persona pida AF1 y después AF2.
Esas dos filas cruzan **FIRME** contra la misma ficha, y **la segunda viola el único** → P2002 →
**500 crudo**, porque no hay `ExceptionFilter`.

Y se autooculta: el reintento entra por la guarda de idempotencia y contesta **200 con
`repetido: true`**. El emisor cree que quedó bien. El lead queda PENDIENTE para siempre.

**Su único requisito de código —el ramificado por `firme`— lo pusiste tú ayer.** Ya está.

> Las 1047 pruebas no pueden ver esto: `solo-lo-firme-ata.spec.ts:31-37` falsea
> `leadEntrante.update` con un `push` a un array, y ahí no hay índice único. No es un fallo del
> spec: es que este tipo de bug necesita base real.

### 1.2 · La bitácora (dos ficheros, en este orden)

**`01-…_bitacora_de_cambios.sql`** → la tabla y las funciones. Segura.
**`02-…_bitacora_colgar_en_las_tablas.sql`** → los 43 triggers.

De estas dependen **cuatro problemas graves**. Sin ellas, escribir por SQL directo no deja
rastro y la bitácora se puede vaciar.

> ⚠️ **La 02 necesita ventana tranquila.** Toma `ACCESS EXCLUSIVE` sobre las 43 tablas y
> **los acumula hasta el `COMMIT`** — no es "un instante", como decía mi documento anterior;
> me corrijo. Con una transacción larga abierta, espera; y **si alguien la mata a medias**,
> Prisma deja la fila sin `finished_at`, el siguiente arranque da **P3009** y con `set -e` eso
> sí es ciclo de reinicios. Corre antes la verificación previa que trae el fichero.

**Y una decisión que es tuya**, no mía: a partir de la 02 la bitácora es **`fail-closed`** —un
fallo al apuntar tumba la escritura del usuario—. Eso es **lo contrario** de lo que hay hoy:
`AuditoriaService.registrar()` es `fail-open` a propósito y su comentario explica por qué.
Si prefieres mantener `fail-open`, dilo y ajusto el trigger.

### 1.3 · Las nueve restantes

Cupos, papelera, hold con TTL. Cada una con su ficha. **Ninguna corre riesgo de tumbar el
arranque salvo la 11**, que va marcada y detrás de un paso manual — y que, si prefieres, **se
puede no poner**: lo que resuelve ya lo cierra la 08.

---

## Parte 2 · Tres preguntas que solo tú puedes contestar

### 2.1 · 🔴 ¿Dónde se pone `sepProyectoId`?

**El cargue al SEP no se puede generar. Ninguno.**

`sep.service.ts:368` aborta si `convenio.sepProyectoId` es `null` — *"Póngalo en Formación antes
de exportar"*. **Ese campo no se puede escribir en ningún sitio**: no hay pantalla, ni ruta, ni
seed que lo ponga.

Es el entregable contractual con el SENA. Si esto lleva así desde el principio, alguien lo está
haciendo por fuera; si no, es que nunca se ha entregado.

**Es la pregunta que más rinde de todo el documento.**

### 2.2 · ¿Qué valores admite la columna `ESTADO` del cargue?

Hoy `formato-cargue-sep.ts:171` escribe `'ACTIVO'` **a fuego**, y `sep.service.ts:188` filtra
por `ETAPAS_DEL_REPORTE`, que no incluye las cuatro salidas del aula.

Resultado: **cuando alguien se retira, su fila desaparece del siguiente cargue**. Al SENA le
consta que estaba activo y después se evapora. Desde fuera es indistinguible de un error nuestro.

**La columna `ESTADO` ya existe en el formato.** Si el SENA admite un `RETIRADO` o equivalente,
avisar del retiro **no exige tocar ni un título ni una prueba**.

### 2.3 · Cuatro más del SENA, del mismo bloque

- ¿Existe ya un formato oficial para reportar retiros? Si sí, mi borrador se tira y se copian
  sus columnas.
- ¿El motivo va como texto libre o como causal de lista cerrada?
- ¿Exigen **horas efectivamente cursadas**? Si sí, **no es trabajo de formato: es un módulo de
  asistencia que no existe**.
- ¿Piden soporte firmado? La ficha no admite adjuntos de ningún tipo.

---

## Parte 3 · Cosas de tu código, cortas

Ninguna es grave. Las hago yo si prefieres, pero son tuyas y las conoces mejor.

| Qué | Dónde | Por qué |
|---|---|---|
| El `estado` del filtro llega al `where` sin validar, con `as never` | `mesa-de-entrada.controller.ts:50` | El resto del panel usa `@IsEnum` |
| El texto crudo de la excepción sale al cliente | `lote.service.ts:158` | Con la base caída, el mensaje de Prisma incluye el host |
| La conversión no es atómica: tres transacciones | `conversion.service.ts:232` | Si corta en medio, queda ficha creada y lead `PENDIENTE` |
| El lote no crea `CargaDeParticipantes` ni pone `cargaId` | `lote.service.ts:117` | El cargue de participantes sí lo hace, para saber qué pasó si se cae a la mitad |
| La mesa pagina en el servidor y no en la pantalla | `frontend/.../mesa/page.tsx:235` | Con más de 50 leads, los demás son inalcanzables |
| La mesa enseña el filtro `DESCARTADO` y nadie escribe ese estado | enum vs `backend/src` | Un contador que siempre dice 0 enseña a desconfiar de la pantalla |
| Al asesor se le dice "confirme antes de unirlos" y no se le da con qué | `leads.service.ts` + mesa | El motivo no nombra a la otra persona, y no hay ruta que ate el lead tras confirmar |

---

## Lo que ya está hecho, para que no lo busques

Cuatro commits en la rama, cada uno con su prueba y **comprobado que falla sin el arreglo**:

| Commit | Qué |
|---|---|
| `e90a185` | `PATCH /admin/leads/:id` normaliza el documento. Era la octava puerta y la única que no lo hacía — el mismo agujero que cerraste en preinscripción |
| `bb3cba7` | La coincidencia floja ya no escribe en la ficha ajena. Tu `if (firme)` cubría el `update`; las tres escrituras siguientes corrían igual |
| `9229f98` | La mesa dice `CC` y no `1` |
| `a9bc9fd` | Crear una ficha emite `PARTICIPANTE_CREADO`. Estaba en el catálogo y no lo emitía nadie, por ninguna de las cuatro puertas |

**Y retiro una pega que puse yo:** dije que la mesa devolvía la cédula en claro y había que
taparla. Me equivoqué. `taparDocumento` se escribió **para los logs** —lo dice su propio
comentario— y el listado de participantes devuelve la cédula entera igual. Además la mesa
**busca por documento**: taparlo dejaría al asesor sin comprobar lo que acaba de buscar.

---

## Y una cosa que no es una tarea

Tres de los cuatro arreglos de arriba son cosas que **tú ya habías arreglado en otro sitio** y
que se colaron otra vez por una puerta nueva. No es descuido: es que el sistema tiene ocho
puertas que escriben un documento y ninguna barrera que las obligue a todas.

Por eso la Fase 2 propone la capa 3 —un `CHECK` en la base— y no solo la llamada correcta en
cada servicio. **Es la diferencia entre una convención y una garantía.** Está en
[`borradores/llave-de-identidad-y-lms.md`](arquitectura/borradores/llave-de-identidad-y-lms.md),
con el aviso de que hay que limpiar los datos antes.
