import { PrismaClient } from './generated/prisma';
import { faltaDeLaPersona, faltaDeLaEmpresa } from './src/crm/completitud';

const prisma = new PrismaClient();

async function main() {
  const ps = await prisma.participante.findMany({
    include: {
      persona: true,
      empresa: true,
      reserva: { include: { empresa: true } },
    },
  });
  console.log('participantes:', ps.length);
  const cuenta = new Map<string, number>();
  const porTotal = new Map<number, number>();
  const ejemplos: any[] = [];
  let soloEmpresa = 0;
  let empresaDeReserva = 0;
  for (const p of ps) {
    const suEmpresa = p.empresa ?? p.reserva?.empresa ?? null;
    const fp = faltaDeLaPersona({ persona: p.persona as any, nivelOcupacionalSepId: p.nivelOcupacionalSepId });
    const fe = faltaDeLaEmpresa(suEmpresa as any, p.persona.numeroDocumento);
    const n = fp.length + fe.length;
    porTotal.set(n, (porTotal.get(n) ?? 0) + 1);
    for (const k of fp) cuenta.set('persona:' + k, (cuenta.get('persona:' + k) ?? 0) + 1);
    for (const k of fe) cuenta.set('empresa:' + k, (cuenta.get('empresa:' + k) ?? 0) + 1);
    if (n > 0 && fp.length === 0) {
      soloEmpresa++;
      if (!p.empresaId && p.reserva?.empresa) empresaDeReserva++;
      if (ejemplos.length < 12) ejemplos.push({ doc: p.persona.numeroDocumento, nombre: p.persona.primerNombre + ' ' + p.persona.primerApellido, n, fe, empresaPropia: !!p.empresaId, nitEmpresa: suEmpresa?.nit, empresaNombre: (suEmpresa as any)?.razonSocial ?? (suEmpresa as any)?.nombre });
    }
  }
  console.log('\n-- distribucion de cuantos faltan --');
  console.log([...porTotal.entries()].sort((a,b)=>a[0]-b[0]));
  console.log('\n-- campos que marcan falta --');
  console.log([...cuenta.entries()].sort((a,b)=>b[1]-a[1]));
  console.log('\nfichas con persona COMPLETA pero marcadas PARCIAL por la empresa:', soloEmpresa, '(de las cuales la empresa viene de la reserva:', empresaDeReserva, ')');
  console.log(JSON.stringify(ejemplos, null, 1));

  // celulares y correos que el validador rechaza pero tienen algo escrito
  const malCel = ps.filter(p => p.persona.celular && faltaDeLaPersona({persona: p.persona as any, nivelOcupacionalSepId: 1}).includes('un celular que sea un número'));
  console.log('\ncelulares con contenido rechazado:', malCel.length, malCel.slice(0,25).map(p=>p.persona.celular));
  const malCor = ps.filter(p => p.persona.correo && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test((p.persona.correo||'').trim().toLowerCase()));
  console.log('correos con contenido rechazado:', malCor.length, malCor.slice(0,25).map(p=>p.persona.correo));

  // independientes: nit == documento pero con formato distinto
  const casi = ps.filter(p => {
    const e = p.empresa ?? p.reserva?.empresa ?? null;
    if (!e) return false;
    const a = (e.nit||'').replace(/\D/g,'');
    const b = (p.persona.numeroDocumento||'').replace(/\D/g,'');
    return a !== e.nit?.trim() || (a === b && e.nit !== p.persona.numeroDocumento);
  });
  console.log('\nempresas cuyo NIT normalizado == documento pero no coincide literal:', casi.length, casi.slice(0,10).map(p=>({nit:(p.empresa??p.reserva?.empresa)!.nit, doc:p.persona.numeroDocumento})));
}
main().finally(()=>prisma.$disconnect());
