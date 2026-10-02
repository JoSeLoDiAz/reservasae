import { PrismaClient } from './generated/prisma';
import { faltaDeLaPersona, faltaDeLaEmpresa } from './src/crm/completitud';
const prisma = new PrismaClient();
async function main() {
  const ps = await prisma.participante.findMany({
    include: { persona: true, empresa: true, reserva: { include: { empresa: true } } },
  });
  const uno: any[] = [];
  for (const p of ps) {
    const suEmpresa = p.empresa ?? p.reserva?.empresa ?? null;
    const fp = faltaDeLaPersona({ persona: p.persona as any, nivelOcupacionalSepId: p.nivelOcupacionalSepId });
    const fe = faltaDeLaEmpresa(suEmpresa as any, p.persona.numeroDocumento);
    if (fp.length + fe.length === 1) uno.push({ etapa: p.etapa, origen: p.origen, fp, fe, tieneEmpresaId: !!p.empresaId, tieneReserva: !!p.reservaId, doc: p.persona.numeroDocumento });
  }
  const g = new Map<string, number>();
  for (const u of uno) { const k = JSON.stringify([...u.fp, ...u.fe]); g.set(k, (g.get(k)??0)+1); }
  console.log('con exactamente 1 falta:', uno.length);
  console.log([...g.entries()].sort((a,b)=>b[1]-a[1]));
  console.log('\nde los «los datos de su organización»: etapas/origenes');
  const sub = uno.filter(u=>u.fe.includes('los datos de su organización'));
  const g2 = new Map<string,number>();
  for (const u of sub) { const k = u.etapa+' / '+u.origen+' / reserva:'+u.tieneReserva; g2.set(k,(g2.get(k)??0)+1); }
  console.log([...g2.entries()].sort((a,b)=>b[1]-a[1]));
  console.log('ejemplo docs:', sub.slice(0,5).map(u=>u.doc));
  // independientes reales
  const ind = ps.filter(p => { const e = p.empresa ?? p.reserva?.empresa; return e && e.nit === p.persona.numeroDocumento; });
  console.log('\nparticipantes independientes (nit==documento):', ind.length);
  // empresas sin sector
  const emp = await prisma.empresa.count();
  const empSinSector = await prisma.empresa.count({ where: { OR: [{sectorEconomico:null},{sectorEconomico:''}] } });
  const empSinContacto = await prisma.empresa.count({ where: { OR: [{contactoNombre:null},{contactoCargo:null},{contactoCorreo:null}] } });
  console.log('empresas:', emp, 'sin sector:', empSinSector, 'sin algun contacto:', empSinContacto);
}
main().finally(()=>prisma.$disconnect());
