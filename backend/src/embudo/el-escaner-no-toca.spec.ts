/** La línea entre abrir un enlace y tocar el formulario. */

/// Un escáner de enlaces --el del proveedor de correo masivo, el
/// antivirus de un buzón-- ejecuta JavaScript, así que escribe
/// `LLEGO` y después `CATALOGO_LISTO` o `CATALOGO_FALLO`. Y nada
/// más: todo lo de arriba cuelga de un gesto. El 16 sep 2026 eso
/// fueron 565 de las 599 visitas del día, y solo DOS pasaron de
/// la línea.
///
/// Esto NO es un detector de robots y el test tampoco lo dice:
/// una persona que abre, mira y se va escribe lo mismo. Lo que se
/// fija aquí es que la línea se DERIVE de la escalera y que la
/// cifra salga monótona.

import { ESCALERA, PRIMER_GESTO, altura, pideGesto } from './escalera';
import { procedenciaSql } from './procedencia';

describe('la línea del primer gesto', () => {
  it('es un peldaño de la escalera y no un nombre suelto', () => {
    expect(ESCALERA as readonly string[]).toContain(PRIMER_GESTO);
  });

  /// Los dos de debajo los escribe el navegador sin que nadie
  /// toque nada. Si algún día uno de ellos exigiera un gesto,
  /// este test obliga a mover la línea a conciencia.
  it('deja fuera exactamente lo que un escáner puede escribir', () => {
    expect(pideGesto('LLEGO')).toBe(false);
    expect(pideGesto('CATALOGO_LISTO')).toBe(false);
  });

  it('y dentro todo lo que exige a una persona', () => {
    for (const p of [
      'ELIGIO_UBICACION',
      'VIO_ACCIONES',
      'ELIGIO_ACCION',
      'AUTORIZO',
      'DATOS_COMPLETOS',
      'LLEGO_A_REVISION',
      'ENVIO',
      'REGISTRADO',
    ]) {
      expect(pideGesto(p)).toBe(true);
    }
  });

  /// Es lo que hace que `tocaron` no pueda salir menor que
  /// `envios`: REGISTRADO está por encima de la línea, así que
  /// toda conversión cuenta también como gesto. Sin esto la fila
  /// del corte podría subir, y un embudo que sube no se lee.
  it('REGISTRADO queda SIEMPRE por encima de la línea', () => {
    expect(altura('REGISTRADO')).toBeGreaterThan(altura(PRIMER_GESTO));
  });

  /// Una marca no es un peldaño: no dice hasta dónde llegó.
  it('una marca nunca cuenta como gesto', () => {
    for (const m of ['CATALOGO_FALLO', 'SIN_COBERTURA', 'ENVIO_FALLO']) {
      expect(pideGesto(m)).toBe(false);
    }
  });

  it('la línea no se cuela por un paso inventado', () => {
    expect(pideGesto('NO_EXISTE')).toBe(false);
    expect(pideGesto('')).toBe(false);
  });
});

describe('el correo que llega por un redirector', () => {
  const valores = (procedenciaSql().values as unknown[]).filter(
    (v): v is string => typeof v === 'string',
  );

  /// Sin esto, un mailing entero se cuenta como «otra página
  /// web»: es donde cayeron las 565 del 16 sep 2026.
  it('el redirector medido se compara, exacto y como sufijo', () => {
    expect(valores).toContain('in.campusadecopria.com');
    expect(valores).toContain('%.in.campusadecopria.com');
  });

  /// El dominio de la casa NO: `campusadecopria.com` es también
  /// el sitio del gremio, y un enlace desde su web es OTRA_WEB.
  it('el dominio de la casa NO se toca', () => {
    expect(valores).not.toContain('campusadecopria.com');
    expect(valores).not.toContain('%.campusadecopria.com');
  });

  /// La etiqueta que ponemos nosotros sigue siendo lo que manda:
  /// la lista de redirectores es el parche de lo que ya salió sin
  /// ella, no el mecanismo.
  it('`utm_source=correo` sigue resolviendo por su cuenta', () => {
    for (const d of ['correo', 'email', 'mail']) expect(valores).toContain(d);
  });
});
