Hola, Ronald:

Te escribo de nuevo porque el panorama cambió: **el CRM ya está instalado en la instancia**. Abajo va cómo quedó, cómo se conecta con el Campus, y lo que necesito de tu lado.

Antes de nada: **no toqué nada de Moodle**. Ni sus contenedores, ni su PostgreSQL 18, ni nginx, ni sus datos. Lo comprobé después de cada paso: `campusadecopria.com` y `campusgrupoadvanced.com` siguieron respondiendo todo el tiempo.

---

## A · Instalación — hecha

**Convoca CRM 0.19.0-JD**, desarrollo propio. Node.js 22 y su propio PostgreSQL **17 en contenedor**, aparte del tuyo: no comparten clúster, ni usuario, ni puerto — el tuyo sigue en el 5432 y el nuestro publica en el 5433.

Todo en Docker, en su propio proyecto: backend, frontend, un nginx propio que escucha **solo en `127.0.0.1:4600`** —así que no estorba al del puerto 80— la base, y un conector de Cloudflare Tunnel. Sin Redis ni colas externas.

**El correo sale por SMTP autenticado desde nuestro propio contenedor**, hacia fuera. No hace falta instalar ni configurar nada de correo en la instancia, que era lo que te estaban pidiendo.

### Lo que consume, medido con el sistema funcionando

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

## B · Integración — va en los dos sentidos

```
CRM ──── al pasar a «Inscrito» ────►  Moodle
         crea el usuario, lo matricula en su curso, lo mete en su grupo

CRM ◄─── cada 20 minutos ──────────   Moodle
         avance, último acceso y calificaciones
```

La matrícula deja de hacerse a mano.

**La conexión desde la instancia al Campus ya funciona**, así que no hay nada de red que abrir: lo único que falta es el token. Y como salimos desde un contenedor, **nos vas a ver llegar desde `172.18.0.1`** — esa es la dirección que va en la restricción de IP del token.

### Las credenciales las manda el CRM, no Moodle

Generamos la contraseña, la pasamos en la misma llamada de creación junto con la preferencia `auth_forcepasswordchange`, y le enviamos a la persona la dirección del Campus, su usuario y su clave con nuestra plantilla. Así no dependemos de tu correo.

Y eso **no necesita el permiso peligroso**. En Moodle 5.2, `lib/classes/user.php:1072`:

```php
return ($USER->id != $user->id && (has_capability('moodle/user:update', $systemcontext) ||
        ($user->timecreated > time() - 10 && has_capability('moodle/user:create', $systemcontext))));
```

Es decir: **con `moodle/user:create` basta, si el usuario se creó hace menos de 10 segundos**. Como la preferencia viaja en la misma llamada, entra en esa ventana, y **no hace falta `moodle/user:update`**.

> **Un detalle que conviene que sepas, porque falla en silencio**: si esa ventana se pasara —una llamada lenta, un reintento—, `useredit_update_user_preference` (`user/editlib.php:181`) **se salta la preferencia sin dar error**. El usuario quedaría creado sin forzar el cambio de clave y nadie se enteraría. Por eso lo comprobamos leyendo la preferencia después de crear, y si falta lo reportamos en nuestro panel en vez de dejarlo pasar.

> La otra vía sería usar `createpassword`, pero entonces **es Moodle quien genera y envía la clave por tu SMTP** (`setnew_password_and_mail`), que es justo lo que queremos evitar.

### Lo que leemos

Documento (como llave) y correo; qué curso es cada acción; grupos; matrículas; finalización de cada actividad con su fecha; último acceso; calificaciones; y qué actividades cuentan para la finalización del curso.

No necesitamos asistencia, ni autorizaciones, ni fechas de grupo — el cronograma lo lleva el CRM.

### Y una cosa que ya está decidida de nuestro lado

**Solo van a Moodle las acciones virtuales.** De las 7 de ADECOPRIA son AF1 y AF2; AF3 a AF6 son talleres de uno o dos días y AF7 es un foro, y esas se cierran por otra vía. **No hay que montarles curso.**

---

## Lo que necesito de ti

### 1 · El rol y el token

Un rol dedicado asignado **en Sistema** — no un usuario administrador, porque se salta todas las restricciones.

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

> **Y algo que te va a saltar al armar el rol, para que no te frene:** Moodle te mostrará **`moodle/course:update`** como «capacidad requerida» de `core_course_get_contents`. Ese aviso es **informativo**: la función está declarada como de lectura y en el código solo valida el contexto, no exige esa capacidad. **No se la des** — es de escritura y con ella se pueden editar los ajustes del curso. Si al probar algo fallara por eso, me lo dices y lo miramos, pero no debería.

### 2 · La configuración de los cursos — y esto es lo más importante del correo

**En las actividades calificables, la finalización tiene que depender de la nota aprobatoria.** En cada una:

> Condiciones de finalización → Añadir requisitos → **«Recibir una calificación» → «Calificación de aprobado»**

Poner solo la nota mínima no basta. Si la actividad se completa al verla o al entregar, Moodle devuelve «completada» a secas y el CRM **no puede distinguir «aprobó» de «entregó»**. La certificación exige el 80 % de las aprobadas: sin esto, nadie llegaría nunca al certificado.

Y tres identificadores, que son los que permiten casar cada cosa:

| Qué | Dónde | Quién lo llena |
|---|---|---|
| Código de la acción, p. ej. `ADECOPRIA-AF1` | **Número ID del curso** | tú |
| Número de grupo | **Número ID del grupo** | tú |
| Cédula, solo dígitos | **Número de ID** del usuario | **nosotros**, al crearlo |

> Ojo con la cédula: Moodle **no exige que el Número de ID sea único**, y si aparecen dos iguales no sabemos cuál es cuál. Nosotros nunca vamos a crear dos, pero si alguien carga usuarios a mano conviene saberlo.

### 3 · Dos cosas sueltas

- Que cada curso tenga una instancia de **«Matriculación manual» activa** (viene por defecto).
- Si en el Campus ya hay cuentas de esta gente, dime con qué convención de usuario y si tienen el Número de ID lleno: **a quien ya exista hay que enlazarlo, no crearlo otra vez**.

---

## El orden

1. Creas el rol y el token, y me lo pasas.
2. Probamos contra **un curso de prueba con dos o tres usuarios inventados**, antes de tocar a nadie real.
3. Con eso en verde, configuras la finalización por nota aprobatoria y los Números ID de cursos y grupos.
4. Encendemos la matrícula automática.

---

## C · Reportes

El CRM ya genera tres reportes para el SENA, y salen con sus dos hojas: las filas que entran y, aparte, las que no con su motivo. ¿Nos envías un ejemplo de los dos que mencionas, para ver si ya son alguno de los nuestros?

Sobre la caracterización: no hace falta que Moodle la comparta. El CRM se la pregunta directamente a la persona al completar su ficha, como pregunta opcional, porque el reporte de cargue al SEP la incluye. Traerla también de Moodle sería tener dos copias de un dato sensible.

Quedo atento.

**José Díaz** — Líder de desarrollo Convoca CRM, Grupo AE
