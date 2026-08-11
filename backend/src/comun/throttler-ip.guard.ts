import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { ipReal } from './ip-real';

/** Limita por la IP real y no por `req.ip`, que es la de Docker. */
@Injectable()
export class ThrottlerIpGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(ipReal(req));
  }
}
