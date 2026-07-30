# Mantiene abierto el tunel SSH hacia el Postgres del servidor.
#
# El Postgres de reservasae se publica en el servidor SOLO en 127.0.0.1:5433,
# asi que no hay ruta directa desde esta maquina. Este tunel trae ese puerto
# hasta localhost:5433 para poder trabajar con DBeaver, psql o Prisma.
#
# Lo lanza la tarea programada "Tunel BD reservasae" al iniciar sesion.
# A mano:  powershell -ExecutionPolicy Bypass -File scripts\tunel-bd.ps1

$ErrorActionPreference = 'Continue'

$PuertoLocal  = 5433
$PuertoRemoto = 5433
$Servidor     = 'sep-vm'   # alias definido en ~/.ssh/config

# Log obligatorio: sin esto, cuando el tunel falla desde la tarea programada no
# queda ni un rastro de por que, y el sintoma (puerto vacio) no dice nada.
$Log = Join-Path $env:LOCALAPPDATA 'tunel-bd.log'

function Escribir($msg) {
    $linea = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $Log -Value $linea -Encoding utf8
}

# Truncar si crece demasiado: esto corre indefinidamente.
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 1MB)) {
    Remove-Item $Log -Force -ErrorAction SilentlyContinue
}

Escribir "=== arranque del script (PID $PID, usuario $env:USERNAME) ==="

# Los argumentos van en un array y no con continuaciones de linea (`) porque el
# backtick con un espacio invisible al final rompe el comando entero sin avisar.
$argumentos = @(
    '-N', '-T'
    '-o', 'ExitOnForwardFailure=yes'
    '-o', 'ServerAliveInterval=30'   # detecta la caida en ~90s
    '-o', 'ServerAliveCountMax=3'
    '-o', 'ConnectTimeout=10'
    '-o', 'BatchMode=yes'            # nunca preguntar nada: aqui no hay quien responda
    '-L', "${PuertoLocal}:127.0.0.1:${PuertoRemoto}"
    $Servidor
)

while ($true) {
    # Si el puerto ya esta ocupado (otro tunel, o una instancia duplicada de la
    # tarea) no tiene sentido intentarlo: ExitOnForwardFailure haria salir a ssh
    # de inmediato y entrariamos en un bucle de reintentos inutil.
    $ocupado = Get-NetTCPConnection -LocalPort $PuertoLocal -State Listen -ErrorAction SilentlyContinue
    if ($ocupado) {
        Escribir "puerto $PuertoLocal ya ocupado por PID $($ocupado[0].OwningProcess); esperando"
        Start-Sleep -Seconds 30
        continue
    }

    Escribir "abriendo tunel: ssh $($argumentos -join ' ')"
    $err = & ssh @argumentos 2>&1
    $codigo = $LASTEXITCODE

    # Si ssh retorna es que el tunel murio: red caida, servidor reiniciado, o
    # portatil que desperto de suspension.
    Escribir "ssh termino con codigo $codigo. Salida: $($err -join ' | ')"
    Start-Sleep -Seconds 10
}
