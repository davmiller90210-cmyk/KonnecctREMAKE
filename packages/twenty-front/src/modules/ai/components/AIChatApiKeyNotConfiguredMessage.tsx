import { AIChatBanner } from '@/ai/components/AIChatBanner';
import { t } from '@lingui/core/macro';
import { IconExternalLink } from 'twenty-ui/display';

const DOCS_URL =
  'https://twenty.com/developers/section/self-hosting/self-hosting-var#ai-features';

export const AIChatApiKeyNotConfiguredMessage = () => {
  const handleDocsClick = () => {
    window.open(DOCS_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <AIChatBanner
      message={t`AI features are not configured. Please set GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in your environment.`}
      variant="warning"
      buttonTitle={t`View Docs`}
      buttonIcon={IconExternalLink}
      buttonOnClick={handleDocsClick}
    />
  );
};
