import { gql } from '@apollo/client';

export const SUGGEST_SPREADSHEET_MAPPING = gql`
  mutation SuggestSpreadsheetMapping($input: SuggestSpreadsheetMappingInput!) {
    suggestSpreadsheetMapping(input: $input) {
      mappings {
        sourceHeader
        targetFieldId
        targetFieldName
        confidence
      }
      uidColumn
      namingStrategyColumns
    }
  }
`;
