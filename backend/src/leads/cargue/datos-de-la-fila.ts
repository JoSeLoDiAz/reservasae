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
import {
  GENEROS_SEP,
  NIVELES_OCUPACIONALES_SEP,
} from '../../crm/catalogos-sep';
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
  /// Los tres del SEP: 1 masculino, 2 femenino, 3 no binario. Null
  /// cuando no vino o no casó: es columna del reporte y no se
  /// adivina.
  generoSepId: number | null;
  /// Las siete de su base. Null es «no vino o no se entendió», y
  /// NUNCA un valor inventado: casi todas son columna del reporte
  /// al SENA.
  fechaNacimiento: Date | null;
  estrato: number | null;
  barrio: string | null;
  direccion: string | null;
  cargoEnEmpresa: string | null;
  nivelOcupacionalSepId: number | null;
  beneficiarioPrevio: boolean | null;
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

  /**
   * SI EL ARCHIVO TRAE LAS CUATRO PIEZAS, NO SE ADIVINA NADA.
   *
   * La base del cliente las tiene en cuatro columnas ---«Primer
   * nombre», «Segundo nombre», «Primer apellido», «Segundo
   * apellido»--- y hasta el 6 oct 2026 el cargue no las conocía:
   * de 19 columnas suyas, 13 salían como «no se reconocen».
   *
   * Cuando vienen, mandan. Partir «Ana María Ruiz Gómez» es
   * adivinar si son dos nombres y dos apellidos o uno y tres, y
   * esas cuatro son columnas del reporte al SENA: adivinar mal se
   * le reporta al Estado. Si las trae separadas, el problema no
   * existe.
   */
  const sueltas = limpiarPiezas(v);

  const piezas =
    sueltas ?? (apellidos ? partirConApellidos(nombres, apellidos) : null);

  /// El nombre completo se arma de lo que haya: de las cuatro
  /// piezas si vinieron, y si no, de las dos columnas de siempre.
  const nombreCompleto = sueltas
    ? [
        sueltas.primerNombre,
        sueltas.segundoNombre,
        sueltas.primerApellido,
        sueltas.segundoApellido,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null
    : [nombres, apellidos].filter(Boolean).join(' ').trim() || null;

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

  /**
   * EL GÉNERO, contra los tres del SEP.
   *
   * Se admite la letra sola ---«M», «F»--- porque medio país llena
   * esa columna así, y no admitirla dejaría fuera archivos enteros
   * por una convención de escritura.
   *
   * Lo que no case NO se adivina: es una columna del reporte al
   * SENA, y meter «MASCULINO» porque empieza por eme es reportarle
   * al Estado algo que nadie dijo. Se avisa y la persona entra sin
   * género, igual que con el departamento.
   */
  /// Sin tildes y en mayúsculas, que es como se comparan los
  /// catálogos del SEP en el resto de la casa.
  const sinAcentos = (x: string) =>
    x
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  /**
   * LAS SIETE DE SU BASE.
   *
   * Cada una con la misma regla: lo que no se entiende SE AVISA y
   * entra vacío. Ninguna se adivina, porque casi todas viajan al
   * SENA y meter un valor por parecido es reportarle al Estado algo
   * que nadie dijo.
   */
  const fechaNacimiento = (() => {
    const crudo = (v.fechaNacimiento ?? '').trim();
    if (!crudo) return null;
    /// Dos formas: la del ordenador (1990-04-12) y la de la gente
    /// (12/04/1990). El dia primero, que es como se escribe aqui.
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(crudo);
    const nuestra = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(crudo);
    const d = iso
      ? new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
      : nuestra
        ? new Date(Date.UTC(+nuestra[3], +nuestra[2] - 1, +nuestra[1]))
        : null;
    if (!d || Number.isNaN(d.getTime())) {
      avisos.push(
        `«${crudo}» no se entiende como fecha de nacimiento (vale 1990-04-12 o 12/04/1990): entra sin fecha.`,
      );
      return null;
    }
    return d;
  })();

  const estrato = (() => {
    const crudo = (v.estrato ?? '').trim();
    if (!crudo) return null;
    const n = Number(crudo);
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      avisos.push(
        `«${crudo}» no es un estrato del 1 al 6: entra sin estrato.`,
      );
      return null;
    }
    return n;
  })();

  const nivelOcupacionalSepId = (() => {
    const crudo = (v.nivelOcupacional ?? '').trim();
    if (!crudo) return null;
    const n = sinAcentos(crudo);
    const cual = NIVELES_OCUPACIONALES_SEP.find(
      (x) => sinAcentos(x.etiqueta) === n,
    );
    if (!cual) {
      avisos.push(
        `«${crudo}» no es un nivel ocupacional del SEP: entra sin nivel.`,
      );
      return null;
    }
    return cual.id;
  })();

  /// VACIO NO ES «NO». Es que nadie lo pregunto, y declarar que no
  /// se beneficio antes a quien no contesto seria inventarselo.
  const beneficiarioPrevio = (() => {
    const crudo = (v.beneficiarioPrevio ?? '').trim();
    if (!crudo) return null;
    const n = sinAcentos(crudo);
    if (['SI', 'S', 'X', 'TRUE', '1'].includes(n)) return true;
    if (['NO', 'N', 'FALSE', '0'].includes(n)) return false;
    avisos.push(
      `«${crudo}» no es un sí o un no en «¿se ha beneficiado antes?»: entra sin responder.`,
    );
    return null;
  })();

  const genero = (() => {
    const crudo = (v.genero ?? '').trim();
    if (!crudo) return null;
    const n = sinAcentos(crudo);
    if (n === 'M') return 1;
    if (n === 'F') return 2;
    const cual = GENEROS_SEP.find((g) => sinAcentos(g.etiqueta) === n);
    if (cual) return cual.id;
    avisos.push(
      `«${crudo}» no es un género del SEP (MASCULINO, FEMENINO o NO BINARIO): entra sin género.`,
    );
    return null;
  })();
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
      generoSepId: genero,
      fechaNacimiento,
      estrato,
      barrio: (v.barrio ?? '').trim() || null,
      direccion: (v.direccion ?? '').trim() || null,
      cargoEnEmpresa: (v.cargoEnEmpresa ?? '').trim() || null,
      nivelOcupacionalSepId,
      beneficiarioPrevio,
    },
    codigoDeLaAccion: pedida?.codigo ?? null,
    observacion,
    avisos,
    /// Lo reconocido Y lo que no, que si no el dato se pierde: el
    /// informe decía «8 columnas sin reconocer» y su contenido no
    /// quedaba en ninguna parte. Los rótulos sin reconocer van tal
    /// cual venían en el archivo.
    crudo: { ...v, ...cruda.extras },
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

/**
 * Las cuatro piezas del nombre, si el archivo las trae separadas.
 *
 * `null` cuando no viene ninguna: entonces manda la lógica de
 * siempre ---dos columnas y un reparto--- y nada cambia para quien
 * ya usaba la plantilla.
 *
 * Basta con que venga UNA. Una base que solo trae «Primer nombre» y
 * «Primer apellido» es más fiable que partir una frase, aunque le
 * falten las otras dos: lo que se sabe se guarda donde va, y lo que
 * no, queda nulo.
 */
function limpiarPiezas(v: Record<string, string | null | undefined>): {
  primerNombre: string | null;
  segundoNombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
} | null {
  const uno = (x: string | null | undefined) =>
    (x ?? '').trim().replace(/\s+/g, ' ') || null;

  const piezas = {
    primerNombre: uno(v.primerNombre),
    segundoNombre: uno(v.segundoNombre),
    primerApellido: uno(v.primerApellido),
    segundoApellido: uno(v.segundoApellido),
  };
  return Object.values(piezas).some(Boolean) ? piezas : null;
}
