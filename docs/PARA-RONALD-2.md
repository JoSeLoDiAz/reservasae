Hola, Ronald:

Gracias por el detalle, y sobre todo por las seis respuestas: cuatro de ellas nos cambian cosas del lado nuestro y van contestadas abajo.

Empiezo por lo del domingo, porque es lo que más te afecta.

---

## 1 · El corte del 5 de octubre: qué pasó, con horas

Lo reconstruí del registro del sistema. Van en UTC, que es como quedan guardadas; réstales cinco para hora de Colombia.

| | |
|---|---|
| 19:05:27 | nuestra pila levanta su conector de Cloudflare, todo normal |
| **19:08:37** | **`systemd: Stopping docker.service`** — se apaga el demonio de Docker de la máquina |
| 19:09:35 | Bogotá deja de ver al CRM y arranca su cuenta atrás |
| 19:10:56 | Bogotá toma el relevo: la base pasa a ser principal allí y el sitio vuelve |
| 20:40 | la instancia sigue sin Docker: «Cannot connect to the Docker daemon» |
| **20:48:56** | vuelve el demonio de Docker — **100 minutos caído** |
| 20:50:22 | nuestra sede de la nube se rinde sola y vuelve a ser réplica |

Tres cosas que conviene que queden claras, y ninguna es un reproche:

- **No fue el CRM quien tumbó a Moodle.** El apagado fue del demonio de Docker de la máquina, no de contenedores sueltos: todos los contenedores registraron `daemonShuttingDown=true` y `hasBeenManuallyStopped=false`, o sea que cayeron *con* el demonio. Se llevó por delante nuestros cuatro contenedores, nuestro conector **y los dos PHP de los campus**. La máquina no se reinició: lleva tres días de `uptime`.
- **Fueron 100 minutos, no 3.** Lo digo porque tu correo habla de 3:46 a 3:49 p. m. y eso es solo el final: el demonio ya estaba caído a las 20:40 UTC y volvió a las 20:48:56.
- **Lo que viste —«solo está corriendo la base»— era exacto**, y es consecuencia de lo anterior. Nuestro sistema vive en tres sedes replicadas; cuando la de la instancia dejó de responder, otra tomó el relevo automáticamente y esta se degradó a réplica, que es lo que te encontraste. Hoy el mando volvió a la instancia y la pila está completa otra vez.

### Lo que te pido, y es lo único que de verdad hace falta

**Una ventana de mantenimiento acordada.** Un apagado del demonio de Docker en una máquina compartida tumba los tres proyectos a la vez y, en nuestro caso, dispara un relevo automático entre sedes. Con un aviso previo nosotros desarmamos ese automatismo durante la ventana y no pasa nada. Nos sirve cualquier canal: un mensaje media hora antes basta.

Y lo mismo al revés: cuando vayamos a desplegar algo que pueda afectar a la máquina, te avisamos.

## 2 · El acceso de `sepadmin`, que tienes razón en señalar

Es cierto y no lo discuto: `sepadmin` pertenece al grupo `docker`, ese grupo equivale en la práctica a administrador de la máquina, y por tanto **la capacidad de tocar vuestros contenedores y vuestra base existe**. También es cierto al revés, y por eso creo que lo que toca es un acuerdo entre los dos y no una discusión sobre permisos.

**El compromiso, desde ya y por escrito: no accedemos a los contenedores, los ficheros ni la base de datos de Moodle.** Si alguna vez necesitamos algo de ahí, te lo pedimos.

Reducir el privilegio de verdad es otra conversación, y es de José. Para que la tengáis con los números delante, lo que miré:

| | |
|---|---|
| usuario aparte por proyecto | **no cierra nada**: ya lo tenemos y sigue en el grupo `docker` |
| contexto de Docker por proyecto | cosmético si detrás hay un demonio con privilegios |
| **Docker rootless** | **la única que cierra la puerta.** Nuestros puertos publicados son el 4600 y el 5433, los dos por encima de 1024, así que no hay impedimento. El coste es mover el volumen de la base fuera de `/var/lib/docker` |
| `sudo` con lista blanca | se escapa con facilidad |

