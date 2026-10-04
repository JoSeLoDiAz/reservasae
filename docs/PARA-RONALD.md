Hola, Ronald:

Te escribo de nuevo porque el panorama cambió: **el CRM ya está instalado en la instancia** y eso me permite contestarte yo mismo casi todo lo que en el correo anterior te pedía confirmar. Abajo va lo que medí, lo que queda por hacer, y las tres cosas que siguen dependiendo de ti.

Antes de nada: **no toqué nada de Moodle**. Ni sus contenedores, ni su PostgreSQL 18, ni nginx, ni sus datos. Lo comprobé después de cada paso: `campusadecopria.com` y `campusgrupoadvanced.com` siguieron respondiendo todo el tiempo.

---

## A · Instalación — hecha

**Convoca CRM 0.19.0-JD**, desarrollo propio. Node.js 22 y su propio PostgreSQL **17 en contenedor**, aparte de tu PostgreSQL 18: no comparten clúster, ni usuario, ni puerto — el tuyo sigue en el 5432 y el nuestro publica en el 5433.

Todo en Docker, en el proyecto `reservasae`: backend, frontend, un nginx propio que escucha **solo en `127.0.0.1:4600`** —así que no estorba al tuyo del puerto 80— la base, y un conector de Cloudflare Tunnel. Sin Redis ni colas externas.

**El correo sale por SMTP autenticado desde nuestro propio contenedor**, hacia fuera. No hace falta instalar ni configurar nada de correo en la instancia, que era lo que te estaban pidiendo.

### Lo que consume de verdad, medido en tu máquina

| Contenedor | RAM en reposo | CPU |
|---|---|---|
| backend | 237 MB | 0,07 % |
| base de datos | 122 MB | 0,03 % |
| frontend | 63 MB | 0,01 % |
| nginx | 14 MB | 0,00 % |
| túnel | 19 MB | 0,19 % |
| **total** | **≈ 456 MB** | **< 0,3 %** |

En disco: 2,5 GB de imágenes y 112 MB el volumen de la base, de los cuales la base ocupa **41 MB**.

> Corrijo una cifra del correo anterior: te dije ~1 GB de RAM y ~830 MB de backend. Lo real en reposo son **456 MB en total**. Aquella medición debió coger un momento con Chromium abierto —el backend lo levanta solo cuando consulta el RUI del DNP, y es puntual—. La reserva que pedimos sigue siendo **4 vCPU y 8 GB**, holgada a propósito para los picos de campaña, pero el consumo normal es el de arriba.

Usuarios: 8 cuentas internas, unas 5–10 a la vez. El formulario público de preinscripción está en la misma instalación y tiene picos: el día de más tráfico fueron ~10.800 visitas, la mayoría escáneres de enlaces de correo.

### Direcciones

Se quedan en `reservasae.com`, por Cloudflare y con el tráfico entrando por un túnel **saliente**: no hay que abrir ningún puerto ni tocar DNS ni certificados.

```
adecopria.reservasae.com        →  panel de ADECOPRIA, solo sus datos
britcham-adee.reservasae.com    →  panel de BRITCHAM ADEE, solo sus datos
reservasae.com/admin            →  panel general: ve los dos convenios
```

El subdominio es lo que determina qué datos ve cada quien, así que no puede vivir bajo `campusadecopria.com`. Y hay enlaces ya repartidos apuntando ahí: anuncios, correos masivos y el enlace personal de «completa tus datos».

---

## B · Integración — y ya está probado el camino

Va en los dos sentidos:

```
CRM ──── al pasar a «Inscrito» ────►  Moodle
         crea el usuario, lo matricula en su curso, lo mete en su grupo

CRM ◄─── cada 20 minutos ──────────   Moodle
         avance, último acceso y calificaciones
```

**El camino ya responde.** Desde el contenedor del backend llamé a `webservice/rest/server.php` de `campusadecopria.com` y Moodle contestó:

```xml
<ERRORCODE>invalidtoken</ERRORCODE>
<MESSAGE>Ficha (token) no válida - ficha no encontrada</MESSAGE>
```

O sea que la conexión funciona y lo único que falta es el token. Y de paso eso contesta una de las preguntas que te hacía: **nos ves llegar desde `172.18.0.1`**, la puerta de enlace de nuestra red de Docker. Tu Moodle no tiene `reverseproxy` activado, así que lee la IP directa. Esa es la que va en la restricción de IP del token.

### Las credenciales las manda el CRM, no Moodle

