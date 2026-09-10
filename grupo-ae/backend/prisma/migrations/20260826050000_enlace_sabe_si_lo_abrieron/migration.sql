-- El enlace recuerda si lo abrieron, y si lo anuló otro.

-- El aviso que ve el asesor dice «antes de generar otro,
-- revise si el que mandó ya fue abierto». Hasta hoy eso era
-- pedirle una respuesta que el sistema no guardaba en ningún
-- lado: no había forma de saberlo.
ALTER TABLE "enlaces_completado" ADD COLUMN "abiertoEn" TIMESTAMP(3);

-- Y se separa «lo usó la persona» de «lo anuló uno nuevo»:
-- hasta ahora las dos cosas escribían en usadoEn, así que un
-- enlace anulado parecía uno que alguien completó.
ALTER TABLE "enlaces_completado" ADD COLUMN "anuladoEn" TIMESTAMP(3);
