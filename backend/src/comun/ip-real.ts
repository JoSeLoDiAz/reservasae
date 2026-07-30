import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * La IP real del usuario NO está en el socket. Detrás del túnel de Cloudflare
 * todas las peticiones parecen venir de la red interna de Docker, así que un
 * límite por IP de socket contaría a todo el mundo como una sola persona.
 *
 * `docker/nginx/default.conf` ya usa `real_ip_header CF-Connecting-IP`, pero
 * aquí se lee la cabecera directamente para no depender de que nginx esté
 * delante: en local no lo está.
 */
export function ipReal(req: Request): string {
  const cloudflare = req.headers['cf-connecting-ip'];
  if (typeof cloudflare === 'string' && cloudflare.trim()) {
    return cloudflare.trim();
  }

  // El primero de la lista es el cliente; los siguientes son los proxies por
  // los que pasó. Tomar el último daría siempre la IP de nginx.
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
