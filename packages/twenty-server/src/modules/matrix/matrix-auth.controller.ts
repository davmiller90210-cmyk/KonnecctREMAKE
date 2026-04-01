import { Controller, Get } from '@nestjs/common';

@Controller('matrix')
export class MatrixAuthController {
  @Get('health')
  health() {
    return { status: 'ok', message: 'Matrix controller is alive' };
  }
}
