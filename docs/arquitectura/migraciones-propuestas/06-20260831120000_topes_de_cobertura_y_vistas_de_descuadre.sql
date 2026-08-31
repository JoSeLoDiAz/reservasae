-- 20260831120000_topes_de_cobertura_y_vistas_de_descuadre
-- Despliegue 1 · paso expand · orden 6 de 12
-- Arregla: G-01, G-02, G-03 y G-16: el descuadre de aforo es invisible hoy. Deja ver la diferencia entre `ofertas.cuposOcupados` y la suma real de reservas, y separa el sobrecupo FIRMADO del accidental, sin poner ni un CHECK que mate el sobrecupo autorizado (regla 2).
--
-- AUDITADA POR SEPARADO: SEGURA de aplicar sola.
-- SEGURA. Se puede aplicar sola. No puede tumbar el arranque por datos, ni por nombres, ni por sintaxis, ni por enum, ni por drift de Prisma; el unico riesgo es de candado y es bajo (tabla pequena, un solo escritor, lecturas cortas). Aplique en ventana tranquila tras mirar pg_stat_activity. Cumple las reglas del dominio: no borra nada, deja el sobrecupo autorizado intacto --y con razon, porque los d
--
-- PASO MANUAL PREVIO, obligatorio:
--   Correr la primera consulta de la verificacion previa y MIRARLA, no solo lanzarla. NOT VALID no exime a las escrituras futuras: si hoy existe una cobertura con cuposMaximos < cuposBase, esa fila queda IMPOSIBLE DE EDITAR --cualquier update sobre ella falla-- hasta que alguien corrija los numeros. Si el conteo no da 0 y 0, se arreglan esas filas antes o se asume por escrito que quedan congeladas. Y el VALIDATE de los dos CHECK no va en esta migracion: va en guion de operacion, porque fallar alli cuesta un mensaje y fallar en migrate deploy cuesta el arranque.
--
-- ESTE FICHERO NO ESTA EN backend/prisma/migrations/ A PROPOSITO:
-- alli el arranque del contenedor lo ejecutaria solo. Se mueve a mano,
-- despues de revisarlo y de correr la verificacion previa.


-- G-01, G-02, G-03. Hacer VISIBLE el descuadre de aforo, sin
-- poner ni un CHECK que mate el sobrecupo autorizado (regla 2).
--
-- NO ENCONTRADO: ningun CHECK sobre "grupos_cobertura" en las 43
-- migraciones.
--
-- NOT VALID: no escanea las filas que ya estan, asi que esta
-- migracion NO PUEDE fallar por un dato viejo. Lo que NOT VALID
-- NO hace es eximir a las escrituras futuras: ver el analisis.
--
-- Estas dos acotan la CAPACIDAD (cuposBase, cuposMaximos,
-- schema.prisma:158-159), no la OCUPACION. No rozan el
-- sobrecupo: el sobrecupo es gente por encima de cuposMaximos, y
-- cuposMaximos es lo que estas ordenan respecto de cuposBase. De
-- hecho `cuposMaximos = cuposBase + 30%` ES el sobrecupo ya
-- presupuestado (scripts/extraer-catalogo.py:14, SOBRECUPO=0.30).
ALTER TABLE "grupos_cobertura"
  ADD CONSTRAINT "grupos_cobertura_base_no_negativa"
    CHECK ("cuposBase" >= 0) NOT VALID,
  ADD CONSTRAINT "grupos_cobertura_techo_sobre_base"
    CHECK ("cuposMaximos" >= "cuposBase") NOT VALID;

