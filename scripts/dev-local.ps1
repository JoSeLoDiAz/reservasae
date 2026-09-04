# Levanta Convoca en local -- backend y frontend-- SUELTOS de la terminal
# que los lanza.
#
# Por que existe: los dos servidores se venian arrancando a mano desde una
# terminal (o desde una sesion de Claude Code), y al cerrarla se caian los
# dos. El sintoma es de los que enganan: el Next puede quedar vivo y el
# backend no, y entonces la pagina CARGA --HTTP 200, HTML completo-- pero
# todo /api da 500 y el panel se queda en «Entrando...». Parece el
# frontend y nunca lo es.
#
# Los procesos que arranca aqui sobreviven a cerrar la terminal. NO
# sobreviven a reiniciar el equipo: eso es a proposito, para no dejar dos
# servidores comiendo memoria en un portatil que no siempre esta con esto.
#
# A mano:
#   powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1 -Estado
#   powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1 -Reiniciar
#   powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1 -Parar

param(
    [switch]$Parar,
    [switch]$Estado,
    [switch]$Reiniciar
)

$ErrorActionPreference = 'Stop'

# Los puertos NO se configuran desde aqui, a proposito. El 4100 esta escrito
# a fuego en `frontend/next.config.ts` (el rewrite de /api) y el 3100 en
# `frontend/package.json` (`next dev -p 3100`). Ponerlos como variable aqui
# invitaria a cambiar uno solo, que es exactamente el fallo que este script
# existe para no repetir.
$PuertoBackend  = 4100
$PuertoFrontend = 3100

$Raiz = Split-Path -Parent $PSScriptRoot
$Logs = Join-Path $env:LOCALAPPDATA 'convoca-dev'
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
    Escribir "Convoca en local:"
    VerEstado
    return
}

if ($Parar) {
    Escribir "Parando Convoca:"
    PararUno 'frontend' $PuertoFrontend
    PararUno 'backend'  $PuertoBackend
    return
}

if ($Reiniciar) {
    Escribir "Reiniciando Convoca:"
    PararUno 'frontend' $PuertoFrontend
    PararUno 'backend'  $PuertoBackend
    Start-Sleep -Seconds 2
}

Escribir "Levantando Convoca:"
# El backend primero: el frontend le proxea /api, y si arranca antes las
# primeras llamadas del panel dan 500 aunque acabe subiendo.
ArrancarUno 'backend'  'dev:backend'  $PuertoBackend
ArrancarUno 'frontend' 'dev:frontend' $PuertoFrontend
Escribir ""
Escribir "  http://localhost:$PuertoFrontend/admin"
Escribir "  registros en $Logs"
