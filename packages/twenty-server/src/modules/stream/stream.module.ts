import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AgoraModule } from 'src/modules/agora/agora.module';

import { StreamAuthController } from './stream-auth.controller';
import { StreamAuthService } from './stream-auth.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    JwtModule.register({}),
    AgoraModule,
  ],
  providers: [StreamAuthService],
  controllers: [StreamAuthController],
  exports: [StreamAuthService],
})
export class StreamModule {}
