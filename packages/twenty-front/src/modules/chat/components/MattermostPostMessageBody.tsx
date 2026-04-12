import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRecordChip = styled(Link)`
  background: ${themeCssVariables.background.transparent.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: inline;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: 500;
  padding: 0 ${themeCssVariables.spacing[1]};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

function toInAppRecordPath(href: string): string | null {
  const trimmed = href.trim();

  if (trimmed.startsWith('/object/')) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);

    if (u.pathname.startsWith('/object/')) {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    // ignore
  }

  return null;
}

export const MattermostPostMessageBody = ({
  message,
}: {
  message: string | undefined;
}) => {
  const text = message ?? '';
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MD_LINK.source, MD_LINK.flags);
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <span key={`t-${key++}`}>{text.slice(last, match.index)}</span>,
      );
    }

    const label = match[1];
    const href = match[2];
    const inApp = toInAppRecordPath(href);

    if (inApp) {
      nodes.push(
        <StyledRecordChip key={`l-${key++}`} to={inApp}>
          @{label}
        </StyledRecordChip>,
      );
    } else {
      nodes.push(
        <a
          key={`a-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(<span key={`t-${key++}`}>{text.slice(last)}</span>);
  }

  return <span>{nodes}</span>;
};