Generamos la contraseña, la pasamos en la misma llamada de creación junto con la preferencia `auth_forcepasswordchange`, y le enviamos a la persona la dirección del Campus, su usuario y su clave con nuestra plantilla. Así no dependemos de tu correo.

Verifiqué en el código de **tu** instalación —Moodle 5.2.3+ (build 20260916)— que esto no necesita el permiso peligroso. En `lib/classes/user.php:1072`:

```php
return ($USER->id != $user->id && (has_capability('moodle/user:update', $systemcontext) ||
        ($user->timecreated > time() - 10 && has_capability('moodle/user:create', $systemcontext))));
```

Es decir: **con `moodle/user:create` basta, si el usuario se creó hace menos de 10 segundos**. Como la preferencia viaja en la misma llamada, entra en esa ventana, y **no necesitamos `moodle/user:update`**.

> **Y hay un detalle que conviene que sepas, porque falla en silencio**: si esa ventana se pasara —una llamada lenta, un reintento—, `useredit_update_user_preference` (`user/editlib.php:181`) **se salta la preferencia sin dar error**. El usuario quedaría creado sin forzar el cambio de clave y nadie se enteraría. Por eso lo vamos a comprobar leyendo la preferencia después de crear, y si falta, lo reportamos en nuestro panel en vez de dejarlo pasar.

> La otra vía sería usar `createpassword`, pero entonces **es Moodle quien genera y envía la clave por tu SMTP** (`user/externallib.php:276`, `setnew_password_and_mail`), que es justo lo que queremos evitar.

### Lo que leemos

Documento (como llave) y correo; qué curso es cada acción; grupos; matrículas; finalización de cada actividad con su fecha; último acceso; calificaciones; y qué actividades cuentan para la finalización del curso.

No necesitamos asistencia, ni autorizaciones, ni fechas de grupo — el cronograma lo lleva el CRM.

---

## Lo que ya comprobé yo, y no hace falta que me contestes

Leí tu base de ADECOPRIA. Esto es lo que hay hoy:

| | |
|---|---|
| Servicios web | **activados**, con REST, y **cero tokens** creados |
| Finalización de actividad | **activada** en el sitio |
| `roleid` de Estudiante | **5** |
| `allowaccountssameemail` | **0** — una cuenta por correo |
| `extendedusernamechars` | **0** — usuarios solo con caracteres básicos |
| `minpasswordlength` | **8**, con política de contraseñas activa |
| Matriculación manual | **existe y está activa** en los dos cursos |
| Cuentas de personas | **2**, que son las de administración |
| IP desde la que llegamos | **172.18.0.1** |

De ahí salen dos conclusiones que simplifican bastante:

**1 · El campus está vacío de participantes.** No hay a quién enlazar: todas las cuentas las va a crear el CRM. Eso elimina el problema de las convenciones de usuario y de los duplicados.

**2 · Los dos cursos virtuales ya están montados.** Son los `id 9` y `10`: «Gestión de la atención y neuroeducación…» (nuestra **AF1**) y «Diseño estratégico de ecosistemas educativos…» (**AF2**). Las otras cinco acciones de ADECOPRIA no tienen curso, y eso hay que decidirlo (abajo).

---

## Lo que sí necesito de ti, y son tres cosas

### 1 · El rol y el token

Un rol dedicado asignado **en Sistema** —no un usuario administrador, porque se salta todas las restricciones—. Los servicios web ya están activos, así que es crear el rol, el servicio y el token.

```
ESCRITURA   moodle/user:create · enrol/manual:enrol · moodle/course:managegroups
            moodle/role:assign + «Permitir asignaciones de rol» → SOLO Estudiante

LECTURA     webservice/rest:use · moodle/user:viewdetails · moodle/user:viewalldetails
            moodle/site:viewuseridentity · moodle/course:view
            moodle/course:viewparticipants · moodle/site:accessallgroups
            report/progress:view · report/completion:view
            gradereport/user:view · moodle/grade:viewall

NO DAR      moodle/user:update · moodle/user:delete · enrol/manual:unenrol
            moodle/user:loginas · moodle/site:config · core_role_assign/unassign
            core_group_delete_group_members / create_groups / delete_groups
```

Funciones del servicio, y ninguna más:

