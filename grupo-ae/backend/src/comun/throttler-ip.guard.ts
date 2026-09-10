import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

import { ipReal } from './ip-real';

/** Limita por la IP real, no por `req.ip`. */
@Injectable()
export class ThrottlerIpGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(ipReal(req));
  }
}