No lo prometo para una fecha: es trabajo de infraestructura sobre una máquina con producción de un tercero, y lleva una mudanza de base dentro.

## 3 · Cuál es la sede principal, que es lo que preguntas

**Hoy la principal es esta instancia**, y ya está atendiendo: la pila completa, el CRM en **0.23.0-JD**.

Te explico la arquitectura, porque viste los temporizadores y la pregunta tiene más fondo del que parece. El CRM vive en **tres máquinas**: ésta, una en Bogotá y otra en El Socorro. Solo una escribe; las otras dos llevan una copia de su base al instante. Si la que atiende deja de responder cinco minutos y una tercera lo confirma, **otra toma el relevo sola** y el dominio sigue funcionando. Eso es lo que pasó el domingo cuando se apagó Docker, y por eso encontraste aquí solo la base: el relevo había actuado.

Lo que esto significa para ti, y conviene decirlo claro: **el CRM puede dejar de atender desde esta máquina sin que nadie lo decida**, y volver igual. No se lleva nada por delante —Moodle ni se entera— pero si algún día ves aquí solo el contenedor de la base, no es que esté roto: es que está de respaldo.

El orden de preferencia es esta instancia primero, Bogotá después, El Socorro al final.

### El consumo, medido ahora con carga real

| Contenedor | RAM | CPU |
|---|---|---|
| backend | 676 MB | 3,2 % |
| base de datos | 158 MB | 0,2 % |
| frontend | 86 MB | 0,0 % |
| conector del túnel | 26 MB | 0,3 % |
| nginx | 15 MB | 0,0 % |
| **total** | **≈ 960 MB** | **< 4 %** |

Te las doy otra vez porque las primeras eran de un momento de reposo y no servían. El volumen de nuestra base ocupa 278 MB. La reserva que pedimos (4 vCPU y 8 GB) sigue siendo holgada a propósito.

> **Y una oferta: la máquina tiene unos 26 GB recuperables** entre imágenes de Docker huérfanas (15,8 GB) y caché de construcción (10,2 GB). **La mayor parte es nuestra**, de los despliegues de hoy. Si te parece, lo limpiamos con `docker image prune` y `docker builder prune` en una ventana acordada — no toca ningún contenedor en marcha, pero no voy a ejecutarlo en una máquina compartida sin decírtelo.

## 4 · Lo que cambia por tus respuestas

**Que no haya beneficiarios en el campus nos simplifica mucho**: no hay nadie que enlazar, así que todas las cuentas las creamos nosotros y el «Número de ID» nace bien desde el principio.

**Desactivar el mensaje de bienvenida de la matriculación: de acuerdo**, y gracias por dejarlo hecho. Las credenciales las mandamos nosotros.

**Lo de la IP del token lo entendimos y lo vamos a hacer como dices**: llamada interna a `http://172.18.0.1` con la cabecera `Host: campusadecopria.com`. Lo comprobaremos juntos cuando llegue el momento. Un aviso técnico nuestro, por si os ahorra un rato: en Node, el `fetch` nativo **descarta la cabecera `Host` en silencio**, así que esa llamada hay que hacerla con el cliente HTTP de bajo nivel. Ya lo tenemos previsto.

**Los cuatro campos obligatorios del perfil no los teníamos en cuenta, y es un fallo nuestro.** Nuestro correo no los mencionaba. Gracias por el aviso, porque efectivamente habría dejado usuarios atascados.

Aquí es donde más te necesito, y te explico por qué:

- **`tipodoc`.** Nos diste las cinco etiquetas, gracias. Nuestro catálogo —el del SEP, que es el que usamos para reportar— tiene **once** tipos de persona, y cinco casan con los tuyos. Los seis que se quedan sin sitio son Permiso Especial de Permanencia, «Otro», Documento Nacional de Identidad, Cédula de Identidad, Documento Personal de Identificación y Número de Seguridad Social.

  **En la práctica hoy esto casi no muerde**, y lo medí: de las 572 personas que tenemos, 541 llevan cédula de ciudadanía, 4 cédula de extranjería, 2 PPT y **solo una** lleva un tipo sin destino («Otro»). Así que no hace falta que añadáis nada por nuestra cuenta; dinos solo qué prefieres que hagamos con los casos sueltos: dejarlos fuera del campus, o tratarlos aparte.
