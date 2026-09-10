import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // los bytes del logo no viajan por defecto
    super({ omit: { logo: { datos: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
