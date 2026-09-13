# Trae a este local lo que Jose suba a su rama, sin preguntar.
#
# Lo pidio Mauricio el 12 sep 2026: «actualiza mi local cada vez que
# Jose actualice su rama», «no dependas de mi». Y el 13: «avisame
# cuando actualices los cambios que hizo Jose para empezar a ajustar».
#
# REGLAS DE SEGURIDAD, y son el motivo de que esto no sea un `git pull`
# en un bucle:
#
#   - si hay cambios SIN GUARDAR, no toca nada. Un merge sobre un arbol
#     sucio puede perder trabajo, y ya paso una vez en este equipo.
#   - si la fusion da conflicto, la deshace y lo deja anotado. Un
#     conflicto lo resuelve una persona, no una tarea programada.
#   - NO empuja nada. Actualiza el local y ahi se queda: publicar es
#     una decision, no un automatismo.
#
# A mano:
#   powershell -ExecutionPolicy Bypass -File scripts\seguir-a-jose.ps1
#
# El registro queda en %LOCALAPPDATA%\convoca-dev\seguir-a-jose.log

param([string]$Rama = 'origin/dev')

$ErrorActionPreference = 'Continue'

$Raiz    = Split-Path -Parent $PSScriptRoot
$Suya    = $Rama
$Carpeta = Join-Path $env:LOCALAPPDATA 'convoca-dev'
$Log     = Join-Path $Carpeta 'seguir-a-jose.log'

if (-not (Test-Path $Carpeta)) { New-Item -ItemType Directory -Path $Carpeta | Out-Null }
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 512KB)) { Remove-Item $Log -Force -ErrorAction SilentlyContinue }

function Anotar($msg) {
    $linea = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $msg
    Add-Content -Path $Log -Value $linea -Encoding utf8
}

# Un globo de la bandeja y no una ventana: esto puede saltar mientras
# el esta escribiendo, y una ventana modal le robaria el teclado.
function Avisar($titulo, $texto) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $icono = New-Object System.Windows.Forms.NotifyIcon
        $icono.Icon = [System.Drawing.SystemIcons]::Information
        $icono.BalloonTipTitle = $titulo
        $icono.BalloonTipText = $texto
        $icono.Visible = $true
        $icono.ShowBalloonTip(20000)
        Start-Sleep -Seconds 12
        $icono.Dispose()
    } catch {
        Anotar "  (no pude mostrar el aviso: $($_.Exception.Message))"
    }
}

Set-Location $Raiz

git fetch --prune --quiet 2>&1 | Out-Null

$detras = (git rev-list --count "HEAD..$Suya" 2>$null)
if (-not $detras) { $detras = '0' }

# nada nuevo: ni se anota, para no engordar el registro
if ($detras -eq '0') { exit 0 }

$titulos = (git log --oneline "HEAD..$Suya" 2>$null) -join ' | '
Anotar "Jose subio $detras commit(s): $titulos"

$sucio = (git status --porcelain 2>$null)
if ($sucio) {
    Anotar "  NO TOCO NADA: hay cambios sin guardar. Fusione usted cuando quiera."
    Avisar "Convoca: Jose subio $detras cambio(s)" "NO los traje: usted tiene cambios sin guardar. Guardelos y vuelvo a intentarlo en 15 minutos."
    exit 0
}

$antes = (git rev-parse HEAD)
git merge $Suya --no-edit 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    git merge --abort 2>&1 | Out-Null
    Anotar "  CONFLICTO: la fusion se deshizo. Hay que resolverla a mano."
    Avisar "Convoca: conflicto con lo de Jose" "$detras cambio(s) chocan con los suyos. No toque nada: hay que resolverlo a mano."
    exit 0
}

$despues = (git rev-parse HEAD)
if ($antes -eq $despues) {
    Anotar "  ya estaba todo"
    exit 0
}

Anotar "  fusionado en local (sin empujar): $despues"
$corto = (git log --oneline -3 "$antes..$despues" 2>$null) -join '; '
Avisar "Convoca: ya tiene $detras cambio(s) de Jose" "En su local, sin empujar. Lo ultimo: $corto"