-- El invariante que la prueba de carga ya comprueba
-- (backend/prisma/prueba-carga.ts:136-144) pero que nadie mira
-- en produccion. Cancelar pone cuposConfirmados a 0
-- (reservas.service.ts:242), asi que no hace falta filtrar por
-- estado.
--
-- Con esta vista, el cargue masivo de plantillas.service.ts:400-405
-- --que escribe cuposSolicitados en un `for` sin candado y sin
-- mover el contador-- deja de ser invisible.
CREATE OR REPLACE VIEW "v_descuadre_de_cupos" AS
SELECT o."id"                                          AS "ofertaId",
       o."cuposMaximos",
       o."cuposOcupados",
       COALESCE(SUM(r."cuposConfirmados"), 0)::int     AS "sumaConfirmados",
       o."cuposOcupados"
         - COALESCE(SUM(r."cuposConfirmados"), 0)::int AS "descuadre"
  FROM "ofertas" o
  LEFT JOIN "reservas" r ON r."ofertaId" = o."id"
 GROUP BY o."id"
HAVING o."cuposOcupados" <> COALESCE(SUM(r."cuposConfirmados"), 0);

-- El otro aforo: sillas ocupadas contra el techo de la
-- cobertura. Separa el sobrecupo FIRMADO del accidental, que es
-- la distincion que el CHECK participantes_sobrecupo_justificado
-- no puede hacer.
--
-- ES UNA VISTA Y NO UN CHECK, Y ES DELIBERADO. Un
-- `CHECK sillas <= cuposMaximos` mataria el sobrecupo
-- autorizado, que esta modelado con sobrecupoPorId +
-- sobrecupoMotivo y su CHECK de coherencia
-- (20260814140000_crm_personas_y_participantes/migration.sql:222-225).
-- El refutador de Fase 1 ya retiro esa remediacion una vez. Aqui
-- el sobrecupo no se prohibe: se cuenta, y se dice cuanto de el
-- lleva firma.
--
-- OJO: la lista de etapas es una COPIA de
-- backend/src/crm/etapas.ts:30-34 (OCUPAN_SILLA), y ese fichero
-- existe porque la lista estaba escrita cuatro veces y se
-- corrigio en tres. Esta es la quinta. Va con un spec que
-- compare las dos.
CREATE OR REPLACE VIEW "v_sobrecupo_de_cobertura" AS
SELECT gc."id"                     AS "coberturaId",
       gc."cuposMaximos",
       count(p."id")::int          AS "sillasOcupadas",
       count(p."id") FILTER (WHERE p."sobrecupoPorId" IS NOT NULL)::int
                                   AS "conAutorizacion",
       count(p."id")::int - gc."cuposMaximos"
                                   AS "porEncimaDelTecho"
  FROM "grupos_cobertura" gc
  LEFT JOIN "participantes" p
         ON p."coberturaId" = gc."id"
        AND p."etapa" IN ('INSCRITO', 'EN_FORMACION', 'CERTIFICADO')
 GROUP BY gc."id"
HAVING count(p."id") > gc."cuposMaximos";

-- ======================================================================
-- VERIFICACION PREVIA
-- ======================================================================
-- -- LA CONSULTA QUE DECIDE. Cuenta las filas que YA violan lo que
-- -- se va a exigir. NOT VALID hace que la migracion aplique igual,
-- -- pero esas filas quedan IMPOSIBLES DE ACTUALIZAR despues.
-- SELECT count(*) FILTER (WHERE "cuposBase" < 0)                 AS "base negativa",
--        count(*) FILTER (WHERE "cuposMaximos" < "cuposBase")     AS "techo bajo la base",
--        count(*)                                                AS "coberturas"
--   FROM "grupos_cobertura";
-- -- Esperado: 0 y 0. Si alguno NO es 0, se listan y se arreglan
-- -- ANTES, o se asume que esas coberturas no se podran editar:
-- SELECT "id", "cuposBase", "cuposMaximos" FROM "grupos_cobertura"
--  WHERE "cuposBase" < 0 OR "cuposMaximos" < "cuposBase";
-- 
-- -- Y los nombres libres. CORREGIDO: la version anterior preguntaba
-- -- por `conname LIKE 'grupos_cobertura_%'`, que SIEMPRE da FALSE
-- -- porque ya existen grupos_cobertura_pkey y las dos FK
-- -- (modelo_inicial/migration.sql:103, :335, :338).
-- SELECT NOT EXISTS (SELECT 1 FROM pg_constraint
--                     WHERE conname IN ('grupos_cobertura_base_no_negativa',
--                                       'grupos_cobertura_techo_sobre_base'))
--          AS "nombres de restriccion libres",
--        to_regclass('public.v_descuadre_de_cupos')     IS NULL AS "vista 1 libre",
--        to_regclass('public.v_sobrecupo_de_cobertura') IS NULL AS "vista 2 libre";
-- -- Esperado: TRUE, TRUE, TRUE
-- 
-- -- Y fuera de SQL, tomado del juego B: el escritor sigue siendo
-- -- UNO SOLO, que es lo que sostiene que el NOT VALID no salte en
-- -- una ruta de admin.
-- --   grep -rn "grupoCobertura\.\(update\|updateMany\|upsert\|create\)" backend/src --include=*.ts | grep -v spec
-- -- Tiene que dar UNA linea (cronograma.service.ts:244). Si sale
-- -- una segunda, hay que mirarla antes de desplegar.

