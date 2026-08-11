import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { Estado } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // publicamente es /api/estado
  @Get('estado')
  getEstado(): Estado {
    return this.appService.getEstado();
  }
}
