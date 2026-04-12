import { Module } from '@nestjs/common';

import { MattermostProvisioningService } from 'src/engine/core-modules/mattermost/mattermost-provisioning.service';

@Module({
  providers: [MattermostProvisioningService],
  exports: [MattermostProvisioningService],
})
export class MattermostModule {}