```
core_user_create_users · enrol_manual_enrol_users · core_group_add_group_members
core_user_get_users_by_field · core_course_get_courses_by_field · core_course_get_contents
core_enrol_get_enrolled_users · core_completion_get_activities_completion_status
core_completion_get_course_completion_status · gradereport_user_get_grade_items
core_group_get_course_groups · core_webservice_get_site_info
```

Dos avisos, porque los dos fallan en silencio:

- Sin **`moodle/user:viewalldetails`**, Moodle devuelve la respuesta **sin el «Número de ID» y sin dar error**. No reconoceríamos a nadie.
- **`moodle/course:managegroups`** hace falta hasta para *leer* grupos. Con ella dada, la única cerca contra borrarlos es la lista de funciones de arriba — por eso no lleva ninguna de `delete_groups`.

Restricción de IP del token: **`172.18.0.1`**.

> **Y una cosa que te va a saltar al armar el rol, para que no te frene:** Moodle
> te mostrará **`moodle/course:update`** como «capacidad requerida» de
> `core_course_get_contents`. Ese aviso es **informativo**: la función está
> declarada `type => read` en `lib/db/services.php:553` y en el código solo valida
> el contexto (`course/externallib.php:155`), no exige esa capacidad. **No se la
> des** — es de escritura y con ella se pueden editar los ajustes del curso. Si al
> probar algo fallara por eso, me lo dices y lo miramos, pero no debería.

### 2 · La configuración de los cursos — y esto es lo más importante del correo

**Hoy ninguna actividad exige nota aprobatoria para darse por completada.** Lo medí: de 97 actividades en los dos cursos, 56 tienen condiciones de finalización, **cero** con «calificación de aprobado», y solo 4 piden alguna nota.

En cada actividad calificable:

> Condiciones de finalización → Añadir requisitos → **«Recibir una calificación» → «Calificación de aprobado»**

Poner solo la nota mínima no basta. Si la actividad se completa al verla o al entregar, Moodle devuelve «completada» a secas y el CRM **no puede distinguir «aprobó» de «entregó»**. La certificación exige el 80 % de las aprobadas: sin esto, nadie llegaría nunca al certificado.

Y para casar cada cosa, tres identificadores que **hoy están vacíos**:

| Qué | Dónde | Cómo está hoy |
|---|---|---|
| Código de la acción, p. ej. `ADECOPRIA-AF1` | **Número ID del curso** | los dos cursos lo tienen vacío |
| Número de grupo | **Número ID del grupo** | **no hay ningún grupo creado todavía** |
| Cédula, solo dígitos | **Número de ID** del usuario | ninguna cuenta lo tiene |

De los tres, el de los usuarios lo llenamos nosotros al crearlos. Los otros dos son tuyos.

> Ojo con la cédula: Moodle **no exige que el Número de ID sea único**, y si aparecen dos iguales no sabemos cuál es cuál. Nosotros nunca vamos a crear dos, pero si alguien carga usuarios a mano conviene saberlo.

### 3 · Dos preguntas, y una decisión

- **¿Tienen activo el mensaje de bienvenida al curso?** Es aparte de nuestro correo de credenciales y no queremos mandar dos mensajes a la misma persona por lo mismo.
- **¿Montamos curso para las acciones presenciales?** De las 7 de ADECOPRIA, solo AF1 y AF2 son virtuales —y son justo las que ya tienes—. AF3 a AF6 son talleres de uno o dos días y AF7 es un foro. Sin curso en Moodle no hay avance que leer ni forma de certificar por esta vía, así que esas cinco habría que cerrarlas de otra manera. Dinos qué prefieres y lo adaptamos.

---

## El orden

1. Creas el rol y el token, y me lo pasas.
2. Probamos contra **un curso de prueba con dos o tres usuarios inventados**, antes de tocar a nadie real.
3. Con eso en verde, configuras la finalización por nota aprobatoria y los Números ID de cursos y grupos.
4. Encendemos la matrícula automática.

---

## C · Reportes

El CRM ya genera tres reportes para el SENA, y hoy mismo los probé en la instancia: salen con sus dos hojas —las filas que entran y, aparte, las que no con su motivo—. ¿Nos envías un ejemplo de los dos que mencionas, para ver si ya son alguno de los nuestros?

Sobre la caracterización: no hace falta que Moodle la comparta. El CRM se la pregunta directamente a la persona al completar su ficha, como pregunta opcional, porque el reporte de cargue al SEP la incluye. Traerla también de Moodle sería tener dos copias de un dato sensible.

Quedo atento.

**José Díaz** — Líder de desarrollo Convoca CRM, Grupo AE
