import { llaveDelLead } from './llave-del-lead';
import { codigoQuePidio, accionQuePidio } from './accion-que-pidio';
import { ubicacionQueDijo } from './ubicacion-que-dijo';
import { generoQueDijo } from './genero-que-dijo';

it('curso sin codigo AF -> null y llave sin-af', () => {
  expect(codigoQuePidio('Neuroeducación para docentes')).toBeNull();
  expect(codigoQuePidio('Agentes autónomos con IA')).toBeNull();
  const base = { tipoDocumentoSepId: 1, numeroDocumento: '1020304050' };
  const a = llaveDelLead(base, codigoQuePidio('Neuroeducación para docentes'));
  const b = llaveDelLead(base, codigoQuePidio('Agentes autónomos con IA'));
  console.log('A =', a, ' B =', b);
  expect(a).toEqual(b);
});

it('con codigo AF sí se separan', () => {
  const base = { tipoDocumentoSepId: 1, numeroDocumento: '1020304050' };
  console.log('AF1 =', llaveDelLead(base, 'AF1'), 'AF2 =', llaveDelLead(base, 'AF2'));
  expect(llaveDelLead(base, 'AF1')).not.toEqual(llaveDelLead(base, 'AF2'));
});

it('ubicacion / genero raros', () => {
  const u = ubicacionQueDijo('Antioquía', 'Medallo');
  console.log('ubicacion:', JSON.stringify(u));
  console.log('genero raro:', generoQueDijo('No binario'), generoQueDijo('Otro'), generoQueDijo('Prefiero no decir'), generoQueDijo('M'), generoQueDijo('Masculino'));
});
