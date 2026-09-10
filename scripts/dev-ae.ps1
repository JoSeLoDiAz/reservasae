# Levanta el CRM de GRUPO AE en local -- backend y frontend-- SUELTOS de la
# terminal que los lanza. Es el gemelo de dev-local.ps1 para la segunda
# instancia, la de `grupo-ae/`.
#
# Las dos pueden correr a la vez y no se estorban: Convoca va por 3100/4100
# contra `reservasae_prueba`, y esta por 3200/4200 contra `grupoae_prueba`.
# Ese es todo el motivo de que exista un segundo guion en vez de un
# parametro: dos juegos de puertos que se confunden solos ya costaron una
# tarde una vez.
#
# A mano:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1 -Estado
#   powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1 -Reiniciar
#   powershell -ExecutionPolicy Bypass -File scripts\dev-ae.ps1 -Parar

param(
    [switch]$Parar,
    [switch]$Estado,
    [switch]$Reiniciar
)

$ErrorActionPreference = 'Stop'

# Igual que en dev-local.ps1, los puertos NO se configuran desde aqui: el
# 4200 esta a fuego en `grupo-ae/frontend/next.config.ts` y el 3200 en
# `grupo-ae/frontend/package.json`. Aqui solo se comprueban.
$PuertoBackend  = 4200
$PuertoFrontend = 3200

$Raiz = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $env:LOCALAPPDATA 'grupoae-dev'
if (-not (Test-Path $Logs)) { New-Item -ItemType Directory -Path $Logs | Out-Null }

function Escribir($msg) {
    Write-Host $msg
}

# Quien escucha en un puerto, o $null. Se mira el puerto y no un PID
# guardado en un archivo: un PID en disco miente en cuanto alguien arranca
# el servidor por su cuenta, y el puerto siempre dice la verdad.
function QuienEscucha([int]$puerto) {
    try {
        $c = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction Stop
        return ($c | Select-Object -First 1).OwningProcess
    } catch {
        return $null
    }
}

function PararUno([string]$nombre, [int]$puerto) {
    $procId = QuienEscucha $puerto
    if (-not $procId) {
        Escribir "  $nombre  :$puerto  ya estaba parado"
        return
    }
    # /T porque pnpm deja hijos: matar solo al que escucha deja el arbol
    # a medias y el puerto ocupado.
    & taskkill /PID $procId /T /F 2>&1 | Out-Null
    Escribir "  $nombre  :$puerto  parado (PID $procId)"
}

# Los huerfanos que el puerto no ve.
#
# `nest start --watch` no es el que escucha: arranca un hijo, y cuando el
# hijo muere el vigilante levanta otro. Matar por puerto deja vivo al
# vigilante, que a los pocos segundos vuelve a ocupar el puerto -- o peor,
# se queda con el motor de Prisma abierto y `prisma generate` falla con
# EPERM sin decir por que.
#
# Pasaron NUEVE en una sola tarde de reinicios. Se filtran por la ruta de
# `grupo-ae` en su linea de ordenes: los de Convoca no se tocan.
function LimpiarHuerfanos() {
    $mios = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
              Where-Object { $_.CommandLine -match 'grupo-ae|grupoae' })
    if ($mios.Count -eq 0) { return }
    foreach ($p in $mios) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
    }
    Escribir "  huerfanos  $($mios.Count) proceso(s) de grupo-ae terminados"
}

function ArrancarUno([string]$nombre, [string]$guion, [int]$puerto) {
    $procId = QuienEscucha $puerto
    if ($procId) {
        Escribir "  $nombre  :$puerto  ya estaba arriba (PID $procId)"
        return
    }

    $pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
    if (-not $pnpm) { throw "no encuentro pnpm.cmd en el PATH" }

    # Dos archivos y no uno: -RedirectStandardOutput y -RedirectStandardError
    # no admiten el mismo destino, y falla el arranque entero si se intenta.
    $salida = Join-Path $Logs "$nombre.log"
    $fallos = Join-Path $Logs "$nombre.err.log"
    foreach ($f in @($salida, $fallos)) {
        if ((Test-Path $f) -and ((Get-Item $f).Length -gt 5MB)) { Remove-Item $f -Force }
    }

    # ENTORNO=prueba: sin esto la raiz «/» devuelve 404 a proposito, y
    # detras del tunel lo primero que ve quien abre el enlace es ese
    # 404. Con la variable puesta sale el indice de entradas.
    $env:ENTORNO = 'prueba'

    # ###################################################################
    # PANEL_POR_TUNEL: abre el panel a quien entre por el enlace publico.
    #
    # Por defecto el middleware corta el panel en cuanto la peticion
    # llega por un dominio de tunel, porque ahi dentro hay nombres,
    # documentos, correos y celulares. Esta linea levanta ese corte.
    #
    # Esta puesta porque HOY `grupoae_prueba` esta vacia y hay que poder
    # enseñar el CRM por el enlace. EL DIA QUE ESA BASE LLEVE INSCRITOS
    # DE VERDAD, BORRE ESTA LINEA. Seguir pidiendo sesion no basta:
    # un enlace de tunel se reenvia solo.
    # ###################################################################
    $env:PANEL_POR_TUNEL = 'si'

    Start-Process -FilePath $pnpm -ArgumentList $guion `
        -WorkingDirectory $Raiz -WindowStyle Hidden `
        -RedirectStandardOutput $salida -RedirectStandardError $fallos | Out-Null

    # Esperar a que el puerto conteste. Sin esto el script dice «arriba»
    # antes de que lo este, y quien lo lea se va a la pagina y la ve rota.
    $limite = 90
    for ($i = 0; $i -lt $limite; $i++) {
        Start-Sleep -Seconds 1
        $procId = QuienEscucha $puerto
        if ($procId) {
            Escribir "  $nombre  :$puerto  arriba (PID $procId, ${i}s)"
            return
        }
    }
    Escribir "  $nombre  :$puerto  NO subio en ${limite}s -- mire $fallos"
}

function VerEstado() {
    foreach ($p in @(@('backend', $PuertoBackend), @('frontend', $PuertoFrontend))) {
        $procId = QuienEscucha $p[1]
        if ($procId) { Escribir ("  {0,-9} :{1}  arriba (PID {2})" -f $p[0], $p[1], $procId) }
        else         { Escribir ("  {0,-9} :{1}  CAIDO" -f $p[0], $p[1]) }
    }
    Escribir ""
    Escribir "  registros en $Logs"
}

if ($Estado) {
    Escribir "Grupo AE en local:"
    VerEstado
    return
}

if ($Parar) {
    Escribir "Parando Grupo AE:"
    PararUno 'frontend' $PuertoFrontend
    PararUno 'backend'  $PuertoBackend
    LimpiarHuerfanos
    return
}

if ($Reiniciar) {
    Escribir "Reiniciando Grupo AE:"
    PararUno 'frontend' $PuertoFrontend
    PararUno 'backend'  $PuertoBackend
    LimpiarHuerfanos
    Start-Sleep -Seconds 2
}

Escribir "Levantando Grupo AE:"
# El backend primero: el frontend le proxea /api, y si arranca antes las
# primeras llamadas del panel dan 500 aunque acabe subiendo.
ArrancarUno 'backend'  'ae:backend'  $PuertoBackend
ArrancarUno 'frontend' 'ae:frontend' $PuertoFrontend
Escribir ""
Escribir "  http://localhost:$PuertoFrontend/admin"
Escribir "  registros en $Logs"
