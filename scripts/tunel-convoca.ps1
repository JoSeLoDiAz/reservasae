# Saca al aire el formulario público de Convoca (3100) por un túnel rápido
# de Cloudflare, para revisarlo desde el teléfono o enseñárselo a alguien.
#
# Gemelo de `tunel-ae.ps1`, con dos diferencias que importan:
#
#  - Registro propio (`convoca-dev`, el mismo de `dev-local.ps1`), para que
#    los dos túneles no se pisen el archivo y `-Estado` no lea la dirección
#    del otro.
#  - `-Parar` mata SOLO el de este puerto. `tunel-ae.ps1` mata todos los
#    `cloudflared` que haya, y con las dos instancias al aire eso tumbaba
#    el de Grupo AE sin avisar.
#
# EL PANEL NO SALE, Y ES A PROPÓSITO. Detrás de un host
# `*.trycloudflare.com` el `middleware.ts` del frontend solo deja pasar el
# trámite -- `/<convenio>/preinscripcion`, `/completar/<token>` y sus API --
# y devuelve 404 a todo lo demás. Ahí dentro hay nombres, cédulas, correos
# y celulares de personas, y un enlace así se reenvía solo. Para ver el
# panel, `http://localhost:3100/admin` en el propio equipo.
#
# La dirección CAMBIA cada vez que se levanta: es un túnel sin cuenta.
#
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-convoca.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-convoca.ps1 -Estado
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-convoca.ps1 -Parar

param(
    [switch]$Parar,
    [switch]$Estado,
    [int]$Puerto = 3100
)

$ErrorActionPreference = 'Stop'

$Logs = Join-Path $env:LOCALAPPDATA 'convoca-dev'
if (-not (Test-Path $Logs)) { New-Item -ItemType Directory -Path $Logs | Out-Null }
$Registro = Join-Path $Logs 'tunel.log'
$Fallos   = Join-Path $Logs 'tunel.err.log'

function Binario() {
    $propio = Join-Path $env:USERPROFILE 'bin\cloudflared.exe'
    if (Test-Path $propio) { return $propio }
    $enRuta = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source
    if ($enRuta) { return $enRuta }
    throw "no encuentro cloudflared.exe -- descarguelo en $propio desde https://github.com/cloudflare/cloudflared/releases/latest"
}

# La direccion sale en la salida del propio cloudflared y en ningun otro
# sitio: no hay forma de saberla antes de levantarlo.
function DireccionEnRegistro() {
    foreach ($f in @($Fallos, $Registro)) {
        if (-not (Test-Path $f)) { continue }
        $m = Select-String -Path $f -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
             Select-Object -Last 1
        if ($m) { return $m.Matches[-1].Value }
    }
    return $null
}

# Solo los de ESTE puerto: la linea de comandos lo dice, y es lo unico que
# distingue un cloudflared de otro.
function Vivos() {
    return @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
             Where-Object { $_.CommandLine -like "*localhost:$Puerto*" })
}

if ($Estado) {
    $p = Vivos
    if ($p.Count -eq 0) { Write-Host "  tunel :$Puerto  CAIDO"; return }
    Write-Host ("  tunel :{0}  arriba (PID {1})" -f $Puerto, $p[0].ProcessId)
    $d = DireccionEnRegistro
    if ($d) { Write-Host "  $d/adecopria/preinscripcion" }
    Write-Host "  registro en $Registro"
    return
}

if ($Parar) {
    $p = Vivos
    if ($p.Count -eq 0) { Write-Host "  tunel :$Puerto  ya estaba parado"; return }
    foreach ($uno in $p) { & taskkill /PID $uno.ProcessId /T /F 2>&1 | Out-Null }
    Write-Host "  tunel :$Puerto  parado"
    return
}

if ((Vivos).Count -gt 0) {
    Write-Host "  tunel :$Puerto  ya estaba arriba"
    $d = DireccionEnRegistro
    if ($d) { Write-Host "  $d/adecopria/preinscripcion" }
    return
}

# Registro limpio en cada arranque: si se queda el de la vez pasada, lo
# que se lee es la direccion VIEJA, que ya no responde. Ese error se
# descubre cuando alguien abre el enlace y no carga.
foreach ($f in @($Registro, $Fallos)) { if (Test-Path $f) { Remove-Item $f -Force } }

$exe = Binario
Start-Process -FilePath $exe `
    -ArgumentList @('tunnel', '--no-autoupdate',
                    # Sin esto la app ve Host: algo.trycloudflare.com y lee
                    # «algo» como el gremio del convenio, no lo encuentra y
                    # todo da 404. Presentando el host como localhost la
                    # peticion entra igual que en el propio equipo -- y la
                    # marca que sale es la GENERAL, como en local.
                    '--http-host-header', "localhost:$Puerto",
                    '--url', "http://localhost:$Puerto") `
    -WindowStyle Hidden -RedirectStandardOutput $Registro -RedirectStandardError $Fallos | Out-Null

Write-Host "Levantando el tunel sobre :$Puerto"
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $d = DireccionEnRegistro
    if ($d) {
        Write-Host ""
        Write-Host "  formulario publico:  $d/adecopria/preinscripcion"
        Write-Host "  enlace vencido:      $d/completar/null"
        Write-Host "  (el panel da 404 a proposito: lleva datos de personas)"
        Write-Host ""
        Write-Host "  registro en $Registro"
        return
    }
}
Write-Host "  no salio la direccion en 60s -- mire $Fallos"