-- ======================================================================
-- VERIFICACION POSTERIOR
-- ======================================================================
-- -- 1. Las dos restricciones, presentes y NO validadas (es lo
-- --    correcto: se validan a mano en guion de operacion).
-- SELECT conname, convalidated FROM pg_constraint
--  WHERE conname IN ('grupos_cobertura_base_no_negativa','grupos_cobertura_techo_sobre_base')
--  ORDER BY 1;
-- -- Esperado: 2 filas, convalidated = FALSE en las dos.
-- 
-- -- 2. Las dos vistas responden.
-- SELECT count(*) AS "ofertas descuadradas" FROM "v_descuadre_de_cupos";
-- SELECT count(*) AS "coberturas por encima del techo" FROM "v_sobrecupo_de_cobertura";
-- -- Informativo la primera vez: este es el numero que hoy nadie
-- -- conoce. NO es criterio de reversion: la vista no causo el
-- -- descuadre, lo destapo.
-- 
-- -- 3. INVARIANTE que si es criterio: el descuadre no puede CRECER
-- --    por haber aplicado esto. Se guarda el numero de (2) y se
-- --    vuelve a mirar a las 24 horas.
-- SELECT "ofertaId", "cuposOcupados", "sumaConfirmados", "descuadre"
--   FROM "v_descuadre_de_cupos" ORDER BY abs("descuadre") DESC LIMIT 20;
-- 
-- -- 4. INVARIANTE del sobrecupo, que es el que la regla 2 protege:
-- --    de lo que esta por encima del techo, cuanto lleva firma.
-- SELECT sum("porEncimaDelTecho") AS "sillas de mas",
--        sum("conAutorizacion")   AS "con firma"
--   FROM "v_sobrecupo_de_cobertura";
-- -- Informativo, y es la cifra que hay que llevar a la conversacion
-- -- con el SENA. Ninguna de las dos se corrige desde aqui.
-- 
-- -- Criterio: si (1) no da 2 filas con convalidated FALSE, SE REVIERTE.
-- -- Los numeros de (2), (3) y (4) NO son criterio de reversion: son
-- -- el hallazgo.

-- ======================================================================
-- ROLLBACK
-- ======================================================================
-- DROP VIEW IF EXISTS "v_sobrecupo_de_cobertura";
-- DROP VIEW IF EXISTS "v_descuadre_de_cupos";
-- ALTER TABLE "grupos_cobertura" DROP CONSTRAINT IF EXISTS "grupos_cobertura_techo_sobre_base";
-- ALTER TABLE "grupos_cobertura" DROP CONSTRAINT IF EXISTS "grupos_cobertura_base_no_negativa";
-- DELETE FROM "_prisma_migrations"
--  WHERE "migration_name" = '20260831120000_topes_de_cobertura_y_vistas_de_descuadre';
