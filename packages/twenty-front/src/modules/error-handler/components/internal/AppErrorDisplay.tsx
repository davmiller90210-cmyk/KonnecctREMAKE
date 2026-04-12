import { type AppErrorDisplayProps } from '@/error-handler/types/AppErrorDisplayProps';
import { t } from '@lingui/core/macro';
import { IconRefresh } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/layout';

const formatErrorForUi = (error: AppErrorDisplayProps['error']) => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return '';
  }

  return trimmed.length > 600 ? `${trimmed.slice(0, 600)}…` : trimmed;
};

export const AppErrorDisplay = ({
  error,
  resetErrorBoundary,
  title = t`Sorry, something went wrong`,
}: AppErrorDisplayProps) => {
  const detail = formatErrorForUi(error);

  return (
    <AnimatedPlaceholderEmptyContainer>
      <AnimatedPlaceholder type="errorIndex" />
      <AnimatedPlaceholderEmptyTextContainer>
        <AnimatedPlaceholderEmptyTitle>{title}</AnimatedPlaceholderEmptyTitle>
        <AnimatedPlaceholderEmptySubTitle>
          {t`Please refresh the page.`}
        </AnimatedPlaceholderEmptySubTitle>
        {detail ? (
          <pre
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              margin: '8px 0 0',
              maxWidth: 'min(560px, 92vw)',
              opacity: 0.75,
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {detail}
          </pre>
        ) : null}
      </AnimatedPlaceholderEmptyTextContainer>
      <Button
        Icon={IconRefresh}
        title={t`Reload`}
        variant="secondary"
        onClick={resetErrorBoundary}
      />
    </AnimatedPlaceholderEmptyContainer>
  );
};
