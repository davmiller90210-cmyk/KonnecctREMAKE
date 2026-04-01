import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { MatrixAuthService } from './matrix-auth.service';
import { MatrixAuthController } from './matrix-auth.controller';

/**
 * MatrixModule
 *
 * Provides the server-side bridge between the Konnecct CRM identity layer
 * and the Matrix (Synapse) homeserver.
 */
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  providers: [MatrixAuthService],
  controllers: [MatrixAuthController],
  exports: [MatrixAuthService],
})
export class MatrixModule {}
