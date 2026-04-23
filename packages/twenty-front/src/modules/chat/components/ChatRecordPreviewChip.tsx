import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { type NativeChatCrmMentionSnapshot } from '@/chat/types/native-chat-message.type';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useLazyFindOneRecord } from '@/object-record/hooks/useLazyFindOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useOpenRecordInSidePanel } from '@/side-panel/hooks/useOpenRecordInSidePanel';
import {
  getCachedChatRecordPreview,
  setCachedChatRecordPreview,
} from '@/chat/utils/chatRecordPreviewCache';
import { withChatRecordPreviewSlot } from '@/chat/utils/chatRecordPreviewConcurrency';
import { Avatar } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
  max-width: 320px;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledCardHeader = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledCardText = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledOwner = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
`;

const resolveTitle = (record: ObjectRecord | undefined, fallback: string) => {
  if (!record) {
    return fallback;
  }
  const r = record as Record<string, unknown>;
  const name = r.name;
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }
  const title = r.title;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }
  return fallback;
};

type ChatRecordPreviewChipProps = {
  objectNameSingular: string;
  recordId: string;
  mentionLabel: string;
  snapshot?: NativeChatCrmMentionSnapshot | null;
};

export const ChatRecordPreviewChip = ({
  objectNameSingular,
  recordId,
  mentionLabel,
  snapshot,
}: ChatRecordPreviewChipProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { openRecordInSidePanel } = useOpenRecordInSidePanel();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [record, setRecord] = useState<ObjectRecord | undefined>(() =>
    getCachedChatRecordPreview(objectNameSingular, recordId),
  );
  const [loading, setLoading] = useState(false);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { findOneRecord } = useLazyFindOneRecord({
    objectNameSingular,
  });

  const restricted = Boolean(snapshot?.restricted);
  const snapshotTitle =
    snapshot && !restricted && snapshot.displayName.trim()
      ? snapshot.displayName.trim()
      : null;
  const snapshotOwner =
    snapshot && !restricted && snapshot.ownerDisplayLabel?.trim()
      ? snapshot.ownerDisplayLabel.trim()
      : null;

  const objectLabel =
    snapshot && !restricted && snapshot.objectLabel.trim()
      ? snapshot.objectLabel
      : (objectMetadataItem?.labelSingular ?? objectNameSingular);

  const skipLiveFetch =
    restricted ||
    Boolean(
      snapshot &&
        !restricted &&
        snapshot.displayName.trim() &&
        snapshot.objectLabel.trim(),
    );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
        }
      },
      { root: null, rootMargin: '120px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible || skipLiveFetch || record || !recordId || !objectMetadataItem) {
      return;
    }
    const cached = getCachedChatRecordPreview(objectNameSingular, recordId);
    if (cached) {
      setRecord(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        await withChatRecordPreviewSlot(async () => {
          await findOneRecord({
            objectRecordId: recordId,
            onCompleted: (fetched) => {
              if (cancelled) {
                return;
              }
              setCachedChatRecordPreview(objectNameSingular, recordId, fetched);
              setRecord(fetched);
            },
          });
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    findOneRecord,
    objectMetadataItem,
    objectNameSingular,
    record,
    recordId,
    skipLiveFetch,
    visible,
  ]);

  const title = useMemo(
    () => snapshotTitle ?? resolveTitle(record, mentionLabel),
    [mentionLabel, record, snapshotTitle],
  );

  const ownerLine = useMemo(() => {
    if (restricted) {
      return null;
    }
    if (snapshotOwner) {
      return snapshotOwner;
    }
    return null;
  }, [restricted, snapshotOwner]);

  const avatarUrl =
    snapshot && !restricted && snapshot.imageUrl?.trim()
      ? snapshot.imageUrl.trim()
      : null;

  const openFullRecord = () => {
    const path = getAppPath(AppPath.RecordShowPage, {
      objectNameSingular,
      objectRecordId: recordId,
    });
    navigate(path);
  };

  const openPeek = () => {
    if (restricted) {
      return;
    }
    try {
      openRecordInSidePanel({ objectNameSingular, recordId });
    } catch {
      openFullRecord();
    }
  };

  return (
    <div ref={rootRef}>
      <StyledMentionChip
        type="button"
        onClick={openPeek}
        disabled={restricted}
        title={
          restricted
            ? undefined
            : t`Open record preview`
        }
      >
        @{mentionLabel}
      </StyledMentionChip>
      {visible ? (
        <StyledCard>
          {restricted ? (
            <>
              <StyledMeta>{objectLabel}</StyledMeta>
              <StyledTitle>{t`Restricted`}</StyledTitle>
              <StyledOwner>
                {t`You don’t have access to this record.`}
              </StyledOwner>
            </>
          ) : (
            <>
              <StyledCardHeader>
                <Avatar
                  size="md"
                  placeholder={title}
                  avatarUrl={avatarUrl}
                />
                <StyledCardText>
                  <StyledMeta>{objectLabel}</StyledMeta>
                  <StyledTitle>
                    {loading && !snapshotTitle && !record
                      ? t`Loading…`
                      : title}
                  </StyledTitle>
                  {ownerLine ? (
                    <StyledOwner>
                      {`${t`Owner`}: ${ownerLine}`}
                    </StyledOwner>
                  ) : null}
                </StyledCardText>
              </StyledCardHeader>
              <StyledActions>
                <Button
                  title={t`Preview in side panel`}
                  variant="secondary"
                  size="small"
                  accent="blue"
                  onClick={openPeek}
                />
                <Button
                  title={t`Open full record`}
                  variant="secondary"
                  size="small"
                  accent="blue"
                  onClick={openFullRecord}
                />
              </StyledActions>
            </>
          )}
        </StyledCard>
      ) : null}
    </div>
  );
};
