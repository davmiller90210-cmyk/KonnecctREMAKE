import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsString, IsUUID } from 'class-validator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class SuggestSpreadsheetMappingInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  objectMetadataId: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  headers: string[];
}
