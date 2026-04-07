export type MentionedAgentToken = {
  agentId: string;
  agentLabel: string;
};

const AGENT_TOKEN_REGEX = /\[\[agent:([0-9a-fA-F-]{36}):([^\]]*)]]/;
const RAW_AGENT_TOKEN_REGEX = /\[\[agent:[^\]]*]]/;

export const extractMentionedAgentToken = (
  text: string,
): MentionedAgentToken | null => {
  const match = text.match(AGENT_TOKEN_REGEX);

  if (!match) {
    return null;
  }

  const [, agentId, agentLabel] = match;

  return {
    agentId,
    agentLabel: agentLabel.trim(),
  };
};

export const extractRawMentionedAgentToken = (text: string): string | null => {
  const match = text.match(RAW_AGENT_TOKEN_REGEX);

  return match?.[0] ?? null;
};

export const buildMentionedAgentToken = ({
  agentId,
  agentLabel,
}: MentionedAgentToken) => `[[agent:${agentId}:${agentLabel}]]`;

export const replaceMentionedAgentToken = ({
  text,
  nextToken,
}: {
  text: string;
  nextToken: string;
}) => text.replace(RAW_AGENT_TOKEN_REGEX, nextToken);

export const removeMentionedAgentToken = (text: string) =>
  text.replace(RAW_AGENT_TOKEN_REGEX, '').trim();
