/** Sonda: que hace el pipe con un lote. */
import { ValidationPipe } from '@nestjs/common';
import { EntraLoteDto } from './dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const meta = { type: 'body' as const, metatype: EntraLoteDto, data: '' };

async function pasa(body: unknown) {
  try {
    return { ok: true, v: await pipe.transform(body as never, meta) };
  } catch (e: unknown) {
    const r = e as { getStatus?: () => number; getResponse?: () => unknown };
    return { ok: false, status: r.getStatus?.(), res: JSON.stringify(r.getResponse?.()) };
  }
}

const buena = { numeroDocumento: '1020304050', nombres: 'Ana', primerApellido: 'Ruiz' };

it('sonda', async () => {
  console.log('ARRAY PELADO ->', JSON.stringify(await pasa([buena])));
  console.log('OBJETO OK    ->', JSON.stringify(await pasa({ leads: [buena] })).slice(0, 300));
  console.log('VACIO        ->', JSON.stringify(await pasa({ leads: [] })));
  console.log('501          ->', JSON.stringify(await pasa({ leads: Array(501).fill(buena) })).slice(0, 300));
  // una fila con campo desconocido, entre 3 buenas
  const conExtra = [buena, { ...buena, empresa: 'Vise' }, buena];
  console.log('CAMPO RARO   ->', JSON.stringify(await pasa({ leads: conExtra })).slice(0, 500));
  // una fila con origen fuera del enum
  const conEnum = [buena, { ...buena, origen: 'PAUTA_META' }, buena];
  console.log('ENUM MALO    ->', JSON.stringify(await pasa({ leads: conEnum })).slice(0, 500));
  // una fila con celular larguisimo
  const conLargo = [buena, { ...buena, celular: '3'.repeat(41) }, buena];
  console.log('LARGO        ->', JSON.stringify(await pasa({ leads: conLargo })).slice(0, 400));
  // tipos raros que la conversion implicita podria salvar
  console.log('NUMERO CEL   ->', JSON.stringify(await pasa({ leads: [{ ...buena, celular: 3001234567 }] })).slice(0, 300));
  console.log('HABEAS STR   ->', JSON.stringify(await pasa({ leads: [{ ...buena, aceptaHabeasData: 'true' }] })).slice(0, 300));
  console.log('CARGA META   ->', JSON.stringify(await pasa({ leads: [{ ...buena, carga: { a: 1 } }] })).slice(0, 300));
  expect(1).toBe(1);
});
