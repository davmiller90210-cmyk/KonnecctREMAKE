import { styled } from '@linaria/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { parseChatMessage, type ChatNode } from '@/chat/utils/parseChatMessage';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContent = styled.span`
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

type ChatMessageContentProps = {
  body: string;
  className?: string;
};

export const ChatMessageContent = ({
  body,
  className,
}: ChatMessageContentProps) => {
  const navigate = useNavigate();

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

        const onClick = () => {
          if (node.kind === 'record' && node.objectNameSingular && node.recordId) {
            const path = getAppPath(AppPath.RecordShowPage, {
              objectNameSingular: node.objectNameSingular,
              objectRecordId: node.recordId,
            });
            navigate(path);
            return;
          }

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
      })}
    </StyledContent>
  );
};
