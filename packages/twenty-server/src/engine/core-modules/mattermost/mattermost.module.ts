import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MattermostBridgeService } from 'src/engine/core-modules/mattermost/mattermost-bridge.service';
import { MattermostProvisioningService } from 'src/engine/core-modules/mattermost/mattermost-provisioning.service';
import { MattermostUserCredentialEntity } from 'src/engine/core-modules/mattermost/mattermost-user-credential.entity';
import { SecretEncryptionModule } from 'src/engine/core-modules/secret-encryption/secret-encryption.module';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MattermostUserCredentialEntity,
      UserEntity,
    ]),
    SecretEncryptionModule,
  ],
  providers: [MattermostProvisioningService, MattermostBridgeService],
  exports: [MattermostProvisioningService, MattermostBridgeService],
})
export class MattermostModule {}
