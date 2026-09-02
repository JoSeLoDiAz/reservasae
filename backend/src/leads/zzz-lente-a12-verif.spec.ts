import { codigoQuePidio, accionQuePidio } from './accion-que-pidio';

const CASOS = [
  'AF1', 'af1', 'AF 1', 'af 1', 'AF01', 'Curso AF07',
  'af1 - los nuevos metodos', 'Me interesa el AF3 de la tarde',
  'AF-1', 'AF_1', 'A F 1', 'af1x', 'af123', 'AF0', 'AF7', 'AF8',
  'GESTIÓN DE LA ATENCIÓN Y NEUROEDUCACIÓN EN LA ERA DIGITAL',
  'af.1', 'AF:1', 'AF#1', '(AF1)', 'AF1.', 'curso af 07 - algo', 'AF10', 'AF15', 'AF99',
];

it('imprime que resuelve', () => {
  for (const c of CASOS) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(c), '=>', JSON.stringify(codigoQuePidio(c)));
  }
  const cat = [
    { id: 'a1', codigo: 'AF1', visible: true },
    { id: 'a8', codigo: 'AF8', visible: false },
  ];
  console.log('AF1 visible:', accionQuePidio('AF1', cat));
  console.log('AF8 no visible:', accionQuePidio('AF8', cat));
  console.log('AF9 inexistente:', accionQuePidio('AF9', cat));
  expect(true).toBe(true);
});
