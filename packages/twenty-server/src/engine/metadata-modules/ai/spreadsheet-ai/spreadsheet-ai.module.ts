import { Module } from '@nestjs/common';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { SpreadsheetAiResolver } from './spreadsheet-ai.resolver';
import { SpreadsheetAiService } from './spreadsheet-ai.service';

@Module({
  imports: [AiModelsModule, ObjectMetadataModule],
  providers: [SpreadsheetAiService, SpreadsheetAiResolver],
  exports: [SpreadsheetAiService],
})
export class SpreadsheetAiModule {}
