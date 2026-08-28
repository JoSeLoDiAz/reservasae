-- Una sola grafía por entidad en la auditoría.
--
-- Había SEIS grafías para cuatro cosas: 'participante' y
-- 'Participante', 'Institucion' e 'instituciones', más
-- 'Persona', 'Reserva' y 'Empresa' en mayúscula.
--
-- El daño: el historial de una ficha consulta
-- `where: { entidad, entidadId }`. Una ficha que preguntaba
-- por 'participante' NO ENCONTRABA los registros guardados
-- como 'Participante'. En esta base eran 9 de 36 — el
-- «Control de cambios» llevaba tiempo enseñando tres cuartas
-- partes de la historia, y media historia se ve igual de
-- completa que toda.
--
-- Se normaliza a minúscula y singular, que es lo que ahora
-- exige el catálogo en código (`ENTIDADES`). Es un UPDATE de
-- datos: no cambia el esquema y no borra nada.

UPDATE "registros_auditoria" SET "entidad" = 'participante'
  WHERE "entidad" IN ('Participante', 'participantes');

UPDATE "registros_auditoria" SET "entidad" = 'persona'
  WHERE "entidad" IN ('Persona', 'personas');

UPDATE "registros_auditoria" SET "entidad" = 'institucion'
  WHERE "entidad" IN ('Institucion', 'instituciones');

UPDATE "registros_auditoria" SET "entidad" = 'reserva'
  WHERE "entidad" IN ('Reserva', 'reservas');

UPDATE "registros_auditoria" SET "entidad" = 'empresa'
  WHERE "entidad" IN ('Empresa', 'empresas');
