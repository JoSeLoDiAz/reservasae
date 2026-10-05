/** De una fila del Excel a los campos de un `LeadEntrante`. */

/**
 * TODO SE NORMALIZA AQUÍ, AL ENTRAR, y no al convertir.
 *
 * Es la misma decisión que lleva escrita `leads.service.limpiar()`
 * y que el propio `schema.prisma` explica en `accionFormacionId`:
 * guardar el texto crudo y limpiarlo después deja el mismo dato
 * escrito de dos formas en la misma columna y nadie las relaciona.
 * Con una base de leads de meses el efecto es inmediato: el archivo
 * trae «+57 300 111 2222» y la base ya tiene «3001112222» de esa
 * misma persona, y sin normalizar son dos leads que dos asesoras
 * llaman por separado.
 *
 * Y NADA DE ESTO TUMBA LA FILA. Un celular que no es un celular, un
 * departamento que no está en el catálogo, un tipo de documento mal
 * escrito: todo se apunta en `avisos` y la persona entra. La razón
 * la dejó escrita el webhook y vale igual aquí: perder una fila es
 * perder a alguien a quien llamar, y «no entró» es mucho peor que
 * «entró incompleta» ---para eso existe la mesa de entrada--.
 *
 * Los normalizadores se IMPORTAN, no se reescriben. Si aquí el
 * correo se pasara a minúsculas con un `toLowerCase()` propio y
 * allá con `normalizarCorreo`, el día que uno de los dos cambie el
 * cruce por correo dejaría de encontrar a nadie, y eso no se nota:
 * sale «todos nuevos», que es exactamente lo que uno espera ver en
 * un cargue.
 */

import { celularValido, normalizarCelular } from '../../comun/celular';
import { correoValido, normalizarCorreo } from '../../comun/correo';
import { normalizarDocumento } from '../../comun/documento';

import { accionQuePidio, type AccionDelCatalogo } from '../accion-que-pidio';
import { tipoDeDocumento } from '../tipo-de-documento';
import { ubicacionQueDijo } from '../ubicacion-que-dijo';

import type { FilaCruda } from './lector-del-cargue';

/// Los campos del lead que este cargue sabe llenar, con los
/// nombres que tienen en `LeadEntrante`. Son los que se comparan
/// contra lo guardado para repartir huecos y choques, así que el
/// nombre tiene que ser el de la columna y no un alias.
export type DatosDeLaFila = {
  nombreCompleto: string | null;
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  correo: string | null;
  celular: string | null;
  tipoDocumentoSepId: number | null;
  numeroDocumento: string | null;
  interes: string | null;
  accionFormacionId: string | null;
  departamentoSepId: number | null;
  municipioSepId: number | null;
};

export type FilaInterpretada = {
  fila: number;
  datos: DatosDeLaFila;
  /// El código de la acción, ya resuelto. Va en la LLAVE del lead,
  /// así que se devuelve aparte: la llave la forma el servicio y
  /// necesita el código, no el id.
  codigoDeLaAccion: string | null;
  /// La observación que traía la fila, si traía. No es un campo
  /// del lead: entra como nota de gestión.
  observacion: string | null;
  /// Lo que se mandó y no sirvió, dicho en castellano. La fila
  /// entra igual: esto se le enseña al cliente para que lo
  /// arregle en SU archivo, que es donde está el error.
  avisos: string[];
  /// Lo que trae la fila tal cual, para dejarlo en `carga`.
  crudo: Record<string, string>;
};

