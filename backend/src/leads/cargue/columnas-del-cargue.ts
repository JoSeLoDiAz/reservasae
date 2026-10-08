/** Las columnas que el cargue de la BBDD de leads reconoce. */

/**
 * QUÉ ES ESTO Y POR QUÉ NO ES LA PLANTILLA DE EMPRESAS.
 *
 * El cliente tiene una base de datos de leads de ADECOPRIA en una
 * hoja de cálculo que lleva meses creciendo a mano, y la frase con
 * la que la pidió es la que gobierna este fichero entero: «donde no
 * sea restrictiva porque no tengo todos los datos, necesito
 * montarla donde sí tiene, correo y celular» (5 oct 2026).
 *
 * El cargue de `src/plantillas/**` es lo contrario: exige una
 * columna llave, y si falta un solo dato no escribe NADA ---«no hay
 * aplicación a medias»---. Esa regla es la correcta ahí, porque
 * aquello CORRIGE filas que ya existen y una corrección a medias
 * deja la base peor que como estaba. Aquí no se corrige nada: se
 * RECIBE gente que todavía no está, y una fila que no sirve es una
 * persona menos a la que llamar, no una base corrupta.
 *
 * Así que aquí no hay columna obligatoria. Hay DIEZ columnas y
 * todas son opcionales: la fila entra si trae algo con que
 * reconocer a la persona, y quién decide eso es `llaveDelLead`
 * ---la misma que decide si entra un lead de Meta--- y no una
 * segunda regla escrita aquí.
 *
 * LOS RÓTULOS SE BUSCAN, NO SE EXIGEN EN ORDEN. Es la misma
 * lección que `leerPlantilla` y `organizacionDelArchivo` ya
 * aprendieron: quien reordena columnas en Excel no espera que eso
 * rompa nada, y quien reescribe «Celular» como «CELULAR / WhatsApp»
 * tampoco. Por eso cada columna lleva una lista de cómo se puede
 * llamar además de su rótulo oficial.
 */

/// Las claves con las que viaja cada columna por dentro.
export type ClaveDeColumna =
  | 'nombre'
  | 'apellido'
  /// LAS CUATRO PIEZAS POR SEPARADO, cuando el archivo las trae
  /// así. La base del cliente las tiene en cuatro columnas ---«es
  /// mejor que adivinar»--- y adivinar es justo lo que hay que
  /// evitar: esas cuatro son columnas del reporte al SENA.
  | 'primerNombre'
  | 'segundoNombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'correo'
  | 'celular'
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'accion'
  | 'departamento'
  | 'ciudad'
  /// EL GÉNERO. El lead ya tenía dónde guardarlo ---`generoSepId`
  /// está en el modelo--- y el cargue no lo leía, así que la
  /// columna del archivo del cliente caía entre las «sin
  /// reconocer» y su contenido se tiraba.
  | 'genero'
  | 'notas';

export type ColumnaDelCargue = {
  clave: ClaveDeColumna;
  /// Como sale en la plantilla que se descarga.
  titulo: string;
  /**
   * Cómo más se puede llamar en el archivo del cliente.
   *
   * Se comparan ya normalizados ---sin tildes, sin puntos, sin
   * mayúsculas--- y por COINCIDENCIA EXACTA, no por `includes`.
   * Con `includes`, «Número de documento» casaría con la columna
   * `numeroDocumento` y también con `tipoDocumento`, y la primera
   * que se mirara se quedaría las dos.
   */
  tambienSeLlama: string[];
  /// Lo que se escribe en la fila de ejemplo de la plantilla.
  ejemplo: string;
  /// La nota que va pegada a la cabecera, dentro del archivo.
  ayuda: string;
  ancho: number;
};

