import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // el logo pesa; se lee con omit: { logoDatos: false }
    super({ omit: { formulario: { logoDatos: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
