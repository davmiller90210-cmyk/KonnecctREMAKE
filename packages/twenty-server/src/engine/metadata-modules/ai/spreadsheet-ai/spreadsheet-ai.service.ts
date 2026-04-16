import { Injectable } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';

import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { SpreadsheetMappingSuggestionDTO } from './dtos/spreadsheet-mapping-suggestion.dto';

@Injectable()
export class SpreadsheetAiService {
  constructor(
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly objectMetadataService: ObjectMetadataService,
  ) {}

  async suggestMapping(
    workspaceId: string,
    objectMetadataId: string,
    headers: string[],
  ): Promise<SpreadsheetMappingSuggestionDTO> {
    const objectMetadata = await this.objectMetadataService.findOneWithinWorkspace(workspaceId, {
      where: { id: objectMetadataId },
    });

    if (!objectMetadata) {
      throw new Error('Object metadata not found');
    }

    const fields = objectMetadata.fields.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      type: f.type,
      description: f.description,
    }));

    const registeredModel = this.aiModelRegistryService.getDefaultPerformanceModel();

    const result = await generateObject({
      model: registeredModel.model,
      schema: z.object({
        mappings: z.array(
          z.object({
            sourceHeader: z.string(),
            targetFieldId: z.string().optional(),
            targetFieldName: z.string().optional(),
            confidence: z.number(),
          }),
        ),
        uidColumn: z.string().optional(),
        namingStrategyColumns: z.array(z.string()),
      }),
      system: `You are an expert CRM data architect. Your task is to map spreadsheet headers to CRM object fields.
Return a JSON object with mappings, a suggested UID column, and columns that should be combined for naming (naming strategy).
Confidence should be between 0 and 1. Only suggest mappings with confidence > 0.5.`,
      prompt: `Target Object: ${objectMetadata.labelSingular} (${objectMetadata.nameSingular})
Available Fields:
${JSON.stringify(fields, null, 2)}

Spreadsheet Headers:
${headers.join(', ')}`,
    });

    return result.object;
  }
}
