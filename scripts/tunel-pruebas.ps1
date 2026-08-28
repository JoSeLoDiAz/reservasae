# Trae la base de PRUEBAS hasta localhost:5434.
#
# El Postgres de pruebas se publica en el servidor solo en 127.0.0.1:5434,
# igual que el de produccion en el 5433. Este tunel lo acerca para poder
# trabajar con Prisma, psql o DBeaver contra datos inventados.
#
# El puerto local es OTRO a proposito. Con los dos en el 5433 no habria forma
# de saber contra que se esta escribiendo: `guardia-de-base.ts` distingue las
# dos bases por el puerto, y esa es toda la defensa.
#
# A mano:  powershell -ExecutionPolicy Bypass -File scripts\tunel-pruebas.ps1

$ErrorActionPreference = 'Continue'

$PuertoLocal  = 5434
$PuertoRemoto = 5434
$Servidor     = 'sep-vm'   # alias definido en ~/.ssh/config

$Log = Join-Path $env:LOCALAPPDATA 'tunel-pruebas.log'

function Escribir($msg) {
    $linea = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $Log -Value $linea -Encoding utf8
    Write-Host $linea
}

if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 1MB)) {
    Remove-Item $Log -Force -ErrorAction SilentlyContinue
}

# Si ya hay algo escuchando, no se abre otro: dos tuneles al mismo puerto
# fallan con un mensaje que no dice que el problema es que ya estaba.
$ocupado = Get-NetTCPConnection -LocalPort $PuertoLocal -State Listen -ErrorAction SilentlyContinue
if ($ocupado) {
    Escribir "El $PuertoLocal ya esta ocupado. Si es este tunel, no hace falta otro."
    exit 0
}

Escribir "=== arranque (PID $PID, usuario $env:USERNAME) ==="

# En un array y no con continuaciones: un backtick con un espacio invisible
# detras rompe el comando entero sin avisar.
$argumentos = @(
    '-N', '-T'
    '-o', 'ExitOnForwardFailure=yes'
    '-o', 'ServerAliveInterval=30'
    '-o', 'ServerAliveCountMax=3'
    '-o', 'ConnectTimeout=10'
    '-o', 'BatchMode=yes'
    '-L', "${PuertoLocal}:127.0.0.1:${PuertoRemoto}"
    $Servidor
)

Escribir "ssh $($argumentos -join ' ')"

while ($true) {
    & ssh.exe @argumentos
    Escribir "el tunel se cayo (codigo $LASTEXITCODE). Reintento en 10 s."
    Start-Sleep -Seconds 10
}