export function interpretarLaFila(
  cruda: FilaCruda,
  /// Las acciones DE ESE convenio y de ningún otro: `AF1` existe
  /// en ADECOPRIA y en BRITCHAM y no es el mismo curso.
  accionesDelConvenio: AccionDelCatalogo[],
): FilaInterpretada {
  const v = cruda.valores;
  const avisos: string[] = [];

  /// EL NOMBRE: las piezas mandan sobre la frase entera.
  ///
  /// Si el archivo trae una columna de apellidos, ya no hay que
  /// adivinar dónde acaba el nombre: lo de una columna son
  /// nombres y lo de la otra apellidos. Si solo trae la frase, se
  /// guarda la frase y NO se parte, por lo mismo que no la parte
  /// el webhook: «Ana María Ruiz Gómez» pueden ser dos nombres y
  /// dos apellidos, o uno y tres, y esas cuatro son columnas del
  /// reporte al SENA.
  const nombres = (v.nombre ?? '').trim().replace(/\s+/g, ' ');
  const apellidos = (v.apellido ?? '').trim().replace(/\s+/g, ' ');

  const piezas = apellidos ? partirConApellidos(nombres, apellidos) : null;
  const nombreCompleto =
    [nombres, apellidos].filter(Boolean).join(' ').trim() || null;

  /// EL CORREO: vacío si no es un correo, igual que en el webhook.
  ///
  /// Guardar «no tiene» o «pendiente» como correo es peor que no
  /// guardar nada: la compuerta de matrícula lo cuenta como «hay
  /// forma de contactarla» y viaja al reporte del SEP.
  const correoCrudo = (v.correo ?? '').trim();
  const correo = correoValido(correoCrudo)
    ? normalizarCorreo(correoCrudo) || null
    : null;
  if (correoCrudo && !correo) {
    avisos.push(
      `«${correoCrudo}» no tiene forma de correo, así que no se guardó`,
    );
  }

  /// EL CELULAR: diez dígitos empezando por 3, con o sin +57.
  const celularCrudo = (v.celular ?? '').trim();
  const celularLimpio = celularCrudo ? normalizarCelular(celularCrudo) : '';
  const celular =
    celularLimpio && celularValido(celularLimpio) ? celularLimpio : null;
  if (celularCrudo && !celular) {
    avisos.push(
      `«${celularCrudo}» no es un celular colombiano, así que no se guardó ` +
        '(un fijo no recibe mensajes, y es para eso que se pide)',
    );
  }

  /// EL DOCUMENTO: el tipo por su sigla y el número sin puntos.
  ///
  /// El número se normaliza SIEMPRE, aunque el tipo no se
  /// reconozca: «1.020.304.050» y «1020304050» son la misma
  /// cédula, y sin normalizar el cruce contra lo que ya está en
  /// la base no encuentra nada y la persona entra dos veces.
  const numeroCrudo = (v.numeroDocumento ?? '').trim();
  const numeroDocumento = numeroCrudo ? normalizarDocumento(numeroCrudo) : null;
  if (numeroCrudo && !numeroDocumento) {
    avisos.push(
      `«${numeroCrudo}» no tiene forma de documento (entre 4 y 20 letras o ` +
        'números), así que no se guardó',
    );
  }

  const tipoCrudo = (v.tipoDocumento ?? '').trim();
  const tipoDocumentoSepId = tipoCrudo ? tipoDeDocumento(tipoCrudo) : null;
  if (tipoCrudo && tipoDocumentoSepId === null) {
    avisos.push(
      `«${tipoCrudo}» no es un tipo de documento que se reconozca; use CC, ` +
        'CE, TI, PPT, PEP o PASAPORTE',
    );
  }
  /// Y ESTO ES LO QUE NO SE PUEDE CALLAR: sin tipo, el documento
  /// no forma llave.
  ///
  /// `llaveDelLead` arma la llave del documento con la pareja
  /// `(tipo, número)` ---que es como `Persona` es única--- y sin
  /// el tipo se cae a la llave del contenido. Si la fila solo
  /// trae el número, no queda nada con que reconocerla y la fila
  /// se queda fuera. Decirle «no se reconoce» sin explicar que
  /// falta UNA columna haría que el cliente creyera que su base
  /// está mal, cuando lo que falta es el rótulo del tipo.
  if (numeroDocumento && tipoDocumentoSepId === null) {
    avisos.push(
      'trae el número de documento pero no el tipo: añada una columna ' +
        '«Tipo de documento» con CC, o rellene el correo o el celular',
    );
  }

  /// QUÉ CURSO PIDIÓ. Puede venir en su propia columna o dentro
  /// de la observación: el cliente anota «interesada en AF3» en el
  /// comentario tan a menudo como en la columna del curso.
  const observacion = (v.notas ?? '').trim() || null;
  const interes = (v.accion ?? '').trim() || null;
  const pedida =
    accionQuePidio(interes, accionesDelConvenio) ??
    accionQuePidio(observacion, accionesDelConvenio);

  if (interes && !pedida) {
    avisos.push(
      `«${interes}» no es una acción publicada de este convenio, así que el ` +
        'lead entra sin curso y el asesor pregunta (el mismo código es otro ' +
        'curso en el otro gremio, así que no se busca fuera)',
    );
  }

  /// DÓNDE VIVE, resuelto contra el catálogo del SEP. Lo que no se
  /// reconozca se apunta y la fila entra: sin ubicación el lead se
  /// puede trabajar, y sin lead no.
  const donde = ubicacionQueDijo(v.departamento ?? null, v.ciudad ?? null);
  for (const x of donde.noReconocido) {
    avisos.push(`${x} no está en el catálogo del SEP, así que no se guardó`);
  }

  return {
    fila: cruda.fila,
    datos: {
      nombreCompleto,
      primerNombre: piezas?.primerNombre ?? null,
      segundoNombre: piezas?.segundoNombre ?? null,
      primerApellido: piezas?.primerApellido ?? null,
      segundoApellido: piezas?.segundoApellido ?? null,
      correo,
      celular,
      tipoDocumentoSepId,
      numeroDocumento,
      interes,
      accionFormacionId: pedida?.id ?? null,
      departamentoSepId: donde.departamentoSepId,
      municipioSepId: donde.municipioSepId,
    },
    codigoDeLaAccion: pedida?.codigo ?? null,
    observacion,
    avisos,
    crudo: { ...v },
  };
}

/**
 * Las cuatro piezas, cuando el archivo trae los apellidos aparte.
 *
 * Esto SÍ se puede partir y lo otro no, y la diferencia es toda la
 * decisión: lo difícil es saber dónde acaban los nombres y empiezan
 * los apellidos, y eso ya viene resuelto por la columna. Partir
 * «Ana María» en «Ana» + «María» no adivina nada.
 *
 * El segundo apellido sale del resto, no del segundo trozo: «DE LA
 * HOZ» es un apellido, no tres.
 */
function partirConApellidos(nombres: string, apellidos: string) {
  const ns = nombres.split(' ').filter(Boolean);
  const as = apellidos.split(' ').filter(Boolean);

  return {
    primerNombre: ns[0] ?? null,
    segundoNombre: ns.slice(1).join(' ') || null,
    primerApellido: as[0] ?? null,
    segundoApellido: as.slice(1).join(' ') || null,
  };
}