- **`departamento`.** Medimos las 33 cadenas nuestras contra el formato que muestran tus dos ejemplos y **no coincide ninguna letra por letra**: las nuestras van en mayúscula sostenida y sin algunos signos. Vamos a escribir una tabla de traducción, y para eso necesito **las 33 cadenas exactas tal como están en Moodle**.
- **`municipio`.** De este no tenemos ningún valor. ¿Cuántos tiene el menú, depende en cascada del departamento, y nos pasas las cadenas? Nuestro catálogo tiene 1.123 municipios, pero para la gente que hoy iría al campus solo hacen falta **42**, así que si os sirve os mandamos esa lista corta y nos devolvéis cómo se escribe cada uno allí.

Hay un caso que va a chocar y conviene saberlo de antemano: en nuestro catálogo el municipio `11001` se llama **BOGOTÁ** y el departamento `11` se llama **BOGOTÁ D.C**. Son **38 personas**.

**Lo del correo repetido sí nos muerde, y más de lo que crees.** Lo medí hoy contra nuestros datos: hay **tres correos repetidos, 43 personas afectadas**, y uno de esos tres grupos se lleva **39 personas con 39 apellidos distintos**. O sea que no es una familia, como suponías: es una institución que inscribió a su planta entera con el correo de contacto del colegio. Con `allowaccountssameemail = 0`, de ese grupo Moodle aceptaría **una y rechazaría 38**.

Hay dos salidas y la elección es más tuya que nuestra, porque la primera depende de una política vuestra:

1. que subáis `allowaccountssameemail` a 1 **solo para estos cursos**, o
2. que lo resolvamos nosotros pidiéndole a la institución un correo por persona antes de crear nada.

Dinos cuál preferís. Mientras tanto no creamos un solo usuario de ese grupo.

**Y las contraseñas:** confirmado, generamos cumpliendo vuestra política (8 caracteres con mayúscula, minúscula, número y símbolo). Era otra cosa que no teníamos prevista.

## 5 · Los grupos que pediste

Son 16: ocho de AF1 y ocho de AF2, con 207 personas dentro. «Cobertura» son los departamentos que atiende cada grupo —los dos cursos son virtuales, de 40 horas—.

| Acción | Grupo | Cobertura | Inicio | Fin | Tope | Personas |
|---|---|---|---|---|---|---|
| AF1 | 1 | Bogotá D.C | 13-10-2026 | 05-11-2026 | 65 | 16 |
| AF1 | 2 | Antioquia | 13-10-2026 | 05-11-2026 | 65 | **65** |
| AF1 | 3 | Antioquia | 13-10-2026 | 05-11-2026 | 65 | 22 |
| AF1 | 4 | Huila + Magdalena | 13-10-2026 | 05-11-2026 | 65 | 14 |
| AF1 | 5 | Cauca + Santander | 19-10-2026 | 11-11-2026 | 65 | 4 |
| AF1 | 6 | Córdoba | 19-10-2026 | 11-11-2026 | 65 | 3 |
| AF1 | 7 | Risaralda | 19-10-2026 | 11-11-2026 | 65 | 4 |
| AF1 | 8 | Valle del Cauca | 19-10-2026 | 11-11-2026 | 65 | 7 |
| AF2 | 1 | Bogotá D.C | 26-10-2026 | 19-11-2026 | 65 | 6 |
| AF2 | 2 | Antioquia + Magdalena | 26-10-2026 | 19-11-2026 | 65 | 34 |
| AF2 | 3 | Antioquia | 26-10-2026 | 19-11-2026 | 65 | 9 |
| AF2 | 4 | Antioquia | 26-10-2026 | 19-11-2026 | 65 | 0 |
| AF2 | 5 | Cauca + Santander | 03-11-2026 | 26-11-2026 | 65 | 8 |
| AF2 | 6 | Córdoba + Huila | 03-11-2026 | 26-11-2026 | 65 | 3 |
| AF2 | 7 | Risaralda | 03-11-2026 | 26-11-2026 | 65 | 6 |
| AF2 | 8 | Valle del Cauca | 03-11-2026 | 26-11-2026 | 65 | 6 |

