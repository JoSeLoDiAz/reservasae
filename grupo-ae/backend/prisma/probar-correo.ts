/** Prueba el correo saliente. */

/// Dos pasos, y en este orden a propósito:
///
///   1. `verify`: saluda al servidor y se autentica, sin
///      mandarle nada a nadie. Si la clave no sirve, se sabe
///      aquí y no molestando a alguien con un correo roto.
///   2. Manda uno de verdad, a donde se le diga.
///
///   pnpm db:probar-correo                 (solo comprueba la clave)
///   pnpm db:probar-correo alguien@ahi.com (ademas manda uno)

import { CorreoService, correoConectado } from '../src/correo/correo.service';

const PARA = process.argv[2];

async function main() {
  console.log('\n=== CORREO SALIENTE ===\n');

  console.log(`  servidor : ${process.env.SMTP_SERVIDOR ?? '(sin poner)'}`);
  console.log(`  puerto   : ${process.env.SMTP_PUERTO ?? '587 (por defecto)'}`);
  console.log(`  usuario  : ${process.env.SMTP_USUARIO ?? '(sin poner)'}`);
  console.log(
    `  clave    : ${process.env.SMTP_CLAVE ? `puesta, ${process.env.SMTP_CLAVE.length} letras` : '(sin poner)'}\n`,
  );

  if (!correoConectado()) {
    console.log('  No está configurado. Faltan variables en backend/.env.\n');
    process.exit(1);
  }

  const correo = new CorreoService();

  console.log('1 · ¿el servidor acepta la cuenta?\n');
  const prueba = await correo.probar();

  if (prueba.estado !== 'ENVIADO') {
    console.log(`  NO.\n`);
    console.log(`  ${prueba.estado === 'FALLO' ? prueba.error : 'Apagado.'}\n`);
    correo.onModuleDestroy();
    process.exit(1);
  }

  console.log('  Sí: entró.\n');

  if (!PARA) {
    console.log('  Para mandar uno de verdad:');
    console.log('    pnpm db:probar-correo usted@sudominio.com\n');
    correo.onModuleDestroy();
    process.exit(0);
  }

  console.log(`2 · mandando uno a ${PARA}\n`);

  const r = await correo.enviar({
    para: PARA,
    asunto: 'Convoca · prueba de correo',
    texto:
      'Si está leyendo esto, el correo saliente de Convoca quedó funcionando.\n\n' +
      'Este mensaje lo generó `pnpm db:probar-correo`. No hay que contestarlo.\n',
    html:
      '<p>Si está leyendo esto, el correo saliente de <strong>Convoca</strong> ' +
      'quedó funcionando.</p><p style="color:#666;font-size:13px">Este mensaje lo ' +
      'generó <code>pnpm db:probar-correo</code>. No hay que contestarlo.</p>',
  });

  if (r.estado === 'ENVIADO') {
    console.log(`  Salió. id: ${r.id}\n`);
    console.log('  Revise la bandeja, y el spam si no aparece.\n');
  } else {
    console.log(`  NO salió: ${r.estado === 'FALLO' ? r.error : 'apagado'}\n`);
  }

  correo.onModuleDestroy();
  process.exit(r.estado === 'ENVIADO' ? 0 : 1);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
