/** Las siete cifras macro del Resumen General. */

import { resumenGeneral, fueGestionada, type FilaCruda } from './resumen-general';

/// Una persona a la que no le falta nada de lo que pide el reporte.
const PERSONA_COMPLETA = {
  correo: 'quien@ejemplo.test',
  celular: '3001234567',
  fechaNacimiento: new Date('1990-01-01'),
  generoSepId: 1,
  estrato: 3,
  departamentoSepId: 5,
  municipioSepId: 1,
  barrio: 'Centro',
  direccion: 'Calle 1',
};

function fila(p: Partial<FilaCruda> = {}): FilaCruda {
  return {
    etapa: 'INTERESADO',
    nivelOcupacionalSepId: 1,
    datosTocadosPorAsesorEn: null,
    accionFormacion: { id: 'af1', codigo: 'AF1', nombre: 'Curso uno' },
    convenio: { sigla: 'ADECOPRIA', nombre: 'Adecopria' },
    persona: { ...PERSONA_COMPLETA },
    _count: { notas: 0 },
    ...p,
  } as FilaCruda;
}

describe('resumenGeneral', () => {
  it('trae la sigla del gremio, para desempatar dos AF1', () => {
    const r = resumenGeneral([fila()]);
    expect(r[0].gremio).toBe('ADECOPRIA');
  });

  it('agrupa por acción y ordena por código', () => {
    const r = resumenGeneral([
      fila({ accionFormacion: { id: 'b', codigo: 'AF2', nombre: 'Dos' } }),
      fila({ accionFormacion: { id: 'a', codigo: 'AF1', nombre: 'Uno' } }),
      fila({ accionFormacion: { id: 'a', codigo: 'AF1', nombre: 'Uno' } }),
    ]);
    expect(r.map((f) => f.codigo)).toEqual(['AF1', 'AF2']);
    expect(r[0].leads).toBe(2);
  });

  it('deja fuera a quien no tiene acción: no hay barra donde ponerlo', () => {
    expect(resumenGeneral([fila({ accionFormacion: null })])).toEqual([]);
  });

  it('parte los datos en completos y parciales, y suman los leads', () => {
    const r = resumenGeneral([
      fila(),
      fila({ persona: { ...PERSONA_COMPLETA, celular: null } }),
      fila({ nivelOcupacionalSepId: null }),
    ]);
    expect(r[0].datosCompletos).toBe(1);
    expect(r[0].datosParciales).toBe(2);
    expect(r[0].datosCompletos + r[0].datosParciales).toBe(r[0].leads);
  });

  it('cuenta como inscrito a quien ocupa silla, en cualquiera de las tres etapas', () => {
    const r = resumenGeneral([
      fila({ etapa: 'INSCRITO' }),
      fila({ etapa: 'EN_FORMACION' }),
      fila({ etapa: 'CERTIFICADO' }),
    ]);
    expect(r[0].inscritos).toBe(3);
  });

  it('«no interesados» es PERDIDO, que es como se llama en la base', () => {
    const r = resumenGeneral([fila({ etapa: 'PERDIDO' }), fila({ etapa: 'INTERESADO' })]);
    expect(r[0].noInteresados).toBe(1);
  });

  it('un lead recién llegado, sin notas ni etapa movida, está SIN GESTIÓN', () => {
    const r = resumenGeneral([fila({ etapa: 'INTERESADO' })]);
    expect(r[0].sinGestion).toBe(1);
    expect(r[0].enProceso).toBe(0);
  });

  it('una nota basta para que pase a EN PROCESO', () => {
    const r = resumenGeneral([fila({ etapa: 'INTERESADO', _count: { notas: 1 } })]);
    expect(r[0].enProceso).toBe(1);
    expect(r[0].sinGestion).toBe(0);
  });

  it('DATOS_COMPLETOS sin nadie detrás sigue SIN GESTIÓN: lo pone el sistema', () => {
    // es el caso que el cliente quería ver: la persona terminó su
    // formulario sola y nadie del equipo la ha llamado todavía
    const r = resumenGeneral([fila({ etapa: 'DATOS_COMPLETOS' })]);
    expect(r[0].sinGestion).toBe(1);
  });

  it('CONTACTADO ya es gestión: a esa etapa solo se llega a mano', () => {
    expect(fueGestionada(fila({ etapa: 'CONTACTADO' }))).toBe(true);
  });

  it('un asesor que tocó los datos cuenta como gestión aunque no deje nota', () => {
    expect(fueGestionada(fila({ datosTocadosPorAsesorEn: new Date() }))).toBe(true);
  });

  it('las salidas del aula no caen en ninguno de los cuatro estados, pero sí en leads', () => {
    const r = resumenGeneral([fila({ etapa: 'RETIRADO' }), fila({ etapa: 'DESERTO' })]);
    expect(r[0].leads).toBe(2);
    expect(r[0].enProceso + r[0].sinGestion + r[0].inscritos + r[0].noInteresados).toBe(0);
  });

  it('los cuatro estados reparten a toda la gente viva, sin solapes', () => {
    const r = resumenGeneral([
      fila({ etapa: 'INTERESADO' }),
      fila({ etapa: 'CONTACTADO' }),
      fila({ etapa: 'INSCRITO' }),
      fila({ etapa: 'PERDIDO' }),
    ]);
    const f = r[0];
    expect(f.sinGestion).toBe(1);
    expect(f.enProceso).toBe(1);
    expect(f.inscritos).toBe(1);
    expect(f.noInteresados).toBe(1);
    expect(f.enProceso + f.sinGestion + f.inscritos + f.noInteresados).toBe(f.leads);
  });
});