export const COLUMNAS_DEL_CARGUE: ColumnaDelCargue[] = [
  {
    clave: 'nombre',
    titulo: 'Nombres',
    /// «Nombre completo» entra por aquí a propósito: si el archivo
    /// trae la frase entera y NO trae apellidos, se guarda como
    /// frase y no se parte. Partir «Ana María Ruiz Gómez» es
    /// adivinar si son dos nombres y dos apellidos o uno y tres, y
    /// esas cuatro son columnas del reporte al SENA: adivinar mal
    /// se le reporta al Estado. La misma decisión que `limpiar()`
    /// en `leads.service`.
    tambienSeLlama: [
      'nombre',
      'nombres',
      'nombre completo',
      'nombres y apellidos',
      'nombre del interesado',
      'participante',
    ],
    ejemplo: 'Ana María',
    ayuda:
      'Puede traer solo el nombre, o el nombre completo. Si trae el nombre ' +
      'completo y no hay columna de apellidos, se guarda tal cual y el ' +
      'asesor lo parte: partirlo aquí sería adivinar.',
    ancho: 26,
  },
  {
    clave: 'apellido',
    titulo: 'Apellidos',
    /// «Primer apellido» YA NO entra por aqui: tiene columna
    /// propia desde el 6 oct 2026, y si lo dejara aqui ganaria esta
    /// ---se declara antes--- y la especifica no casaria nunca. Con
    /// las cuatro piezas no hay que adivinar donde acaba el nombre.
    tambienSeLlama: ['apellido', 'apellidos'],
    ejemplo: 'Ruiz Gómez',
    ayuda:
      'Si viene esta columna, el nombre ya no hay que adivinarlo: lo que ' +
      'esté aquí son apellidos y lo de al lado son nombres.',
    ancho: 26,
  },
  {
    clave: 'primerNombre',
    titulo: 'Primer nombre',
    tambienSeLlama: ['primer nombre', '1er nombre', 'nombre 1'],
    ejemplo: 'Ana',
    ayuda:
      'Solo si su archivo tiene el nombre partido en columnas. Si lo trae, no se adivina nada: cada pieza va a la suya.',
    ancho: 18,
  },
  {
    clave: 'segundoNombre',
    titulo: 'Segundo nombre',
    tambienSeLlama: ['segundo nombre', '2do nombre', 'nombre 2'],
    ejemplo: 'María',
    ayuda: 'Opcional, como todo lo demás.',
    ancho: 18,
  },
  {
    clave: 'primerApellido',
    titulo: 'Primer apellido',
    tambienSeLlama: ['primer apellido', '1er apellido', 'apellido 1'],
    ejemplo: 'Ruiz',
    ayuda: 'Opcional, como todo lo demás.',
    ancho: 18,
  },
  {
    clave: 'segundoApellido',
    titulo: 'Segundo apellido',
    tambienSeLlama: ['segundo apellido', '2do apellido', 'apellido 2'],
    ejemplo: 'Gómez',
    ayuda: 'Opcional, como todo lo demás.',
    ancho: 18,
  },
  {
    clave: 'correo',
    titulo: 'Correo',
    tambienSeLlama: [
      'correo',
      'correos',
      'email',
      'e mail',
      'correo electronico',
      'mail',
    ],
    ejemplo: 'ana.ruiz@correo.com',
    ayuda:
      'Si no tiene correo, déjelo vacío. Con el celular solo la persona ' +
      'entra igual.',
    ancho: 32,
  },
  {
    clave: 'celular',
    titulo: 'Celular',
    tambienSeLlama: [
      'celular',
      'celulares',
      'telefono',
      'telefono celular',
      'movil',
      'whatsapp',
      'celular whatsapp',
      'numero de celular',
      'contacto',
    ],
    ejemplo: '3001112222',
    ayuda:
      'Diez dígitos empezando por 3. Se admite el +57 delante. Un fijo o ' +
      'un «no tiene» no se guarda como celular: se avisa y la fila entra.',
    ancho: 18,
  },
  {
    clave: 'tipoDocumento',
    titulo: 'Tipo de documento',
    tambienSeLlama: [
      'tipo de documento',
      'tipo documento',
      'tipo de identificacion',
      'tipo doc',
      'tipo',
    ],
    ejemplo: 'CC',
    ayuda:
      'La sigla: CC, CE, TI, PPT, PEP, PASAPORTE. Si no está, el número se ' +
      'guarda igual y el asesor le pone el tipo desde la mesa.',
    ancho: 20,
  },
  {
    clave: 'numeroDocumento',
    titulo: 'Número de documento',
    tambienSeLlama: [
      'numero de documento',
      'numero documento',
      'documento',
      'cedula',
      'cc',
      'identificacion',
      'no de documento',
      'nro documento',
      'numero de identificacion',
    ],
    ejemplo: '1020304050',
    ayuda:
      'Se guarda sin puntos ni espacios: «1.020.304.050» y «1020304050» son ' +
      'la misma persona y así se reconocen entre sí.',
    ancho: 22,
  },
  {
    clave: 'accion',
    titulo: 'Acción de formación',
    tambienSeLlama: [
      'accion de formacion',
      'accion de formacion de interes',
      'accion',
      'af',
      'curso',
      'interes',
      'formacion',
      'programa',
      'codigo af',
    ],
    ejemplo: 'AF1',
    ayuda:
      'El código: AF1, AF2... Se admite la frase entera («AF1 - Los nuevos ' +
      'retos»). El mismo código es OTRO curso en el otro gremio, así que se ' +
      'busca solo entre las acciones de este convenio.',
    ancho: 26,
  },
  {
    clave: 'departamento',
    titulo: 'Departamento',
    tambienSeLlama: [
      'departamento',
      'depto',
      'dpto',
      'departamento de residencia',
    ],
    ejemplo: 'Antioquia',
    ayuda:
      'El nombre, no el código. Lo que no se reconozca no tumba la fila: se ' +
      'avisa y la persona entra sin ubicación.',
    ancho: 22,
  },
  {
    clave: 'ciudad',
    titulo: 'Ciudad',
    tambienSeLlama: [
      'ciudad',
      'municipio',
      'ciudad de residencia',
      'ciudad municipio',
      'ciudad o municipio',
    ],
    ejemplo: 'Medellín',
    ayuda:
      'El municipio se busca DENTRO de su departamento: «San Antonio» son ' +
      'ocho municipios distintos y elegir uno al azar inventa un domicilio.',
    ancho: 22,
  },
  {
    clave: 'genero',
    titulo: 'Género',
    tambienSeLlama: [
      'genero',
      'sexo',
      'genero sexo',
      'sexo genero',
      'identidad de genero',
    ],
    ejemplo: 'Femenino',
    ayuda:
      'MASCULINO, FEMENINO o NO BINARIO, que son los tres del SEP. También vale M o F. Lo que no case se avisa y la persona entra sin género, que es una columna del reporte y no se adivina.',
    ancho: 16,
  },
  {
    clave: 'notas',
    titulo: 'Observación',
    tambienSeLlama: [
      'observacion',
      'observaciones',
      'nota',
      'notas',
      'comentario',
      'comentarios',
      'detalle',
    ],
    ejemplo: 'Llamó por la feria de agosto',
    ayuda:
      'Lo que haya anotado a mano sobre esta persona. Entra como primera ' +
      'nota de gestión del lead, no se pierde.',
    ancho: 40,
  },
];

