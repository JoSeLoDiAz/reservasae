/** Cada gremio firma con su nombre, y nadie se lo salta. */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(async (m: unknown) => {
      enviados.push(m as { from: string });
      return { messageId: 'x' };
    }),
    close: jest.fn(),
  })),
}));

const enviados: Array<{ from: string }> = [];

import { CorreoService } from './correo.service';
import { limpiarNombre, quienFirma } from './quien-firma';

const ADECOPRIA = { sigla: 'ADECOPRIA', nombre: 'ASOCIACION DE EDUCACION PRIVADA' };
const BRITCHAM = { sigla: 'BRITCHAM ADEE', nombre: 'UNION TEMPORAL BRITCHAM ADEE' };

describe('con qué nombre firma cada gremio', () => {
  const antes = { ...process.env };
  afterEach(() => {
    process.env = { ...antes };
  });

  it('firma con la sigla del gremio, que es lo que la persona reconoce', () => {
    expect(quienFirma(ADECOPRIA)).toBe('ADECOPRIA');
    expect(quienFirma(BRITCHAM)).toBe('BRITCHAM ADEE');
  });

  it('los dos gremios NO firman igual', () => {
    expect(quienFirma(ADECOPRIA)).not.toBe(quienFirma(BRITCHAM));
  });

  it('sin sigla cae al nombre, que es peor pero es suyo', () => {
    process.env.SMTP_NOMBRE = 'Convoca CRM';
    expect(quienFirma({ sigla: null, nombre: 'FUNDACION EJEMPLO' })).toBe(
      'FUNDACION EJEMPLO',
    );
    expect(quienFirma({ sigla: '   ', nombre: 'FUNDACION EJEMPLO' })).toBe(
      'FUNDACION EJEMPLO',
    );
  });

  it('sin gremio —la puerta general— firma el nombre del .env', () => {
    process.env.SMTP_NOMBRE = 'Convoca CRM';
    expect(quienFirma(null)).toBe('Convoca CRM');
    expect(quienFirma(undefined)).toBe('Convoca CRM');
  });

  it('sin SMTP_NOMBRE queda el del producto, nunca vacío', () => {
    delete process.env.SMTP_NOMBRE;
    expect(quienFirma(null)).toBe('Convoca CRM');
    process.env.SMTP_NOMBRE = '   ';
    expect(quienFirma(null)).toBe('Convoca CRM');
  });

  /// La sigla la teclea un admin y acaba en una cabecera.
  it('un salto de linea en la sigla no mete otra cabecera', () => {
    const malo = { sigla: 'ADECOPRIA\r\nBcc: fuga@ajeno.test', nombre: 'X' };
    const firma = quienFirma(malo);
    expect(firma).not.toMatch(/[\r\n]/);
    expect(firma).toBe('ADECOPRIA Bcc: fuga@ajeno.test');
  });

  /// Se comio la `r` de «Proyectos» en pruebas: la clase
  /// llevaba una `r` literal.
  it('un nombre corriente sale entero, letra por letra', () => {
    for (const n of [
      'Convoca CRM - Proyectos SENA (PRUEBAS)',
      'ADECOPRIA',
      'BRITCHAM ADEE',
      'Direccion Academica',
    ]) {
      expect(limpiarNombre(n)).toBe(n);
      expect(quienFirma({ sigla: n, nombre: 'X' })).toBe(n);
    }
  });

  it('una comilla no rompe el nombre entre comillas', () => {
    const raro = quienFirma({ sigla: 'A"B\\C', nombre: 'X' });
    expect(raro).toBe('A B C');
    expect(limpiarNombre('a\u0000b')).toBe('a b');
  });
});

describe('el nombre llega de verdad a la cabecera', () => {
  const antes = { ...process.env };

  beforeEach(() => {
    enviados.length = 0;
    process.env.SMTP_SERVIDOR = 'smtp.ejemplo.test';
    process.env.SMTP_USUARIO = 'proyectosena@grupo-ae.com.co';
    process.env.SMTP_CLAVE = 'clave-de-aplicacion';
    process.env.SMTP_NOMBRE = 'Convoca CRM';
    delete process.env.SMTP_DESDE;
    delete process.env.CORREO_REDIRIGIR_A;
    delete process.env.ENTORNO;
  });
  afterEach(() => {
    process.env = { ...antes };
  });

  const mandar = (deParte?: string) =>
    new CorreoService().enviar({
      deParte,
      para: 'alguien@ejemplo.test',
      asunto: 'hola',
      texto: 'hola',
    });

  it('el buzón NO cambia: es el que tiene la verificación', async () => {
    await mandar('ADECOPRIA');
    await mandar('BRITCHAM ADEE');
    for (const m of enviados) {
      expect(m.from).toContain('<proyectosena@grupo-ae.com.co>');
    }
  });

  it('lo que cambia es el nombre que se lee', async () => {
    await mandar('ADECOPRIA');
    expect(enviados[0].from).toBe(
      '"ADECOPRIA" <proyectosena@grupo-ae.com.co>',
    );
  });

  it('sin gremio sale el nombre general', async () => {
    await mandar(undefined);
    expect(enviados[0].from).toBe(
      '"Convoca CRM" <proyectosena@grupo-ae.com.co>',
    );
  });
});

/// La superficie: un emisor nuevo que se olvide firma mal, y
/// nada falla. Es lo que se olvida al añadir el siguiente.
describe('todo el que manda correo dice con qué nombre firma', () => {
  function fuentes(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return fuentes(p);
      return n.endsWith('.ts') && !n.endsWith('.spec.ts') ? [p] : [];
    });
  }

  /** El literal que abre en `desde`, con los paréntesis casados. */
  function objeto(texto: string, desde: number): string {
    let hondo = 0;
    for (let i = desde; i < texto.length; i++) {
      const c = texto[i];
      if (c === '{' || c === '(') hondo++;
      else if (c === '}' || c === ')') {
        hondo--;
        if (hondo === 0) return texto.slice(desde, i + 1);
      }
    }
    throw new Error('literal sin cerrar');
  }

  const llamadas: Array<{ archivo: string; cuerpo: string }> = [];
  for (const archivo of fuentes(join(__dirname, '..'))) {
    const texto = readFileSync(archivo, 'utf8');
    const patron = /correo\.enviar\(\{/g;
    let m: RegExpExecArray | null;
    while ((m = patron.exec(texto))) {
      llamadas.push({
        archivo,
        cuerpo: objeto(texto, m.index + 'correo.enviar('.length),
      });
    }
  }

  it('hay emisores que revisar', () => {
    expect(llamadas.length).toBeGreaterThanOrEqual(4);
  });

  it.each(llamadas.map((l) => [l.archivo, l.cuerpo]))(
    '%s firma explícitamente',
    (_archivo, cuerpo) => {
      expect(cuerpo).toContain('deParte');
    },
  );
});
