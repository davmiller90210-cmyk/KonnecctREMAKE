import { styled } from '@linaria/react';
import { useCallback, useMemo, useState } from 'react';

import { StepNavigationButton } from '@/spreadsheet-import/components/StepNavigationButton';
import { useSpreadsheetImportInternal } from '@/spreadsheet-import/hooks/useSpreadsheetImportInternal';
import {
  type ImportedRow,
  type ImportedStructuredRow,
} from '@/spreadsheet-import/types';
import { findUnmatchedRequiredFields } from '@/spreadsheet-import/utils/findUnmatchedRequiredFields';
import { normalizeTableData } from '@/spreadsheet-import/utils/normalizeTableData';
import { setColumn } from '@/spreadsheet-import/utils/setColumn';
import { setIgnoreColumn } from '@/spreadsheet-import/utils/setIgnoreColumn';
import { setSubColumn } from '@/spreadsheet-import/utils/setSubColumn';
import { useDialogManager } from '@/ui/feedback/dialog-manager/hooks/useDialogManager';

import { ModalContent } from 'twenty-ui/layout';

import { DO_NOT_IMPORT_OPTION_KEY } from '@/spreadsheet-import/constants/DoNotImportOptionKey';
import { ColumnGrid } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/ColumnGrid';
import { TemplateColumn } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/TemplateColumn';
import { UnmatchColumn } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/UnmatchColumn';
import { UserTableColumn } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/UserTableColumn';
import { initialComputedColumnsSelector } from '@/spreadsheet-import/steps/components/MatchColumnsStep/components/states/initialComputedColumnsState';
import { type SpreadsheetImportStep } from '@/spreadsheet-import/steps/types/SpreadsheetImportStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { type SpreadsheetColumn } from '@/spreadsheet-import/types/SpreadsheetColumn';
import { SpreadsheetColumnType } from '@/spreadsheet-import/types/SpreadsheetColumnType';
import { type SpreadsheetColumns } from '@/spreadsheet-import/types/SpreadsheetColumns';
import { type SpreadsheetImportField } from '@/spreadsheet-import/types/SpreadsheetImportField';
import { useAtomFamilySelectorState } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorState';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import { useMutation } from '@apollo/client/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconBrandGemini } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SUGGEST_SPREADSHEET_MAPPING } from '@/ai/graphql/mutations/suggestSpreadsheetMapping';

const StyledAiBadge = styled.span`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 2px 6px;
`;

