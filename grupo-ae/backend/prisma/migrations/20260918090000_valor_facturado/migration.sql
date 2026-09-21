-- Lo FACTURADO de un negocio, aparte de lo cotizado.
--
-- `valor` decía lo que se le cotizó al cliente, y era la única cifra.
-- El informe del mes sumaba eso como «ganado», y lo cotizado no es lo
-- que entra: se gana al cerrar y se factura después, a veces por menos
-- —un descuento de último minuto, diez licencias en vez de doce—.
--
-- NULL es «sin facturar», y por eso la columna no lleva DEFAULT 0
-- como `valor`: un cero diría que se facturó y salió en cero. Todas
-- las oportunidades que ya existen quedan sin facturar, que es la
-- verdad; nadie tiene que salir a corregir filas después de esto.
--
-- Mismo DECIMAL(14,2) que `valor`: en plata un Float pierde centavos
-- al redondear, y el error se multiplica por cada suma del informe.
--
-- Solo se agrega una columna que admite nulos: no reescribe la tabla
-- ni bloquea las lecturas del tablero mientras corre.

ALTER TABLE "oportunidades" ADD COLUMN "valorFacturado" DECIMAL(14,2);
