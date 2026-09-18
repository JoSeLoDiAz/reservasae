/** El `CASE` de la procedencia y el de «pagada», EJECUTADOS. */

/// Los demás specs de este directorio miran los PARÁMETROS del
/// SQL o le pasan a `canalDeLaVisita` una procedencia escrita a
/// mano, así que un cambio de ORDEN en el `CASE` --que es el
/// diseño entero, ver `procedenciaSql`-- no los tumba. José lo
/// probó: moviendo WhatsApp Web detrás de OTRA_WEB todo seguía en
/// verde. Aquí el `CASE` se ejecuta de verdad, en un Postgres en
/// memoria (`pg-mem`), sobre filas como las que escribe la baliza.

import { newDb } from 'pg-mem';

import { Prisma } from '../../generated/prisma';
import { canalDeLaVisita, origenDeLaVisita } from './origen-de-la-visita';
import { pagadaSql, procedenciaSql } from './procedencia';

type Visita = {
  utmFuente?: string;
  utmCampana?: string;
  referente?: string;
  navegador?: string;
  huboFbclid?: boolean;
};

/// Los parámetros van EN LÍNEA: pg-mem no los acepta sueltos, y
/// aquí todos salen de nuestro código, no de un cliente.
function enLinea(sql: Prisma.Sql): string {
  return sql.text.replace(/\$(\d+)/g, (_, i: string) => {
    const v = sql.values[Number(i) - 1];
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

function evaluar(v: Visita) {
  const db = newDb();
  db.public.none(
    `CREATE TABLE "pasos_de_visita" ("utmFuente" text, "utmCampana" text,
       "referente" text, "navegador" text, "huboFbclid" boolean)`,
  );
  const lit = (x?: string) => (x === undefined ? 'NULL' : `'${x}'`);
  db.public.none(
    `INSERT INTO "pasos_de_visita" VALUES (${lit(v.utmFuente)}, ${lit(v.utmCampana)},
       ${lit(v.referente)}, ${lit(v.navegador)}, ${v.huboFbclid ? 'TRUE' : 'NULL'})`,
  );
  const [fila] = db.public.many(
    `SELECT ${enLinea(procedenciaSql())} AS procedencia,
            ${enLinea(pagadaSql())} AS pagada
       FROM "pasos_de_visita"`,
  ) as Array<{ procedencia: string; pagada: boolean }>;
  return fila;
}

describe('el CASE, ejecutado', () => {
  /// EL CASO DE JOSÉ: un mailing abierto dentro de Instagram salía
  /// pauta pagada.
  it('?mailing… abierto en la app de Instagram NO es pauta', () => {
    const f = evaluar({
      utmFuente: 'correo',
      utmCampana: 'mailing18092026',
      navegador: 'APP_INSTAGRAM',
    });
    expect(f).toEqual({ procedencia: 'INSTAGRAM', pagada: false });
    expect(origenDeLaVisita(f)).toBeNull();
  });

  it('ni ?reserva… en la de Facebook, ni WhatsApp, ni un QR', () => {
    for (const [utmFuente, utmCampana] of [
      ['reserva', 'reserva-transportes-el-condor'],
      ['whatsapp', 'whatsapp0305'],
      ['qr', 'qr-feria'],
    ]) {
      const f = evaluar({ utmFuente, utmCampana, navegador: 'APP_FACEBOOK' });
      expect({ utmFuente, pagada: f.pagada }).toEqual({ utmFuente, pagada: false });
      expect(origenDeLaVisita(f)).toBeNull();
    }
  });

  /// Lo nuestro sigue sin probar pago aunque venga con `fbclid`:
  /// Meta lo cuelga también a los enlaces de publicaciones.
  it('un enlace nuestro con fbclid tampoco es pauta', () => {
    expect(evaluar({ utmFuente: 'correo', utmCampana: 'mailing1', huboFbclid: true }).pagada).toBe(
      false,
    );
  });

  it('la campaña de Ads Manager SÍ es pauta', () => {
    const f = evaluar({ utmFuente: 'facebook', utmCampana: 'Pauta 0305202255' });
    expect(f).toEqual({ procedencia: 'FACEBOOK', pagada: true });
    expect(origenDeLaVisita(f)).toBe('FACEBOOK');
  });

  it('el fbclid a secas también, como hasta ahora', () => {
    expect(evaluar({ huboFbclid: true })).toEqual({ procedencia: 'META', pagada: true });
  });

  it('un mailing fuera de Meta sella el canal CORREO', () => {
    const f = evaluar({ utmFuente: 'correo', utmCampana: 'mailing18092026' });
    expect(f).toEqual({ procedencia: 'CORREO', pagada: false });
    expect(canalDeLaVisita(f)).toBe('CORREO');
  });

  /// El que José movió detrás de OTRA_WEB sin que nada fallara.
  it('WhatsApp Web es WHATSAPP, no «otra página web»', () => {
    expect(evaluar({ referente: 'web.whatsapp.com' }).procedencia).toBe('WHATSAPP');
    expect(evaluar({ referente: 'wa.me' }).procedencia).toBe('WHATSAPP');
  });

  it('y un sitio cualquiera sí es otra página web', () => {
    expect(evaluar({ referente: 'noticias.example.com' }).procedencia).toBe('OTRA_WEB');
    expect(evaluar({ referente: 'nowhatsapp.com' }).procedencia).toBe('OTRA_WEB');
  });

  /// `?pauta…` del panel: el nombre sí, el pago solo con prueba.
  it('?pauta… sin fbclid ni app NO es pagada, aunque diga Meta', () => {
    const f = evaluar({ utmFuente: 'pauta', utmCampana: 'pauta0305202255' });
    expect(f).toEqual({ procedencia: 'META', pagada: false });
    expect(origenDeLaVisita(f)).toBeNull();
  });

  it('?pauta… con fbclid, o dentro de la app, SÍ', () => {
    expect(evaluar({ utmFuente: 'pauta', utmCampana: 'pauta1', huboFbclid: true })).toEqual({
      procedencia: 'META',
      pagada: true,
    });
    const app = evaluar({ utmFuente: 'pauta', utmCampana: 'pauta1', navegador: 'APP_INSTAGRAM' });
    expect(app).toEqual({ procedencia: 'INSTAGRAM', pagada: true });
    expect(origenDeLaVisita(app)).toBe('INSTAGRAM');
  });

  it('sin ninguna señal, no dejó rastro', () => {
    expect(evaluar({})).toEqual({ procedencia: 'SIN_REFERENCIA', pagada: false });
  });
});
