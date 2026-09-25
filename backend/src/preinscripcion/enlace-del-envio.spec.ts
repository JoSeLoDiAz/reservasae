/** La marca del enlace, y que las dos copias no se separen. */

import { OrigenParticipante } from '../../generated/prisma';
/// Compilado desde el frontend, igual que `enlace-corto.spec.ts`:
/// el backend no lo puede IMPORTAR en producción --su imagen no
/// copia `frontend/src`-- pero el spec sí, y eso es justo lo que
/// deja atar las dos copias.
import { PREFIJOS } from '../../../frontend/src/lib/enlace-corto';
import { marcaDelEnlace } from './enlace-del-envio';

describe('la marca del enlace del envío', () => {
  it('lee el canal y el nombre de un ?mailing-ucc', () => {
    expect(marcaDelEnlace('mailing-ucc')).toEqual({
      campana: 'mailing-ucc',
      origen: OrigenParticipante.CORREO,
    });
  });

  it('da igual cómo venga escrito', () => {
    expect(marcaDelEnlace('Mailing-UCC')?.campana).toBe('mailing-ucc');
  });

  it('whatsapp y reserva tienen su propia palabra en la ficha', () => {
    expect(marcaDelEnlace('whatsapp-feria')?.origen).toBe(
      OrigenParticipante.WHATSAPP,
    );
    expect(marcaDelEnlace('reserva-condor')?.origen).toBe(
      OrigenParticipante.EMPRESA,
    );
  });

  /// El QR no existe en `OrigenParticipante`, y mapearlo a OTRO
  /// --que significa «no sabemos»-- destruiría lo que sí se sabe.
  it('el QR deja su nombre y no toca el origen', () => {
    expect(marcaDelEnlace('qr-feria')).toEqual({
      campana: 'qr-feria',
      origen: null,
    });
  });

  /**
   * LA LÍNEA QUE NO SE CRUZA.
   *
   * `leads.service.ts` lo tiene escrito: «pagado u orgánico lo
   * decide QUIÉN LO MANDA, no el cuerpo. Si viniera en el JSON,
   * quien llama podría marcarse sus propios leads como pauta y la
   * métrica de cuánto cuesta un inscrito dejaría de valer». Esta
   * palabra viene en el cuerpo del POST, así que de `pauta` se
   * toma el NOMBRE y jamás el origen.
   */
  it('de la pauta toma el nombre y NUNCA el origen', () => {
    expect(marcaDelEnlace('pauta0305202255')).toEqual({
      campana: 'pauta0305202255',
      origen: null,
    });
  });

  it('lo que no empieza por un prefijo conocido no dice nada', () => {
    expect(marcaDelEnlace('ucc')).toBeNull();
    expect(marcaDelEnlace('Afiliados')).toBeNull();
    expect(marcaDelEnlace('fbclid')).toBeNull();
    expect(marcaDelEnlace('')).toBeNull();
    expect(marcaDelEnlace(undefined)).toBeNull();
  });

  /// Un enlace corto no admite nada fuera de `[a-z0-9._-]`: sin
  /// esto, cualquier cosa del cuerpo acabaría en una columna que
  /// después se agrupa para liquidar dinero.
  it('rechaza lo que no tiene forma de enlace corto', () => {
    expect(marcaDelEnlace('mailing ucc')).toBeNull();
    expect(marcaDelEnlace('mailing/../ucc')).toBeNull();
    expect(marcaDelEnlace('mailing<script>')).toBeNull();
  });

  /**
   * LAS DOS COPIAS NO SE SEPARAN.
   *
   * La lista de prefijos vive aquí y en
   * `frontend/src/lib/enlace-corto.ts`, y tiene que vivir dos
   * veces: el navegador la necesita para la baliza y el servidor
   * para validar lo que llega. Si alguien añade un canal en el
   * panel y no aquí, ese enlace se repartiría, la baliza lo
   * contaría, y el respaldo --que es el que aguanta cuando la
   * baliza no llega-- lo tiraría en silencio.
   */
  it('conoce EXACTAMENTE los mismos prefijos que el frontend', () => {
    for (const prefijo of Object.keys(PREFIJOS)) {
      expect(marcaDelEnlace(`${prefijo}-algo`)).not.toBeNull();
    }
    /// Y ninguno de más: uno que el frontend no sepa escribir
    /// sería una puerta que solo se abre a mano.
    expect(marcaDelEnlace('inventado-algo')).toBeNull();
  });
});
