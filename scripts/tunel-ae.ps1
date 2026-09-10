# Saca al aire el CRM de Grupo AE (3200) por un tunel rapido de Cloudflare.
#
# Es un tunel SIN cuenta: Cloudflare regala un dominio
# `algo.trycloudflare.com` mientras el proceso viva. No es el tunel con
# token de `docker-compose.yml` --ese tiene dominio fijo y hace falta la
# cuenta--, y por eso **la direccion cambia cada vez que se levanta**.
# Sirve para enseñar la instancia; para algo permanente, token y hostname.
#
# El binario NO esta instalado en el sistema: winget pide administrador de
# dominio y aqui no lo hay. Es un solo .exe en la carpeta del usuario, que
# corre igual y no necesita permisos.
#
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-ae.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-ae.ps1 -Estado
#   powershell -ExecutionPolicy Bypass -File scripts\tunel-ae.ps1 -Parar

param(
    [switch]$Parar,
    [switch]$Estado,
    [int]$Puerto = 3200
)

$ErrorActionPreference = 'Stop'

$Logs = Join-Path $env:LOCALAPPDATA 'grupoae-dev'
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

function Vivos() {
    return @(Get-Process cloudflared -ErrorAction SilentlyContinue)
}

if ($Estado) {
    $p = Vivos
    if ($p.Count -eq 0) { Write-Host "  tunel  CAIDO"; return }
    Write-Host ("  tunel  arriba (PID {0})" -f ($p[0].Id))
    $d = DireccionEnRegistro
    if ($d) { Write-Host "  $d" }
    Write-Host "  registro en $Registro"
    return
}

if ($Parar) {
    $p = Vivos
    if ($p.Count -eq 0) { Write-Host "  tunel  ya estaba parado"; return }
    foreach ($uno in $p) { & taskkill /PID $uno.Id /T /F 2>&1 | Out-Null }
    Write-Host "  tunel  parado"
    return
}

if ((Vivos).Count -gt 0) {
    Write-Host "  tunel  ya estaba arriba"
    $d = DireccionEnRegistro
    if ($d) { Write-Host "  $d" }
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
                    # «algo» como el gremio del convenio --asi resuelve la
                    # marca gremio-del-host.ts--. Ese gremio no existe, y
                    # entonces TODO da 404, el panel incluido. Presentando
                    # el host como localhost la peticion entra igual que
                    # cuando se abre en el propio equipo.
                    '--http-host-header', "localhost:$Puerto",
                    '--url', "http://localhost:$Puerto") `
    -WindowStyle Hidden -RedirectStandardOutput $Registro -RedirectStandardError $Fallos | Out-Null

Write-Host "Levantando el tunel sobre :$Puerto"
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $d = DireccionEnRegistro
    if ($d) {
        Write-Host ""
        Write-Host "  $d"
        Write-Host "  $d/admin"
        Write-Host ""
        Write-Host "  registro en $Registro"
        return
    }
}
Write-Host "  no salio la direccion en 60s -- mire $Fallos"
