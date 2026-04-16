import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MappingPairDTO {
  @Field()
  sourceHeader: string;

  @Field({ nullable: true })
  targetFieldId?: string;

  @Field({ nullable: true })
  targetFieldName?: string;

  @Field(() => Number)
  confidence: number;
}

@ObjectType()
export class SpreadsheetMappingSuggestionDTO {
  @Field(() => [MappingPairDTO])
  mappings: MappingPairDTO[];

  @Field({ nullable: true })
  uidColumn?: string;

  @Field(() => [String], { defaultValue: [] })
  namingStrategyColumns: string[];
}
