/** Una acción sin el total de horas no se reporta en silencio. */

/**
 * `AccionFormacion.horas` ES OPCIONAL Y «TOTAL DE HORAS EVENTO» LO
 * EXPORTABA TAL CUAL.
 *
 * Una acción a la que nadie le puso las horas mandaba la celda VACÍA
 * en todas sus filas ---son cientos, todas de la misma acción--- y
 * nada lo decía: ni el alistamiento, ni la hoja de los no exportados,
 * ni la ficha de la persona. El cliente arma sus INSERT concatenando
 * celdas, así que de ahí no sale un error: sale un cargue con el
 * total de horas en blanco.
 *
 * Y es el dato del que cuelga todo lo demás: el porcentaje de
 * cumplimiento del cierre se mide contra él.
 *
 * Lo encontró una auditoría del 5 oct 2026.
 */

import {
  empresaCompleta,
  participacionCompleta,
  prismaDelReporte,
} from './dobles-del-reporte';
import { fila as filaDelCargue } from './formato-cargue-sep';
import type { FilaSep } from './datos';
import { SepService } from './sep.service';

const EMPRESA = empresaCompleta('e1', 'Textiles del Norte SAS', '900123456');

function alistamiento(svc: SepService) {
  return svc.alistamiento('convenio-1', ['convenio-1']);
}

describe('el total de horas del evento', () => {
  it('con las horas puestas, la persona entra en el cargue', async () => {
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({ id: 'p1', accion: 'AF01', empresa: EMPRESA }),
      ]),
    );
    const r = await alistamiento(svc);
    expect(r.listos).toBe(1);
    expect(r.noListos).toBe(0);
  });

  /**
   * SIN ELLAS NO ENTRA, Y SOBRE TODO: SE DICE POR QUÉ.
   *
   * Lo que se arregla no es que salga fuera ---es una fila menos---
   * sino que ANTES NADIE SE ENTERABA. La hoja de los no exportados y
   * el alistamiento son los dos sitios donde el asesor lo lee.
   */
  it('sin ellas la fila no sale, y el motivo nombra la acción', async () => {
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({
          id: 'p1',
          accion: 'AF01',
          empresa: EMPRESA,
          horas: null,
        }),
      ]),
    );

    const r = await alistamiento(svc);

    expect(r.listos).toBe(0);
    expect(r.noListos).toBe(1);
    expect(r.personas[0].motivo).toContain('total de horas');
    /// El arreglo es UNO para las cientos de filas: se le ponen las
    /// horas a la acción. Por eso el motivo la nombra.
    expect(r.personas[0].motivo).toContain('AF01');
  });

  /**
   * Y EL MOTIVO AGRUPA, porque el alistamiento cuenta por motivo.
   * El asesor lee «400 sin horas en AF01» una vez, no 400 veces.
   */
  it('y el alistamiento lo cuenta junto, no fila por fila', async () => {
    const svc = new SepService(
      prismaDelReporte([
        participacionCompleta({
          id: 'p1',
          accion: 'AF01',
          empresa: EMPRESA,
          horas: null,
        }),
        participacionCompleta({
          id: 'p2',
          accion: 'AF01',
          empresa: EMPRESA,
          horas: null,
        }),
        participacionCompleta({
          id: 'p3',
          accion: 'AF02',
          empresa: EMPRESA,
          horas: null,
        }),
      ]),
    );

    const r = await alistamiento(svc);

    expect(r.noListos).toBe(3);
    expect(r.motivos).toHaveLength(2);
    expect(r.motivos[0].total).toBe(2);
  });
});

describe('el cinturón del formato', () => {
  /// Quien no tiene horas ya no llega al formato, pero si algún día
  /// llegara, la celda va VACÍA y no con un `null` suelto: el cliente
  /// concatena celdas y un «null» dentro de un INSERT es otra cosa.
  it('la celda sale vacía, nunca con un null dentro', () => {
    const p = {
      participante: {
        id: 'p1',
        etapa: 'INSCRITO',
        cargoEnEmpresa: null,
        nivelOcupacionalSepId: 3,
        beneficiarioPrevio: false,
        fechaMatricula: new Date('2026-02-01T00:00:00Z'),
      },
      persona: {
        id: 'per1',
        tipoDocumentoSepId: 1,
        numeroDocumento: '1019456782',
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Restrepo',
        segundoApellido: null,
        fechaNacimiento: new Date('1995-05-10T00:00:00Z'),
        correo: 'ana@ejemplo.test',
        celular: '3001112222',
        generoSepId: 2,
        estrato: 2,
        departamentoSepId: 5,
        municipioSepId: 5001,
        barrio: 'Laureles',
        direccion: 'Carrera 70 # 1-10',
      },
      convenio: {
        sepProyectoId: null,
        sepNombreConviniente: null,
        nombre: 'Convenio de prueba',
        sigla: 'CP',
      },
      accion: {
        codigo: 'AF01',
        nombre: 'AF01 · Curso',
        sepAfId: null,
        horas: null,
      },
      grupo: { numero: 1, sepGrupoId: null },
      empresa: EMPRESA,
      genero: 'Femenino',
      caracterizacionSepId: null,
    } satisfies FilaSep;

    expect(filaDelCargue(p, 0, 2026).horas).toBe('');
  });
});