Dos celdas que conviene no leer por encima: **AF1 grupo 2 está lleno** (65 de 65) y **AF2 grupo 4 está en cero**, así que nacería vacío.

El Número de ID del grupo puede ser el número a secas, o `ADECOPRIA-AF1-G2` si lo prefieres legible fuera de su curso — nos da igual, lo que no podemos es deducirlo.

**Y una advertencia sobre la fecha**: el **13 de octubre**, dentro de una semana, arrancan los cuatro primeros grupos de AF1. Son **116 personas** que ese día pasan a «en formación» en nuestro sistema. Si para entonces no hay matrícula automática ni avance que leer, lo veremos todo en cero; no es un problema, pero conviene que los dos sepamos que esa es la fecha real.

## 6 · La ruta de aprendizaje y la certificación

Esta es la parte más importante de tu correo y te agradezco el detalle, porque cambia nuestro plan.

**Aceptamos tu propuesta: que el plugin de la ruta exponga una función de solo lectura, y que esa sea la fuente.** Tienes razón en el fondo: si el avance lo calcula la ruta y nosotros lo recalculamos con las funciones estándar, acabamos con dos cifras distintas sobre la misma persona, y la que vea el beneficiario no será la que vea su asesor. Preferimos una sola verdad, aunque dependamos de vuestra función.

Con dos precisiones:

- **El detalle, además del porcentaje.** Nuestro modelo guarda una fila por persona y actividad; el porcentaje lo calculamos nosotros a partir de eso. Si solo recibimos un número, no tenemos dónde guardarlo ni cómo explicar de dónde sale.
- **El estado lo recibimos encantados, pero como dato, no como decisión.** El paso a «certificado» en nuestro sistema tiene su propia compuerta comprobada en el servidor, y es lo que acaba viajando al reporte del SENA. Nos viene muy bien recibir vuestro estado para **cruzarlo** y detectar cuándo discrepamos —eso es justo lo que queremos ver—, pero la decisión la seguimos tomando aquí.

El contrato mínimo que necesitamos, por persona y curso:

| Campo | Para qué |
|---|---|
| `documento` (texto, con su tipo) | la llave. Como texto, para no perder ceros a la izquierda |
| `cursoNumeroId` (p. ej. `ADECOPRIA-AF1`) | sin esto no sabemos de qué curso es el avance |
| `ultimoAcceso` (fecha-hora, puede ir vacío) | es lo que nos dice quién no ha entrado |
| `unidades[]` → `clave`, `aprobada` (sí/no), `aprobadaEn` | el detalle. `clave` que case por título, no por posición |
| `obligatoria` por unidad (sí/no) | es el **denominador**, y hoy decide si el mínimo son 4 o 5 actividades |

Nos vienen bien, pero no son imprescindibles: intentos usados, nota y el porcentaje de avance.

### Sobre la regla de certificación, te debo una corrección

Preguntas si vale el 80 % que mencionamos o la nota ponderada de vuestro esquema, y la respuesta honesta es que **el 80 % es una regla interna nuestra y no tenemos documentada la del SENA para esta convocatoria**. Lo dimos por el requisito oficial y no debimos.

Y tienes toda la razón en que son reglas distintas: la nuestra es un **conteo de actividades aprobadas**; la vuestra es una **nota ponderada por unidades**. No es el mismo cálculo con otro número, así que no van a dar el mismo resultado por casualidad.

Lo estamos consultando con la interventoría. Lo que les preguntamos, por si queréis añadir algo:

1. Para certificar, ¿qué exige: un porcentaje de actividades aprobadas, una nota final mínima, un porcentaje de asistencia, o varias a la vez?
2. Si es nota, ¿cuál es el mínimo y en qué escala, de 1 a 5 o de 0 a 100?
3. Si es porcentaje de actividades, ¿cuentan todas o solo las evaluaciones? ¿El producto de cada unidad cuenta?
4. **Una persona que agota los tres intentos sin aprobar pero termina todo lo demás, ¿se certifica?** Esta es la que más nos aprieta: hoy nuestro sistema la bloquea sin salida.
5. ¿Exige registro de asistencia u horas efectivamente cursadas?
6. En el cargue de cierre, ¿se reporta solo un sí/no, o además las horas y el porcentaje?
7. ¿Existe un documento de la convocatoria donde esté escrito, y nos lo pueden enviar?

