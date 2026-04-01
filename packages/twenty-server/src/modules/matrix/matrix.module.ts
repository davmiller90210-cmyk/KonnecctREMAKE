import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { MatrixAuthService } from 'src/modules/matrix/matrix-auth.service';
import { MatrixAuthController } from 'src/modules/matrix/matrix-auth.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

/**
 * MatrixModule
 *
 * Provides the server-side bridge between the Konnecct CRM identity layer
 * and the Matrix (Synapse) homeserver.
 *
 * Architecture:
 * - MatrixAuthService provisions Matrix accounts using the registration shared secret.
 *   This secret NEVER leaves the server. The frontend only receives a short-lived
 *   Matrix access token fetched via the /matrix/token endpoint after CRM authentication.
 * - MatrixAuthController exposes /matrix/token, protected by the CRM's existing JWT guard.
 *
 * The CRM WorkspaceMember ID is used as the stable identifier for Matrix accounts,
 * formatted as @crm_<workspaceMemberId>:app.konnecct.com
 */
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    AuthModule,
    WorkspaceCacheStorageModule,
  ],
  providers: [MatrixAuthService],
  controllers: [MatrixAuthController],
  exports: [MatrixAuthService],
})
export class MatrixModule {}
