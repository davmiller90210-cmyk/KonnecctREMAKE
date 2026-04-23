import {
  type EventRowDynamicComponentProps,
  StyledEventRowItemAction,
  StyledEventRowItemColumn,
} from '@/activities/timeline-activities/rows/components/EventRowDynamicComponent';
import { TimelineActivityContext } from '@/activities/timeline-activities/contexts/TimelineActivityContext';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { IconMessage } from 'twenty-ui/display';
import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

type ChatActivityAfter = {
  summary?: string;
  conversationKind?: string;
  conversationId?: string;
  messageId?: string;
};

const StyledMainContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  overflow: hidden;
`;

const StyledItemTitleDate = styled.div`
  @media (max-width: ${MOBILE_VIEWPORT}px) {
    display: none;
  }
  color: ${themeCssVariables.font.color.tertiary};
  padding: 0 ${themeCssVariables.spacing[1]};
`;

const StyledChatLink = styled(Link)`
  color: ${themeCssVariables.color.blue};
  font-weight: ${themeCssVariables.font.weight.medium};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const getChatActivityPayload = (
  event: EventRowDynamicComponentProps['event'],
): ChatActivityAfter | null => {
  const after = event.properties?.diff?.chatActivity?.after as
    | ChatActivityAfter
    | undefined;

  if (after && typeof after === 'object') {
    return after;
  }

  return null;
};

export const EventRowChatActivity = ({
  authorFullName,
  labelIdentifierValue,
  event,
  mainObjectMetadataItem,
  createdAt,
}: EventRowDynamicComponentProps) => {
  const { t } = useLingui();
  const { recordId } = useContext(TimelineActivityContext);
  const payload = getChatActivityPayload(event);
  const summary =
    typeof payload?.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim()
      : event.name === 'record.chat-mentioned'
        ? t`Mentioned in chat`
        : t`Chat linked to record`;

  const conversationKind = payload?.conversationKind;
  const conversationId = payload?.conversationId?.trim();

  const recordQuery =
    recordId && mainObjectMetadataItem?.nameSingular
      ? `recordObjectName=${encodeURIComponent(mainObjectMetadataItem.nameSingular)}&recordId=${encodeURIComponent(recordId)}`
      : '';

  const chatPath =
    conversationKind === 'dm' && conversationId
      ? `/chat/dm/${conversationId}`
      : conversationKind === 'channel' && conversationId
        ? `/chat/c/${conversationId}`
        : null;

  const chatTo =
    chatPath && recordQuery.length > 0
      ? `${chatPath}?${recordQuery}`
      : chatPath;

  const isMention = event.name === 'record.chat-mentioned';

  return (
    <StyledMainContainer>
      <StyledRowContainer>
        <StyledRow>
          <IconMessage size={14} stroke={2} />
          <StyledEventRowItemColumn>{labelIdentifierValue}</StyledEventRowItemColumn>
          <StyledEventRowItemAction>
            {isMention ? t`chat mention ·` : t`chat ·`}
          </StyledEventRowItemAction>
          <StyledEventRowItemColumn>{summary}</StyledEventRowItemColumn>
          <StyledEventRowItemAction>{t`by`}</StyledEventRowItemAction>
          <StyledEventRowItemColumn>{authorFullName}</StyledEventRowItemColumn>
          {chatTo ? (
            <>
              <StyledEventRowItemAction>·</StyledEventRowItemAction>
              <StyledChatLink to={chatTo}>{t`Open in chat`}</StyledChatLink>
            </>
          ) : null}
        </StyledRow>
        <StyledItemTitleDate>{createdAt}</StyledItemTitleDate>
      </StyledRowContainer>
    </StyledMainContainer>
  );
};
