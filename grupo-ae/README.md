# grupo-ae — el segundo CRM

Copia completa de Convoca (`backend/` + `frontend/` de la raíz) para armar
sobre ella el CRM de **Grupo AE**, sin tocar el que ya está en producción.

Las dos instancias corren a la vez en el mismo portátil. Todo lo que podía
chocar está cambiado, y nada más: el código de dentro sigue siendo el
mismo, incluidas las referencias a «reservasae» de marcas, hosts y
pruebas. Eso se cambia cuando se decidan los ajustes, uno por uno; un
reemplazo masivo rompería las pruebas de host y de gremio.

## Lo que se cambió respecto a la raíz

| | Convoca (raíz) | Grupo AE (esta carpeta) |
|---|---|---|
| paquete pnpm | `frontend` / `backend` | `grupoae-frontend` / `grupoae-backend` |
| frontend | 3100 | **3200** |
| backend | 4100 | **4200** |
| base de datos | `reservasae_prueba` | **`grupoae_prueba`** |
| contenedores | `reservasae_*` | `grupoae_*` |
| Postgres en Docker | 5433 | **5533** |
| nginx en Docker | 4600 | 4700 |
| volumen | `reservasae-pgdata` | `grupoae-pgdata` |

El **5433 nunca** se usa aquí: `backend/prisma/guardia-de-base.ts` lo trata
como producción venga de donde venga, y tiene razón en hacerlo.

Además, en `frontend/next.config.ts` hay dos líneas que la raíz no
necesita: `turbopack.root` y `outputFileTracingRoot` apuntan **dos**
niveles arriba, porque esta copia está anidada un nivel más adentro. Sin
eso el dev server arranca y se cae al primer render.

## Levantarla

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1
powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1 -Estado
powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1 -Parar
```

Los procesos sobreviven a cerrar la terminal. Registros en
`%LOCALAPPDATA%\grupoae-dev`.

Antes hace falta que el Postgres del **5544** esté arriba —es el mismo
servidor que usa Convoca, con otra base dentro—:

```
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "C:\Users\mapalma\pgdata-reservasae" -o "-p 5544" -l "C:\Users\mapalma\pgdata-reservasae\arranque.log" start
```

- Panel: <http://localhost:3200/admin>
- Comprobación sana: `/api/admin/campanas` da **401**. Un 500 es el
  backend caído; un 404, la ruta mal armada.

## La base

`grupoae_prueba` en `localhost:5544`, con las 54 migraciones aplicadas y
**vacía a propósito**: se va llenando según lo que Grupo AE necesite. Hay
una cuenta `SUPERADMIN` para entrar (`proyectos@grupo-ae.com.co`), con
contraseña temporal que se cambia al primer inicio de sesión.

## Lo que falta

Los ajustes que separan este CRM del de Convoca. Todavía sin definir: hoy
esto es una réplica exacta corriendo en su propio puerto y su propia base.
