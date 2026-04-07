import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { Select } from '@/ui/input/components/Select';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { TextArea } from '@/ui/input/components/TextArea';
import { H2Title } from 'twenty-ui/display';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export type AgentRuntimeProfile = {
  memoryScope?: 'thread' | 'record' | 'workspace';
  memoryPolicy?: 'append' | 'summarize' | 'ephemeral';
  memoryRetentionDays?: number | null;
  triggerMode?: 'manual' | 'event' | 'schedule' | 'hybrid';
  scheduleCron?: string | null;
  approvalMode?: 'none' | 'destructive' | 'always';
  clarificationMode?: 'low-confidence' | 'permission-denied' | 'always';
  guardrails?: string;
  knowledgeSources?: string;
};

type SettingsAgentOrchestrationProfileProps = {
  value: AgentRuntimeProfile;
  onChange: (value: AgentRuntimeProfile) => void;
  disabled: boolean;
};

const StyledFieldsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const SettingsAgentOrchestrationProfile = ({
  value,
  onChange,
  disabled,
}: SettingsAgentOrchestrationProfileProps) => {
  const { t } = useLingui();

  const update = (partial: Partial<AgentRuntimeProfile>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <Section>
      <H2Title
        title={t`Orchestration profile`}
        description={t`Configure how this teammate remembers context, handles autonomous runs, and requests approval for risky actions.`}
      />
      <StyledFieldsContainer>
        <Select
          dropdownId="agent-memory-scope-select"
          label={t`Memory scope`}
          value={value.memoryScope ?? 'record'}
          options={[
            { label: t`Thread`, value: 'thread' },
            { label: t`Record`, value: 'record' },
            { label: t`Workspace`, value: 'workspace' },
          ]}
          onChange={(newValue) =>
            update({
              memoryScope: newValue as AgentRuntimeProfile['memoryScope'],
            })
          }
          disabled={disabled}
        />
        <Select
          dropdownId="agent-memory-policy-select"
          label={t`Memory policy`}
          value={value.memoryPolicy ?? 'summarize'}
          options={[
            { label: t`Append`, value: 'append' },
            { label: t`Summarize`, value: 'summarize' },
            { label: t`Ephemeral`, value: 'ephemeral' },
          ]}
          onChange={(newValue) =>
            update({
              memoryPolicy: newValue as AgentRuntimeProfile['memoryPolicy'],
            })
          }
          disabled={disabled}
        />
        <SettingsTextInput
          instanceId="agent-memory-retention-days-input"
          label={t`Memory retention (days)`}
          placeholder={t`e.g. 30`}
          value={
            value.memoryRetentionDays === null ||
            typeof value.memoryRetentionDays === 'undefined'
              ? ''
              : String(value.memoryRetentionDays)
          }
          onChange={(newValue) => {
            const parsedValue = Number.parseInt(newValue, 10);

            update({
              memoryRetentionDays:
                newValue.trim() === '' || Number.isNaN(parsedValue)
                  ? null
                  : parsedValue,
            });
          }}
          fullWidth
          disabled={disabled}
        />
        <Select
          dropdownId="agent-trigger-mode-select"
          label={t`Trigger mode`}
          value={value.triggerMode ?? 'hybrid'}
          options={[
            { label: t`Manual`, value: 'manual' },
            { label: t`Event`, value: 'event' },
            { label: t`Schedule`, value: 'schedule' },
            { label: t`Hybrid`, value: 'hybrid' },
          ]}
          onChange={(newValue) =>
            update({ triggerMode: newValue as AgentRuntimeProfile['triggerMode'] })
          }
          disabled={disabled}
        />
        <SettingsTextInput
          instanceId="agent-schedule-cron-input"
          label={t`Schedule (cron)`}
          placeholder={t`e.g. 0 9 * * 1-5`}
          value={value.scheduleCron ?? ''}
          onChange={(newValue) =>
            update({ scheduleCron: newValue.trim() === '' ? null : newValue })
          }
          fullWidth
          disabled={disabled}
        />
        <Select
          dropdownId="agent-approval-mode-select"
          label={t`Approval mode`}
          value={value.approvalMode ?? 'destructive'}
          options={[
            { label: t`No approval`, value: 'none' },
            { label: t`Destructive only`, value: 'destructive' },
            { label: t`Always require approval`, value: 'always' },
          ]}
          onChange={(newValue) =>
            update({
              approvalMode: newValue as AgentRuntimeProfile['approvalMode'],
            })
          }
          disabled={disabled}
        />
        <Select
          dropdownId="agent-clarification-mode-select"
          label={t`Clarification behavior`}
          value={value.clarificationMode ?? 'low-confidence'}
          options={[
            { label: t`Low confidence`, value: 'low-confidence' },
            {
              label: t`Permission denied`,
              value: 'permission-denied',
            },
            { label: t`Always ask`, value: 'always' },
          ]}
          onChange={(newValue) =>
            update({
              clarificationMode:
                newValue as AgentRuntimeProfile['clarificationMode'],
            })
          }
          disabled={disabled}
        />
        <TextArea
          textAreaId="agent-orchestration-knowledge-sources"
          label={t`Knowledge sources`}
          placeholder={t`List docs, notes, records, and conversations this agent should prioritize.`}
          minRows={3}
          value={value.knowledgeSources ?? ''}
          onChange={(newValue) => update({ knowledgeSources: newValue })}
          disabled={disabled}
        />
        <TextArea
          textAreaId="agent-orchestration-guardrails"
          label={t`Guardrails`}
          placeholder={t`Define restrictions, escalation paths, and rollback requirements for risky operations.`}
          minRows={3}
          value={value.guardrails ?? ''}
          onChange={(newValue) => update({ guardrails: newValue })}
          disabled={disabled}
        />
      </StyledFieldsContainer>
    </Section>
  );
};
