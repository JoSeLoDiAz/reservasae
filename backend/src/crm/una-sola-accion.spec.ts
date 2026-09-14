import { esForo, motivoParaNoInscribir, type YaInscritaEn } from './una-sola-accion';

const CURSO = { id: 'af1', evento: 'CURSO' };
const OTRO_CURSO = { id: 'af2', evento: 'CURSO' };
const FORO = { id: 'af7', evento: 'FORO' };

const tiene = (id: string, evento: string, codigo = 'AF1'): YaInscritaEn => ({
  accionFormacionId: id,
  codigo,
  nombre: 'Gestión de la Atención',
  evento,
});

describe('si algo es un foro', () => {
  it('lo reconoce con espacios y en minúsculas', () => {
    expect(esForo('FORO')).toBe(true);
    expect(esForo(' foro ')).toBe(true);
  });

  /// Por igualdad y no por «contiene»: un «TALLER-BOOTCAMP» de
  /// dieciseis horas no puede colarse por la excepcion.
  it('no confunde otros eventos', () => {
    expect(esForo('CURSO')).toBe(false);
    expect(esForo('TALLER-BOOTCAMP')).toBe(false);
    expect(esForo(null)).toBe(false);
  });
});

describe('una sola acción por persona', () => {
  it('sin nada previo, puede', () => {
    expect(motivoParaNoInscribir(CURSO, [])).toBeNull();
  });

  it('con un curso ya tomado, NO puede tomar otro', () => {
    const m = motivoParaNoInscribir(OTRO_CURSO, [tiene('af1', 'CURSO')]);
    expect(m).toMatch(/Ya está inscrita/);
    expect(m).toMatch(/AF1/);
  });

  /// EL FORO NO BLOQUEA: son dos horas contra cuarenta.
  it('con un curso ya tomado, SÍ puede ir al foro', () => {
    expect(motivoParaNoInscribir(FORO, [tiene('af1', 'CURSO')])).toBeNull();
  });

  it('y el foro tampoco impide tomar un curso después', () => {
    expect(motivoParaNoInscribir(CURSO, [tiene('af7', 'FORO', 'AF7')])).toBeNull();
  });

  /// Volver a la misma no es una segunda inscripcion: quien
  /// llama le devuelve su enlace en vez de decirle que no.
  it('volver a la misma acción no es motivo', () => {
    expect(motivoParaNoInscribir(CURSO, [tiene('af1', 'CURSO')])).toBeNull();
  });

  it('el motivo DICE en cuál está, que es lo que hay que saber', () => {
    const m = motivoParaNoInscribir(OTRO_CURSO, [tiene('af1', 'CURSO')]);
    expect(m).toContain('Gestión de la Atención');
  });
});