/// Sin tildes, sin puntos, sin dobles espacios y en minúscula.
///
/// Es el mismo `llano()` que usa `carga-archivo.ts` para casar el
/// rótulo de la hoja «Organización», y tiene que ser el mismo
/// criterio: si aquí «Nº de documento» y allá «No de documento» se
/// normalizan distinto, el cliente reescribe un rótulo a mano y la
/// columna deja de reconocerse sin que nada avise.
export function rotuloLlano(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.:_#°º]/g, '')
    .replace(/[/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La columna a la que corresponde un rótulo del archivo, o null.
 *
 * EXACTO y no por `includes`, y esto no es una preferencia de
 * estilo: con `includes`, «Número de documento» contiene
 * «documento» ---el alias de `numeroDocumento`--- pero «Tipo de
 * documento» también, y la primera que se mirara se quedaría las
 * dos columnas. El número del tipo y el número del documento son
 * la identidad de una persona: confundirlos no falla, se guarda y
 * sale mal en el reporte al SENA meses después.
 */
export function columnaDelRotulo(rotulo: string): ColumnaDelCargue | null {
  const buscado = rotuloLlano(rotulo);
  if (!buscado) return null;

  return (
    COLUMNAS_DEL_CARGUE.find(
      (c) =>
        rotuloLlano(c.titulo) === buscado || c.tambienSeLlama.includes(buscado),
    ) ?? null
  );
}

/// Para poder decir en castellano qué se rellenó y qué choca.
export const NOMBRE_DEL_CAMPO_DEL_LEAD: Record<string, string> = {
  nombreCompleto: 'nombre',
  primerNombre: 'primer nombre',
  segundoNombre: 'segundo nombre',
  primerApellido: 'primer apellido',
  segundoApellido: 'segundo apellido',
  correo: 'correo',
  celular: 'celular',
  tipoDocumentoSepId: 'tipo de documento',
  numeroDocumento: 'número de documento',
  interes: 'lo que pidió',
  accionFormacionId: 'acción de formación',
  departamentoSepId: 'departamento',
  municipioSepId: 'ciudad',
};
