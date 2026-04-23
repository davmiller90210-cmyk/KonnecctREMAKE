import { ChatConversationListBody } from '@/chat/components/ChatConversationListBody';
import { isChatConversationRailOpenState } from '@/chat/states/isChatConversationRailOpenState';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { IconLayoutSidebarLeftExpand } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const RAIL_WIDTH_PX = 320;

const StyledRail = styled.aside`
  background: ${themeCssVariables.background.primary};
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  width: ${RAIL_WIDTH_PX}px;
`;

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledHeaderActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
`;

export const ChatConversationRail = () => {
  const { t } = useLingui();
  const setRailOpen = useSetAtomState(isChatConversationRailOpenState);
  const setNavExpanded = useSetAtomState(isNavigationDrawerExpandedState);

  const handleClose = () => {
    setRailOpen(false);
    setNavExpanded(true);
  };

  return (
    <StyledRail aria-label={t`Chat conversations`}>
      <StyledHeader>
        <StyledTitle>{t`Chat`}</StyledTitle>
        <StyledHeaderActions>
          <LightIconButton
            Icon={IconLayoutSidebarLeftExpand}
            accent="tertiary"
            size="small"
            aria-label={t`Close chat list and expand CRM navigation`}
            title={t`Close chat list and expand CRM navigation`}
            onClick={handleClose}
          />
        </StyledHeaderActions>
      </StyledHeader>
      <StyledBody>
        <ChatConversationListBody variant="pageColumn" />
      </StyledBody>
    </StyledRail>
  );
};
