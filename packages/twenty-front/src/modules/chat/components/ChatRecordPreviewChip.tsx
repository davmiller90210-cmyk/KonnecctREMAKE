import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useLazyFindOneRecord } from '@/object-record/hooks/useLazyFindOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  getCachedChatRecordPreview,
  setCachedChatRecordPreview,
} from '@/chat/utils/chatRecordPreviewCache';
import { withChatRecordPreviewSlot } from '@/chat/utils/chatRecordPreviewConcurrency';
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
};

export const ChatRecordPreviewChip = ({
  objectNameSingular,
  recordId,
  mentionLabel,
}: ChatRecordPreviewChipProps) => {
  const { t } = useLingui();
  const navigate = useNavigate();
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

  const objectLabel = objectMetadataItem?.labelSingular ?? objectNameSingular;

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
    if (!visible || record || !recordId || !objectMetadataItem) {
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
    visible,
  ]);

  const title = useMemo(
    () => resolveTitle(record, mentionLabel),
    [mentionLabel, record],
  );

  const openRecord = () => {
    const path = getAppPath(AppPath.RecordShowPage, {
      objectNameSingular,
      objectRecordId: recordId,
    });
    navigate(path);
  };

  return (
    <div ref={rootRef}>
      <StyledMentionChip type="button" onClick={openRecord}>
        @{mentionLabel}
      </StyledMentionChip>
      {visible ? (
        <StyledCard>
          <StyledMeta>{objectLabel}</StyledMeta>
          <StyledTitle>
            {loading && !record ? t`Loading…` : title}
          </StyledTitle>
          <Button
            title={t`Open record`}
            variant="secondary"
            size="small"
            accent="blue"
            onClick={openRecord}
          />
        </StyledCard>
      ) : null}
    </div>
  );
};
