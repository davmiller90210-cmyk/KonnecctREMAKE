import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { PageFocusId } from '@/types/PageFocusId';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Key } from 'ts-key-enum';
import { MainButton } from 'twenty-ui/input';
import { ModalContent } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledBody = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  max-width: 440px;
  text-align: center;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${themeCssVariables.spacing[6]};
  width: 200px;
`;

export const InviteTeam = () => {
  const { t } = useLingui();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();

  const handleContinue = async () => {
    await setNextOnboardingStatus();
  };

  useHotkeysOnFocusedElement({
    keys: Key.Enter,
    callback: () => {
      void handleContinue();
    },
    focusId: PageFocusId.InviteTeam,
    dependencies: [setNextOnboardingStatus],
  });

  return (
    <ModalContent isVerticallyCentered isHorizontallyCentered>
      <Title>
        <Trans>Invite your team in Clerk</Trans>
      </Title>
      <SubTitle>
        <Trans>
          Add teammates from your Clerk organization or identity provider. This
          app no longer sends workspace invitation emails or shareable invite
          links.
        </Trans>
      </SubTitle>
      <StyledBody>
        <Trans>
          When someone joins the right Clerk org, they can sign in here and
          access this workspace.
        </Trans>
      </StyledBody>
      <StyledButtonContainer>
        <MainButton
          title={t`Continue`}
          onClick={() => void handleContinue()}
          fullWidth
        />
      </StyledButtonContainer>
    </ModalContent>
  );
};
