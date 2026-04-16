import { UseGuards } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { SpreadsheetMappingSuggestionDTO } from './dtos/spreadsheet-mapping-suggestion.dto';
import { SuggestSpreadsheetMappingInput } from './dtos/suggest-spreadsheet-mapping.input';
import { SpreadsheetAiService } from './spreadsheet-ai.service';

@UseGuards(WorkspaceAuthGuard, SettingsPermissionGuard(PermissionFlagType.AI))
@MetadataResolver(() => SpreadsheetMappingSuggestionDTO)
export class SpreadsheetAiResolver {
  constructor(private readonly spreadsheetAiService: SpreadsheetAiService) {}

  @Mutation(() => SpreadsheetMappingSuggestionDTO)
  async suggestSpreadsheetMapping(
    @Args('input') input: SuggestSpreadsheetMappingInput,
    @AuthUserWorkspaceId() workspaceId: string,
  ): Promise<SpreadsheetMappingSuggestionDTO> {
    return this.spreadsheetAiService.suggestMapping(
      workspaceId,
      input.objectMetadataId,
      input.headers,
    );
  }
}
