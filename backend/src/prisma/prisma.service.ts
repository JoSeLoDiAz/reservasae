import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // el logo no viaja por defecto
    super({ omit: { formulario: { logoDatos: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
