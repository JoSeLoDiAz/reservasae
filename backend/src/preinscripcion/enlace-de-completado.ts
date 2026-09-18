/** El enlace con el que alguien termina de llenar su ficha. */

/// Vive aparte del servicio de preinscripcion, igual que
/// `ColaRui`: emitirlo y leerlo no es mas que escribir y leer
/// una fila. Separarlo deja que el CORREO lo use sin arrastrar
/// el modulo de preinscripcion entero -- que importa al de
/// correo, y ese circulo no deja arrancar a Nest.

import { Injectable, Module } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

/// Quince dias. Lo que dura un enlace de un solo uso.
export const DIAS_DE_VIDA = 15;

@Injectable()
export class EnlaceDeCompletado {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El que esta vivo ahora mismo, o ninguno.
   *
   * Las condiciones son las MISMAS que las de
   * `exigirEnlaceVivo`, incluido el `>=`: si aqui sobrara uno
   * que alla se rechaza, el correo llevaria una direccion que
   * no abre.
   *
   * `findFirst` y no `findUnique` a proposito: que solo haya
   * uno vivo lo sostiene el `updateMany` de `emitir`, no la
   * base.
   */
  async vivo(participanteId: string) {
    return this.prisma.enlaceCompletado.findFirst({
      where: {
        participanteId,
        usadoEn: null,
        anuladoEn: null,
        expiraEn: { gte: new Date() },
      },
      orderBy: { creadoEn: 'desc' },
      select: { token: true, expiraEn: true },
    });
  }

  /**
   * El vivo si lo hay, y si no uno nuevo.
   *
   * Es lo que tiene que llamar cualquier cosa que solo quiera
   * MANDAR el enlace. Emitir uno nuevo es una decision --la
   * toma el asesor desde la ficha, y el panel le avisa de que
   * el anterior deja de servir--, no un efecto secundario de
   * mandar un correo.
   *
   * Sin esto, el correo de preinscripcion mataria el enlace
   * del boton de la pantalla de gracias, que es el MISMO
   * token: la persona lo tendria abierto en una pestana y
   * dejaria de abrir sin que nadie se entere.
   */
  async emitirOReusar(participanteId: string, emitidoPorId: string | null) {
    return (
      (await this.vivo(participanteId)) ??
      (await this.emitir(participanteId, emitidoPorId))
    );
  }

  /** Uno nuevo, y el anterior deja de servir. */
  async emitir(participanteId: string, emitidoPorId: string | null) {
    return this.crear(participanteId, emitidoPorId, false);
  }

  /** El que da el registro público. */
  async emitirAlRegistrarse(participanteId: string) {
    return this.crear(participanteId, null, true);
  }

  private async crear(
    participanteId: string,
    emitidoPorId: string | null,
    delRegistro: boolean,
  ) {
    const ahora = new Date();
    // «anulado», no «usado»: los dos lo dejan sin valor, pero
    // dicen cosas distintas. Marcar como usado un enlace que
    // nadie abrio hacia creer que la persona lo completo.
    await this.prisma.enlaceCompletado.updateMany({
      where: { participanteId, usadoEn: null, anuladoEn: null },
      data: { anuladoEn: ahora },
    });

    const expiraEn = new Date(ahora.getTime() + DIAS_DE_VIDA * 86_400_000);
    return this.prisma.enlaceCompletado.create({
      data: {
        // 32 bytes: no se adivina probando
        token: randomBytes(32).toString('base64url'),
        participanteId,
        expiraEn,
        emitidoPorId,
        delRegistro,
      },
      select: { token: true, expiraEn: true },
    });
  }
}

/// PrismaModule es @Global: no hay que importarlo.
@Module({
  providers: [EnlaceDeCompletado],
  exports: [EnlaceDeCompletado],
})
export class EnlaceDeCompletadoModule {}
