# Dos correos que destraban lo que no depende de nosotros

**Para Mauricio, para reenviar.** Los dos están escritos para que el que los recibe pueda
contestar **en un renglón**, sin reuniones. Copie, pegue, ponga el destinatario y mande.

Están redactados sin jerga de código a propósito: quien los lee no es del equipo técnico.

---

## 1 · Al proveedor del aula virtual (LMS)

> **Asunto:** Avance de los participantes — qué necesitamos recibir y en qué formato
>
> Buenos días,
>
> Estamos cerrando el seguimiento académico del proyecto y nos falta una sola cosa de ustedes:
> **el avance de cada participante dentro del aula**.
>
> Lo que necesitamos es, por cada persona y cada actividad del curso:
>
> | Campo | Ejemplo |
> |---|---|
> | Documento de la persona | 1017… |
> | Código de la acción de formación | AF1 |
> | Nombre de la actividad | UT3 |
> | ¿La completó? | Sí / No |
> | Fecha en que la completó | 2026-09-18 |
> | Último ingreso al aula | 2026-09-22 |
>
> **Nos sirve en el formato que a ustedes les resulte más fácil**: un archivo de Excel o CSV
> subido cada noche, una consulta a su API, o un envío automático a un enlace que les demos.
> Nosotros nos adaptamos a lo que ya tengan montado; no hace falta que desarrollen nada nuevo
> si ya lo exportan para otra cosa.
>
> **Por qué corre prisa.** Sin ese avance no podemos certificar a nadie: el sistema exige saber
> qué actividades completó cada persona antes de emitir un certificado, y la certificación es
> lo que se le reporta al SENA. Hoy la información está en su plataforma y no llega a la
> nuestra, así que ese paso está detenido para todo el proyecto.
>
> ¿Nos pueden decir qué opción les acomoda y para cuándo? Con eso nosotros hacemos el resto.
>
> Gracias,

**Contexto interno, no lo mande:** el modelo de datos ya está (`actividades` y
`avances_actividad`) y las pantallas ya saben leerlo. Lo único que falta es quién lo escriba.
En cuanto llegue un archivo de muestra, la carga se hace en horas.

---

## 2 · Al SENA

> **Asunto:** Columna ESTADO del cargue — qué valor corresponde a un retiro
>
> Buenos días,
>
> Tenemos una duda puntual sobre el archivo de cargue de participantes y preferimos preguntar
> antes que asumir.
>
> Cuando una persona **no termina la formación**, en nuestro sistema queda registrada en una de
> estas cuatro situaciones:
>
> 1. **Retirado** — pidió retirarse formalmente
> 2. **Desertó** — dejó de asistir sin avisar
> 3. **Abandonó** — nunca llegó a iniciar
> 4. **No aprobó** — cursó completo y no alcanzó la nota
>
> **La pregunta:** ¿qué valor esperan en la columna **ESTADO** para cada una de esas cuatro?
> ¿Hay un valor distinto para cada situación, o todas van bajo el mismo? ¿Y deben incluirse en
> el archivo, o se reportan únicamente los que continúan y los certificados?
>
> Lo preguntamos porque hoy, al no tener ese valor, **esas personas no viajan en el archivo**.
> Eso hace que el total reportado sea menor que el real, sin que quede explicación de qué pasó
> con ellas. Preferimos reportarlas correctamente antes que un archivo que cuadre por omisión.
>
> Quedamos atentos.
>
> Gracias,

**Contexto interno, no lo mande:** el código ya tiene el sitio exacto donde se añaden
(`ETAPAS_DEL_REPORTE` en `backend/src/crm/etapas.ts`, con un comentario que lo dice). El
trabajo es de minutos en cuanto contesten. Lo que no se puede es inventar el valor: un valor
equivocado arriesga el rechazo del archivo completo.

---

## Qué pasa cuando contesten

| Respuesta | Trabajo nuestro |
|---|---|
| El LMS dice cómo manda el avance | Horas: leer su formato y cargarlo. El resto ya está |
| El SENA dice qué va en ESTADO | Minutos: una línea en `etapas.ts` y su prueba |

Son las dos cosas del proyecto que **no avanzan por más que trabajemos**, y las dos se
destraban con un correo.
