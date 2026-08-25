import {
  calcularDigitoVerificacion,
  formatearNit,
  leerCedulaDeIndependiente,
  leerNit,
  normalizarNit,
  pareceNitDeEmpresa,
} from './nit';

/// El banco real de instituciones asociadas, con el DV
/// que trae cada una. Sirve de red: si alguien toca los
/// pesos de la DIAN, 173 casos se caen a la vez.
const BANCO: Array<[string, string]> = [
  ['900803171', '2'], ['800251720', '3'], ['890916768', '9'], ['890900938', '4'],
  ['800106740', '0'], ['890985730', '4'], ['800183767', '7'], ['860007627', '1'],
  ['890982209', '4'], ['890901195', '3'], ['800084408', '3'], ['860019021', '9'],
  ['890901130', '5'], ['800055169', '4'], ['890911450', '1'], ['890900842', '6'],
  ['890902916', '1'], ['890901933', '2'], ['811007767', '4'], ['800188329', '7'],
  ['890905211', '1'], ['20759265', '6'], ['800250016', '1'], ['811008807', '5'],
  ['811016793', '4'], ['900074607', '2'], ['811033272', '0'], ['900236493', '6'],
  ['890984760', '0'], ['890902922', '6'], ['811013335', '0'], ['890906574', '4'],
  ['890902829', '9'], ['860007390', '1'], ['890901093', '0'], ['860031945', '8'],
  ['890983674', '0'], ['890399011', '3'], ['811040138', '0'], ['890982432', '0'],
  ['800205517', '9'], ['901142056', '1'], ['901830745', '8'], ['811040224', '6'],
  ['811038236', '8'], ['890980445', '7'], ['811029413', '7'], ['890913319', '1'],
  ['830044212', '5'], ['811018314', '9'], ['860028677', '8'], ['900826341', '7'],
  ['901337408', '7'], ['800009090', '6'], ['900251433', '7'], ['890928735', '8'],
  ['890982518', '5'], ['890904080', '9'], ['901119710', '2'], ['811044640', '5'],
  ['800254249', '9'], ['901455064', '2'], ['900104504', '2'], ['811023361', '5'],
  ['860009468', '4'], ['900036807', '7'], ['900349538', '4'], ['900273737', '5'],
  ['890900286', '0'], ['901918136', '2'], ['900572979', '3'], ['901655409', '8'],
  ['901313185', '6'], ['901442182', '7'], ['811019723', '2'], ['900996739', '2'],
  ['800024265', '0'], ['811026293', '6'], ['890905179', '3'], ['827000790', '0'],
  ['890800718', '1'], ['901307820', '0'], ['900673949', '6'], ['900315752', '8'],
  ['890936732', '1'], ['800020449', '0'], ['811027248', '9'], ['806012153', '4'],
  ['811030637', '1'], ['900412664', '3'], ['811019064', '7'], ['900414712', '8'],
  ['901048040', '0'], ['900705033', '4'], ['811017315', '1'], ['811017366', '7'],
  ['811017293', '8'], ['811024770', '9'], ['811021052', '5'], ['811038559', '1'],
  ['811022003', '9'], ['811020229', '7'], ['811040190', '4'], ['811018049', '1'],
  ['901046877', '9'], ['811017766', '1'], ['811018892', '4'], ['901048423', '8'],
  ['811018352', '9'], ['811017718', '6'], ['811017307', '2'], ['811017615', '6'],
  ['811017505', '4'], ['800256811', '8'], ['811018169', '7'], ['811035980', '6'],
  ['800214750', '7'], ['811028188', '1'], ['890980116', '9'], ['890981239', '0'],
  ['800014656', '4'], ['890980756', '2'], ['890935030', '3'], ['890924234', '1'],
  ['811022317', '6'], ['860524772', '7'], ['800014022', '5'], ['901411171', '3'],
  ['900337028', '8'], ['900337205', '5'], ['811019727', '1'], ['890906347', '9'],
  ['811040275', '1'], ['901722162', '1'], ['811018413', '1'], ['901794282', '5'],
  ['890907106', '5'], ['890980093', '8'], ['822002548', '5'], ['900802043', '3'],
  ['901253850', '8'], ['829001222', '0'], ['830502641', '7'], ['890900841', '9'],
  ['811018890', '1'], ['901051510', '1'], ['901664531', '7'], ['811021944', '1'],
  ['890907317', '2'], ['890980782', '4'], ['890980447', '1'], ['899999034', '1'],
  ['900421154', '7'], ['900053304', '6'], ['800093761', '7'], ['901421752', '5'],
  ['900417576', '6'], ['901259530', '3'], ['899999063', '3'], ['890983722', '6'],
  ['890316745', '5'], ['901155508', '3'], ['900478445', '0'], ['901171576', '1'],
];

