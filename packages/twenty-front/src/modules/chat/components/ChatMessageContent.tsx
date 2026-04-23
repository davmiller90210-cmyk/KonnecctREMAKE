import { styled } from '@linaria/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatRecordPreviewChip } from '@/chat/components/ChatRecordPreviewChip';
import { type NativeChatCrmMentionSnapshot } from '@/chat/types/native-chat-message.type';
import {
  parseChatMessage,
  type ChatMentionNode,
  type ChatNode,
} from '@/chat/utils/parseChatMessage';
import { isAllowedChatImageUrl } from '@/chat/utils/isAllowedChatImageUrl';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContent = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledMentionChip = styled.button`
  background: ${themeCssVariables.accent.quaternary};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 0 ${themeCssVariables.spacing[1]};
  text-decoration: none;

  &:hover {
    background: ${themeCssVariables.accent.tertiary};
  }
`;

const StyledLink = styled.a`
  color: ${themeCssVariables.color.blue};
  text-decoration: underline;
  word-break: break-all;
`;

const StyledInlineImage = styled.img`
  border-radius: ${themeCssVariables.border.radius.sm};
  display: block;
  margin-top: ${themeCssVariables.spacing[1]};
  max-height: 200px;
  max-width: min(240px, 100%);
  object-fit: contain;
  vertical-align: middle;
`;

type ChatMessageContentProps = {
  body: string;
  className?: string;
  crmMentionSnapshots?: NativeChatCrmMentionSnapshot[];
};

const renderMention = (
  node: ChatMentionNode,
  index: number,
  navigate: ReturnType<typeof useNavigate>,
  snapshotByKey: Map<string, NativeChatCrmMentionSnapshot>,
) => {
  if (
    node.kind === 'record' &&
    node.objectNameSingular &&
    node.recordId
  ) {
    const snap =
      snapshotByKey.get(
        `${node.objectNameSingular}:${node.recordId}`,
      ) ?? null;
    return (
      <ChatRecordPreviewChip
        key={`${node.objectNameSingular}-${node.recordId}-${index}`}
        objectNameSingular={node.objectNameSingular}
        recordId={node.recordId}
        mentionLabel={node.label}
        snapshot={snap}
      />
    );
  }

  const onClick = () => {
    if (node.kind === 'agent' && node.recordId) {
      navigate(`/superagents/${node.recordId}`);
      return;
    }

    if (node.kind === 'user') {
      return;
    }

    if (node.href && node.href.startsWith('http')) {
      window.open(node.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <StyledMentionChip key={index} onClick={onClick} type="button">
      @{node.label}
    </StyledMentionChip>
  );
};

export const ChatMessageContent = ({
  body,
  className,
  crmMentionSnapshots,
}: ChatMessageContentProps) => {
  const navigate = useNavigate();

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, NativeChatCrmMentionSnapshot>();
    for (const snap of crmMentionSnapshots ?? []) {
      m.set(`${snap.objectNameSingular}:${snap.recordId}`, snap);
    }
    return m;
  }, [crmMentionSnapshots]);

  const nodes = useMemo<ChatNode[]>(() => parseChatMessage(body), [body]);

  return (
    <StyledContent className={className}>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return <span key={index}>{node.value}</span>;
        }

        if (node.type === 'link') {
          return (
            <StyledLink
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {node.label}
            </StyledLink>
          );
        }

        if (node.type === 'image') {
          if (!isAllowedChatImageUrl(node.href)) {
            return (
              <StyledLink
                key={index}
                href={node.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {node.alt?.trim() ? node.alt : node.href}
              </StyledLink>
            );
          }

          return (
            <StyledInlineImage
              key={index}
              src={node.href}
              alt={node.alt?.trim() ? node.alt : 'GIF'}
              loading="lazy"
            />
          );
        }

        if (node.type === 'mention') {
          return renderMention(node, index, navigate, snapshotByKey);
        }

        return null;
      })}
    </StyledContent>
  );
};
