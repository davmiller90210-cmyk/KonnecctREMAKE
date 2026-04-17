import { AIChatBanner } from '@/ai/components/AIChatBanner';
import { t } from '@lingui/core/macro';

export const AIChatApiKeyNotConfiguredMessage = () => {
  return (
    <AIChatBanner
      message={t`KonnecctAI is temporarily unavailable. Please try again later or contact your administrator.`}
      variant="warning"
    />
  );
};

