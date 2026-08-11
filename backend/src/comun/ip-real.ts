import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * La IP real llega en `CF-Connecting-IP`, no en el socket.
 *
 * Detrás del túnel todo parece venir de la red de Docker.
 */
export function ipReal(req: Request): string {
  const cloudflare = req.headers['cf-connecting-ip'];
  if (typeof cloudflare === 'string' && cloudflare.trim()) {
    return cloudflare.trim();
  }

  // el primero es el cliente; el resto, proxies
  const reenviada = req.headers['x-forwarded-for'];
  if (typeof reenviada === 'string' && reenviada.trim()) {
    const primera = reenviada.split(',')[0]?.trim();
    if (primera) return primera;
  }

  return req.ip ?? req.socket.remoteAddress ?? 'desconocida';
}

export const IpReal = createParamDecorator((_dato: unknown, contexto: ExecutionContext) =>
  ipReal(contexto.switchToHttp().getRequest<Request>()),
);
