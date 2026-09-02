import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { EntraLeadDto } from './dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});
const meta: ArgumentMetadata = { type: 'body', metatype: EntraLeadDto };

const casos: unknown[] = ['false', 'true', 'no', '0', 0, 1, false, true, '', null];

describe('aceptaHabeasData por el pipe real', () => {
  for (const v of casos) {
    it(`${JSON.stringify(v)}`, async () => {
      try {
        const r: any = await pipe.transform(
          { convenio: 'adecopria', numeroDocumento: '123', aceptaHabeasData: v },
          meta,
        );
        // eslint-disable-next-line no-console
        console.log('ENTRA', JSON.stringify(v), '->', JSON.stringify(r.aceptaHabeasData), typeof r.aceptaHabeasData);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.log('RECHAZA', JSON.stringify(v), '->', JSON.stringify(e.response?.message ?? e.message));
      }
    });
  }
});