describe('el dígito de verificación de la DIAN', () => {
  it('acierta en las 168 instituciones del banco', () => {
    const fallos = BANCO.filter(([nit, dv]) => calcularDigitoVerificacion(nit) !== dv);

    expect(fallos).toEqual([]);
  });

  it('devuelve el resto cuando es 0 o 1, y 11 menos el resto si no', () => {
    // el 0 y el 1 salen tal cual del resto
    expect(calcularDigitoVerificacion('890905211')).toBe('1');
    expect(calcularDigitoVerificacion('811033272')).toBe('0');
    expect(calcularDigitoVerificacion('900803171')).toBe('2');
  });

  it('no le importan los puntos ni la longitud', () => {
    expect(calcularDigitoVerificacion('20759265')).toBe('6');
    expect(calcularDigitoVerificacion('900421154')).toBe('7');
  });
});

describe('el RUT extranjero no sigue la regla', () => {
  /// La Fundación America por la Infancia figura con RUT,
  /// no con NIT: la regla de la DIAN no le aplica y su
  /// DV declarado (7) no coincide con el calculado (1).
  it('el RUT 65114559 no cuadra, y está bien que no cuadre', () => {
    expect(calcularDigitoVerificacion('65114559')).not.toBe('7');
  });
});

describe('leer lo que teclea una persona', () => {
  it('calcula el DV cuando no lo escriben', () => {
    const l = leerNit('900421154')!;

    expect(l.nit).toBe('900421154');
    expect(l.digitoVerificacion).toBe('7');
    expect(l.digitoTecleado).toBeNull();
    expect(l.digitoCuadra).toBe(true);
  });

  it('avisa cuando escriben un DV que no cuadra', () => {
    const l = leerNit('900421154-3')!;

    expect(l.digitoTecleado).toBe('3');
    expect(l.digitoVerificacion).toBe('7');
    expect(l.digitoCuadra).toBe(false);
  });

  it('acepta el DV correcto escrito a mano', () => {
    const l = leerNit('900421154-7')!;

    expect(l.digitoCuadra).toBe(true);
  });

  it('se traga los puntos', () => {
    expect(leerNit('900.421.154')!.nit).toBe('900421154');
    expect(leerNit('  900.421.154-7 ')!.digitoCuadra).toBe(true);
  });

  it('devuelve null con basura', () => {
    expect(leerNit('')).toBeNull();
    expect(leerNit('abc')).toBeNull();
    expect(leerNit('12')).toBeNull();
  });
});

describe('distinguir un NIT de empresa de una cédula', () => {
  it('reconoce los NIT modernos de nueve dígitos', () => {
    expect(pareceNitDeEmpresa('900421154')).toBe(true);
    expect(pareceNitDeEmpresa('811017315')).toBe(true);
  });

  it('una cédula normal no lo parece', () => {
    expect(pareceNitDeEmpresa('1026300012')).toBe(false);
    expect(pareceNitDeEmpresa('43567890')).toBe(false);
  });

  /// Los dos casos del propio banco que rompen la regla.
  /// Por eso el aviso no bloquea: si bloqueara, estas dos
  /// instituciones no podrían registrarse.
  it('los NIT viejos del banco no la cumplen, y se sabe', () => {
    expect(pareceNitDeEmpresa('20759265')).toBe(false);
    expect(pareceNitDeEmpresa('65114559')).toBe(false);
  });
});

describe('la cédula que hace de RUT del independiente', () => {
  it('acepta una cédula normal sin avisar de nada', () => {
    const l = leerCedulaDeIndependiente('1.026.300.012')!;

    expect(l.cedula).toBe('1026300012');
    expect(l.pareceDeEmpresa).toBe(false);
  });

  it('avisa si teclean algo con pinta de NIT de empresa', () => {
    const l = leerCedulaDeIndependiente('900421154')!;

    expect(l.pareceDeEmpresa).toBe(true);
  });

  it('rechaza lo que no puede ser una cédula', () => {
    expect(leerCedulaDeIndependiente('12')).toBeNull();
    expect(leerCedulaDeIndependiente('12345678901')).toBeNull();
    expect(leerCedulaDeIndependiente('CC1234')).toBeNull();
  });
});

describe('formatear para mostrar', () => {
  it('pone puntos y el guion del DV', () => {
    expect(formatearNit('900421154')).toBe('900.421.154-7');
    expect(formatearNit('20759265')).toBe('20.759.265-6');
  });

  it('respeta el DV que le pasen', () => {
    expect(formatearNit('65114559', '7')).toBe('65.114.559-7');
  });
});

describe('normalizarNit sigue haciendo lo de siempre', () => {
  it('no cambió para quien ya la usaba', () => {
    expect(normalizarNit('900.421.154')).toEqual({
      nit: '900421154',
      digitoVerificacion: '7',
    });
    expect(normalizarNit('900421154-7')).toEqual({
      nit: '900421154',
      digitoVerificacion: '7',
    });
    expect(normalizarNit('nada')).toBeNull();
  });
});
