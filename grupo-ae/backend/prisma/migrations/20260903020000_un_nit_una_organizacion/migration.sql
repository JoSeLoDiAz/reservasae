-- Un NIT, una organizacion. Orden del cliente, 3 sep 2026.
--
-- `instituciones` era unica por (nit, razonSocial), asi que el
-- mismo NIT admitia varias filas y el formulario publico decia
-- «ese NIT ampara a 2 organizaciones. Elija la suya».
--
-- `empresas` --la tabla que de verdad va al F7-- YA era unica por
-- nit. O sea que un NIT ya era una organizacion donde importa, y
-- el directorio era el unico sitio que decia lo contrario.
--
-- El F7 va POR ORGANIZACION: dos nombres para el mismo NIT son
-- dos filas que el SENA no puede cuadrar con un solo registro.

-- 1 · se elige la fila que se queda, por este orden:
--     verificada > no venida de un humano > la mas vieja
CREATE TEMP TABLE se_queda AS
SELECT DISTINCT ON (nit) id, nit
  FROM instituciones
 ORDER BY nit,
          ("verificadaEn" IS NULL),      -- primero las verificadas
          (fuente = 'HUMANO'),           -- las tecleadas, al final
          "creadoEn";                    -- y a igualdad, la primera

-- 2 · lo que apunta a una repetida pasa a apuntar a la que queda
UPDATE empresas e
   SET "institucionId" = s.id
  FROM instituciones i
  JOIN se_queda s ON s.nit = i.nit
 WHERE e."institucionId" = i.id
   AND i.id <> s.id;

UPDATE propuestas_institucion p
   SET "institucionId" = s.id
  FROM instituciones i
  JOIN se_queda s ON s.nit = i.nit
 WHERE p."institucionId" = i.id
   AND i.id <> s.id;

-- 3 · fuera las repetidas
DELETE FROM instituciones
 WHERE id NOT IN (SELECT id FROM se_queda);

DROP TABLE se_queda;

-- 4 · y que no vuelvan
DROP INDEX IF EXISTS "instituciones_nit_razonSocial_key";
CREATE UNIQUE INDEX "instituciones_nit_key" ON "instituciones"("nit");