const StyledAiButtonContainer = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const StyledAiSuggestion = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledColumn = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.regular};
`;

const StyledColumns = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledColumnsContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

export type MatchColumnsStepProps = {
  currentStepState: SpreadsheetImportStep;
  data: ImportedRow[];
  headerValues: ImportedRow;
  nextStep: () => void;
  onBack?: () => void;
  onError: (message: string) => void;
  setCurrentStepState: (currentStepState: SpreadsheetImportStep) => void;
  setPreviousStepState: (currentStepState: SpreadsheetImportStep) => void;
};

export const MatchColumnsStep = ({
  data,
  headerValues,
  onBack,
  setCurrentStepState,
  setPreviousStepState,
  currentStepState,
  nextStep,
  onError,
}: MatchColumnsStepProps) => {
  const { enqueueDialog } = useDialogManager();
  const dataExample = data.slice(0, 2);
  const { spreadsheetImportFields: fields, availableFieldMetadataItems } = useSpreadsheetImportInternal();
  const [isLoading, setIsLoading] = useState(false);
  const [aiUidColumn, setAiUidColumn] = useState<string | undefined>();
  const [aiNamingColumns, setAiNamingColumns] = useState<string[]>([]);
  const [columns, setColumns] = useAtomFamilySelectorState(
    initialComputedColumnsSelector,
    headerValues,
  );

  const [suggestSpreadsheetMapping] = useMutation<any, any>(SUGGEST_SPREADSHEET_MAPPING);

  const { matchColumnsStepHook } = useSpreadsheetImportInternal();

  const { t } = useLingui();

  const onIgnore = useCallback(
    (columnIndex: number) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index ? setIgnoreColumn(column) : column,
        ),
      );
    },
    [columns, setColumns],
  );

  const onRevertIgnore = useCallback(
    (columnIndex: number) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index ? setColumn(column) : column,
        ),
      );
    },
    [columns, setColumns],
  );

  const onChange = useCallback(
    (value: string, columnIndex: number) => {
      if (value === DO_NOT_IMPORT_OPTION_KEY) {
        if (columns[columnIndex].type === SpreadsheetColumnType.ignored) {
          onRevertIgnore(columnIndex);
        } else {
          onIgnore(columnIndex);
        }
      } else {
        const field = fields.find(
          (field) => field.key === value,
        ) as unknown as SpreadsheetImportField;
        const existingFieldIndex = columns.findIndex(
          (column) => 'value' in column && column.value === field.key,
        );
        setColumns(
          columns.map<SpreadsheetColumn>((column, index) => {
            if (columnIndex === index) {
              return setColumn(column, field, data);
            } else if (index === existingFieldIndex) {
              return setColumn(column);
            } else {
              return column;
            }
          }),
        );
      }
    },
    [columns, onRevertIgnore, onIgnore, fields, setColumns, data],
  );

  const handleContinue = useCallback(
    async (
      values: ImportedStructuredRow[],
      rawData: ImportedRow[],
      columns: SpreadsheetColumns,
    ) => {
      try {
        setIsLoading(true);
        const data = await matchColumnsStepHook(values, rawData, columns);
        setCurrentStepState({
          type: SpreadsheetImportStepType.validateData,
          data,
          importedColumns: columns,
        });
        setPreviousStepState(currentStepState);
        nextStep();
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [
      onError,
      matchColumnsStepHook,
      nextStep,
      setPreviousStepState,
      setCurrentStepState,
      currentStepState,
    ],
  );

  const onSubChange = useCallback(
    (value: string, columnIndex: number, entry: string) => {
      setColumns(
        columns.map((column, index) =>
          columnIndex === index && 'matchedOptions' in column
            ? setSubColumn(column, entry, value)
            : column,
        ),
      );
    },
    [columns, setColumns],
  );

  const handleAiSuggest = useCallback(async () => {
    try {
      setIsLoading(true);
      const objectMetadataId = availableFieldMetadataItems.find(
        (item) => !!item.objectMetadataId,
      )?.objectMetadataId;

      if (!objectMetadataId) {
        throw new Error(
          t`Object metadata ID not found. Please ensure your fields are correctly configured. [V2]`,
        );
      }

      const { data: suggestionData } = await suggestSpreadsheetMapping({
        variables: {
          input: {
            objectMetadataId,
            headers: headerValues as string[],
          },
        },
      });

      const suggestions = suggestionData.suggestSpreadsheetMapping;

      const newColumns = columns.map((column, index) => {
        const suggestion = suggestions.mappings.find(
          (m: any) => m.sourceHeader === headerValues[index],
        );

        if (suggestion && (suggestion.targetFieldId || suggestion.targetFieldName)) {
          const field = fields.find(
            (f) =>
              f.key === suggestion.targetFieldName ||
              f.label === suggestion.targetFieldName ||
              f.key === suggestion.targetFieldId,
          ) as unknown as SpreadsheetImportField;

          if (field) {
            return setColumn(column, field, data);
          }
        }
        return column;
      });

      setColumns(newColumns);
      setAiUidColumn(suggestions.uidColumn);
      setAiNamingColumns(suggestions.namingStrategyColumns);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [
    availableFieldMetadataItems,
    columns,
    data,
    fields,
    headerValues,
    onError,
    setColumns,
    suggestSpreadsheetMapping,
    t,
  ]);

  const unmatchedRequiredFields = useMemo(
    () => findUnmatchedRequiredFields(fields, columns),
    [fields, columns],
  );

  const handleAlertOnContinue = useCallback(async () => {
    setIsLoading(true);
    await handleContinue(
      normalizeTableData(columns, data, fields),
      data,
      columns,
    );
    setIsLoading(false);
  }, [handleContinue, columns, data, fields]);

  const handleOnContinue = useCallback(async () => {
    if (unmatchedRequiredFields.length > 0) {
      enqueueDialog({
        title: t`Not all columns matched`,
        message: t`There are required columns that are not matched or ignored. Do you want to continue?`,
        children: (
          <StyledColumnsContainer>
            <StyledColumns>
              <Trans>Columns not matched:</Trans>
            </StyledColumns>
            {unmatchedRequiredFields.map((field) => (
              <StyledColumn key={field}>{field}</StyledColumn>
            ))}
          </StyledColumnsContainer>
        ),
        buttons: [
          { title: t`Cancel` },
          {
            title: t`Continue`,
            onClick: handleAlertOnContinue,
            variant: 'primary',
            role: 'confirm',
          },
        ],
      });
    } else {
      setIsLoading(true);
      await handleContinue(
        normalizeTableData(columns, data, fields),
        data,
        columns,
      );
      setIsLoading(false);
    }
  }, [
    unmatchedRequiredFields,
    enqueueDialog,
    handleAlertOnContinue,
    handleContinue,
    columns,
    data,
    fields,
    t,
  ]);

  const hasMatchedColumns = columns.some(
    (column) =>
      ![SpreadsheetColumnType.ignored, SpreadsheetColumnType.empty].includes(
        column.type,
      ),
  );

  const onBackConfirmation = () => {
    onBack?.();
    setColumns([]);
  };

  const openRestartDialog = () => {
    enqueueDialog({
      title: t`Restart Import`,
      message: t`You will lose all your mappings.`,
      buttons: [
        { title: t`Cancel` },
        {
          title: t`Restart`,
          onClick: onBackConfirmation,
          accent: 'danger',
          role: 'confirm',
        },
      ],
    });
  };

  return (
    <>
      <StyledAiButtonContainer>
        <StyledAiSuggestion>
          {aiUidColumn && (
            <span>
              <Trans>UID Suggestion:</Trans> <StyledAiBadge>{aiUidColumn}</StyledAiBadge>
            </span>
          )}
          {aiNamingColumns.length > 0 && (
            <span>
              <Trans>Naming Suggestion:</Trans>{' '}
              {aiNamingColumns.map((c) => (
                <StyledAiBadge key={c}>{c}</StyledAiBadge>
              ))}
            </span>
          )}
        </StyledAiSuggestion>
        <Button
          title={t`Magic AI Map`}
          Icon={IconBrandGemini}
          onClick={handleAiSuggest}
          variant="secondary"
          disabled={isLoading}
        />
      </StyledAiButtonContainer>
      <ModalContent noPadding isVerticallyCentered>
        <ScrollWrapper componentInstanceId="scroll-wrapper-modal-content">
          <ColumnGrid
            columns={columns}
            renderUserColumn={(columns, columnIndex) => (
              <UserTableColumn
                column={columns[columnIndex]}
                importedRow={dataExample.map(
                  (row) => row[columns[columnIndex].index],
                )}
              />
            )}
            renderTemplateColumn={(columns, columnIndex) => (
              <TemplateColumn
                columns={columns}
                columnIndex={columnIndex}
                onChange={onChange}
              />
            )}
            renderUnmatchedColumn={(columns, columnIndex) => (
              <UnmatchColumn
                columns={columns}
                columnIndex={columnIndex}
                onSubChange={onSubChange}
              />
            )}
          />
        </ScrollWrapper>
      </ModalContent>
      <StepNavigationButton
        onContinue={handleOnContinue}
        isLoading={isLoading}
        continueTitle={t`Next Step`}
        backTitle={t`Restart Import`}
        onBack={openRestartDialog}
        isContinueDisabled={!hasMatchedColumns}
      />
    </>
  );
};