**Mientras no tengamos esa respuesta no fijamos el umbral**, y te sugiero que vosotros tampoco configuréis la finalización por nota aprobatoria: si luego la regla es otra, habría que rehacerlo. De acuerdo contigo en que, cuando toque, se active **solo en las cinco formativas** y no en las pruebas inicial y final.

Y nos vendría muy bien **copia del Anexo 12**, si lo podéis compartir.

> Un detalle que nos afecta y conviene mirar juntos: medimos «atrasado» contra el calendario del grupo, y vuestra ruta lo mide contra 8 días hábiles por unidad. Son dos relojes distintos sobre la misma persona. Si tu función nos devuelve la unidad actual y su fecha, nos adaptamos al vuestro.

## 7 · Reducimos lo que te pedimos

Con la función de la ruta como fuente, dos de las doce funciones sobran, porque medirían un avance que no es el que ve el beneficiario:

- fuera **`core_completion_get_course_completion_status`**, y con ella la capacidad `report/completion:view`;
- **`gradereport_user_get_grade_items`** solo si al final la regla es por nota; si no, fuera también, junto con `gradereport/user:view` y `moodle/grade:viewall`.

El resto de la lista se queda como estaba.

## 8 · Y una corrección a nuestro correo anterior

Lo escribimos en presente y da a entender que la integración ya existe. **No existe todavía**: está diseñada y sin escribir, y el token es justo lo que nos deja empezar a construirla contra un curso de prueba. Donde decíamos «la matrícula deja de hacerse a mano», léase «dejará».

Relacionado: en aquel correo decíamos que íbamos a comprobar la preferencia de cambio de contraseña después de crear el usuario. Revisando la lista, **ninguna de las funciones que pedimos devuelve preferencias**. ¿Hay alguna que sí, a la que podamos acceder con este rol? Si no la hay, cambiamos la salvaguarda por otra y corregimos la frase.

---

## Los siguientes pasos

Tus cuatro me parecen bien y los sigo tal cual. Solo los completo con lo que falta de nuestro lado:

1. **Te confirmo tus puntos 1 y 2**, que es lo que pedías para arrancar: la sede principal es ésta (§3), el corte del domingo está explicado con horas (§1), y lo de `sepadmin` queda reconocido con el compromiso por escrito (§2). De la regla de certificación te debo la respuesta hasta que conteste la interventoría (§6).
2. **Creas el curso «CRM Prueba», el rol y el token** como propones. Dos ajustes a la lista de funciones, en el §7, que la reducen.
3. **El token**: de acuerdo en que no vaya por correo. Dinos por dónde prefieres —una llamada, o un gestor de secretos si tenéis uno— y nos adaptamos. Nosotros lo guardaremos como variable de entorno del contenedor, no en el código ni en el repositorio.
4. **Las pruebas con dos o tres usuarios inventados**, en ese curso de prueba y no en AF1 ni AF2. Ahí es donde comprobaremos juntos lo de la IP interna.
5. Y en paralelo, lo que necesito de ti para poder escribir el adaptador: **las cadenas exactas de `departamento` y `municipio`** —dices que enviabas la lista completa de departamentos y no me ha llegado, así que puede que se te quedara en el tintero—, **qué prefieres para el correo repetido**, y si quieres que limpiemos los 26 GB de disco.

Un dato para dimensionar: hoy son **324 personas** las que entrarían al campus —las inscritas en AF1 y AF2—, repartidas en los 16 grupos de la tabla.

Quedo atento, y gracias otra vez por el nivel de detalle: el punto de la ruta de aprendizaje nos ahorró construir algo que habría dado cifras distintas a las vuestras, y lo de los cuatro campos obligatorios nos habría dejado usuarios atascados.

**José Díaz** — Líder de desarrollo Convoca CRM, Grupo AE
