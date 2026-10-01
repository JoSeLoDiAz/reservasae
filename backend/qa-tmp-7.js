const u=process.env.DATABASE_URL||''; if(!/prueba/i.test(u)){console.error('ABORTO');process.exit(1);}
const {PrismaClient}=require('./generated/prisma'); const p=new PrismaClient();
(async()=>{
  console.log(JSON.stringify(await p.categoriaDeNota.findMany({select:{id:true,nombre:true,ocultaEn:true}})));
  console.log('notas QA:', await p.notaDeGestion.count({where:{texto:{startsWith:'QA-PRUEBA'}}}));
  if (process.argv[2]==='restaurar') {
    const r = await p.categoriaDeNota.updateMany({ where:{ ocultaEn:{not:null} }, data:{ ocultaEn:null } });
    const n = await p.notaDeGestion.deleteMany({ where:{ texto:{startsWith:'QA-PRUEBA'} } });
    console.log('desocultadas:', r.count, 'notas borradas:', n.count);
  }
})().catch(e=>{console.error(e);process.exit(1)}).finally(()=>p.$disconnect());
