import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { EntraLeadDto } from './dto';

/// Reproduce EXACTAMENTE las opciones de main.ts
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const meta = { type: 'body' as const, metatype: EntraLeadDto, data: '' };

const base = {
  convenio: 'adecopria',
  externoId: 'x-1',
  numeroDocumento: '1020304050',
  tipoDocumento: 'CC',
  nombres: 'Ana',
  primerApellido: 'Ruiz',
  origen: 'FACEBOOK',
};

describe('aceptaHabeasData: cadena vs booleano', () => {
  it('booleano false llega como false', async () => {
    const r: any = await pipe.transform({ ...base, aceptaHabeasData: false }, meta);
    console.log('BOOL false ->', r.aceptaHabeasData, typeof r.aceptaHabeasData);
    expect(r.aceptaHabeasData).toBe(false);
  });

  it('CADENA "false" -> que sale?', async () => {
    let r: any, err: any;
    try {
      r = await pipe.transform({ ...base, aceptaHabeasData: 'false' }, meta);
    } catch (e: any) {
      err = e;
    }
    console.log('CADENA "false" -> valor:', r?.aceptaHabeasData, 'tipo:', typeof r?.aceptaHabeasData, 'error:', err?.response?.message);
  });

  it('CADENA "no" y "0"', async () => {
    for (const v of ['no', '0', 'NO', '']) {
      let r: any, err: any;
      try {
        r = await pipe.transform({ ...base, aceptaHabeasData: v }, meta);
      } catch (e: any) { err = e; }
      console.log(`CADENA ${JSON.stringify(v)} ->`, r?.aceptaHabeasData, typeof r?.aceptaHabeasData, 'err:', err?.response?.message);
    }
  });

  it('plainToInstance a secas (sin las opciones de main.ts)', () => {
    const r = plainToInstance(EntraLeadDto, { ...base, aceptaHabeasData: 'false' });
    console.log('SIN implicit ->', (r as any).aceptaHabeasData, typeof (r as any).aceptaHabeasData);
  });
});
