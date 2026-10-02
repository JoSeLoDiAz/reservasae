import { PrismaClient } from './generated/prisma';
import { faltaDeLaPersona, faltaDeLaEmpresa } from './src/crm/completitud';
const prisma = new PrismaClient();
function estadoDeEmpresa(e: any) {
  if (!e) return 'SIN';
  const n = [e.direccion, e.telefono, e.sectorEconomico, e.clasificacion].filter(v => v !== null && v !== '').length;
  return n === 4 ? 'COMPLETA' : 'PARCIAL';
}
async function main() {
  const ps = await prisma.participante.findMany({ include: { persona: true, empresa: true, reserva: { include: { empresa: true } } } });
  let contradice = 0, listaVsFicha = 0, colEmpVsPend = 0;
  const ej: any[] = [];
  for (const p of ps) {
    const suE = p.empresa ?? p.reserva?.empresa ?? null;
    const feLista = faltaDeLaEmpresa(suE as any, p.persona.numeroDocumento);
    const feFicha = faltaDeLaEmpresa(p.empresa as any, p.persona.numeroDocumento);
    if (JSON.stringify(feLista) !== JSON.stringify(feFicha)) {
      listaVsFicha++;
      if (ej.length < 3) ej.push({ doc: p.persona.numeroDocumento, lista: feLista, ficha: feFicha });
    }
    const col = estadoDeEmpresa(p.empresa);
    if (col === 'COMPLETA' && feLista.length > 0) colEmpVsPend++;
    if (col === 'SIN' && feLista.length > 0 && !!p.reserva?.empresa) contradice++;
  }
  console.log('filas donde lista y ficha discrepan en faltaDeLaEmpresa:', listaVsFicha, JSON.stringify(ej));
  console.log('filas con columna «Datos de la empresa»=COMPLETA y pendientes de empresa>0:', colEmpVsPend);
  console.log('filas con columna=SIN pero los pendientes cuentan la empresa de la reserva:', contradice);
}
main().finally(()=>prisma.$disconnect());
