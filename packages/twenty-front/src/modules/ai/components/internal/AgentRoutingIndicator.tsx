import { agentChatInputState } from '@/ai/states/agentChatInputState';
import {
  buildMentionedAgentToken,
  extractMentionedAgentToken,
  extractRawMentionedAgentToken,
  removeMentionedAgentToken,
  replaceMentionedAgentToken,
} from '@/ai/utils/extractMentionedAgentToken';
import { Select } from '@/ui/input/components/Select';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { t } from '@lingui/core/macro';
import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useQuery } from '@apollo/client/react';
import { IconRobot, IconX } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { FindManyAgentsDocument } from '~/generated-metadata/graphql';

const StyledContainer = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledContent = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
  width: 100%;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledWarning = styled.span`
  color: ${themeCssVariables.color.orange};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

export const AgentRoutingIndicator = () => {
  const [chatInput, setChatInput] = useAtomState(agentChatInputState);
  const mentionedAgent = extractMentionedAgentToken(chatInput);
  const rawMentionToken = extractRawMentionedAgentToken(chatInput);
  const { data } = useQuery(FindManyAgentsDocument);

  if (!rawMentionToken) {
    return null;
  }

  const agents = data?.findManyAgents ?? [];
  const hasValidAgentToken = mentionedAgent !== null;
  const selectedAgent = hasValidAgentToken
    ? agents.find((agent) => agent.id === mentionedAgent.agentId)
    : null;
  const isUnresolvable = hasValidAgentToken && !selectedAgent;
  const isMalformed = !hasValidAgentToken;

  const displayName = isNonEmptyString(mentionedAgent?.agentLabel ?? '')
    ? mentionedAgent?.agentLabel
    : selectedAgent?.label ?? t`selected agent`;

  const handleRemove = () => {
    setChatInput(removeMentionedAgentToken(chatInput));
  };

  const handleSwap = (nextAgentId: string | null) => {
    if (!isNonEmptyString(nextAgentId)) {
      return;
    }

    const nextAgent = agents.find((agent) => agent.id === nextAgentId);

    if (!nextAgent) {
      return;
    }

    const nextToken = buildMentionedAgentToken({
      agentId: nextAgent.id,
      agentLabel: nextAgent.label,
    });

    setChatInput(
      replaceMentionedAgentToken({
        text: chatInput,
        nextToken,
      }),
    );
  };

  return (
    <StyledContainer>
      <StyledContent>
        <IconRobot size={16} />
        <StyledLabel>{t`Routing to ${displayName}`}</StyledLabel>
        <StyledActions>
          {hasValidAgentToken && (
            <Select
              dropdownId="chat-agent-routing-swap-select"
              value={selectedAgent?.id ?? null}
              onChange={handleSwap}
              options={agents.map((agent) => ({
                value: agent.id,
                label: agent.label,
              }))}
              placeholder={t`Swap`}
              selectSizeVariant="small"
            />
          )}
          <LightIconButton
            Icon={IconX}
            title={t`Remove routing`}
            accent="tertiary"
            onClick={handleRemove}
          />
        </StyledActions>
      </StyledContent>
      {(isMalformed || isUnresolvable) && (
        <StyledWarning>
          {t`Agent unavailable or malformed token. Default routing will be used.`}
        </StyledWarning>
      )}
    </StyledContainer>
  );
};
