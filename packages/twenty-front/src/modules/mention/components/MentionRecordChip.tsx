import { getLinkToShowPage } from '@/object-metadata/utils/getLinkToShowPage';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import {
  AvatarOrIcon,
  Chip,
  ChipVariant,
  LinkChip,
} from 'twenty-ui/components';

type MentionRecordChipProps = {
  recordId: string;
  objectNameSingular: string;
  label: string;
  imageUrl: string;
  className?: string;
};

export const MentionRecordChip = ({
  recordId,
  objectNameSingular,
  label,
  imageUrl,
  className,
}: MentionRecordChipProps) => {
  if (!isNonEmptyString(objectNameSingular)) {
    return (
      <Chip
        label={t`Unknown object`}
        variant={ChipVariant.Transparent}
        disabled
      />
    );
  }

  if (!isNonEmptyString(recordId)) {
    return (
      <Chip
        label={t`Deleted record`}
        variant={ChipVariant.Transparent}
        disabled
      />
    );
  }

  if (objectNameSingular === 'agent') {
    return (
      <LinkChip
        label={label}
        emptyLabel={t`Untitled`}
        to={getSettingsPath(SettingsPath.AIAgentDetail, { agentId: recordId })}
        variant={ChipVariant.Highlighted}
        className={className}
        leftComponent={
          <AvatarOrIcon
            placeholder={label}
            placeholderColorSeed={recordId}
            avatarType="rounded"
            avatarUrl={imageUrl}
          />
        }
      />
    );
  }

  const linkToShowPage = getLinkToShowPage(objectNameSingular, {
    id: recordId,
  });

  return (
    <LinkChip
      label={label}
      emptyLabel={t`Untitled`}
      to={linkToShowPage}
      variant={ChipVariant.Highlighted}
      className={className}
      leftComponent={
        <AvatarOrIcon
          placeholder={label}
          placeholderColorSeed={recordId}
          avatarType="rounded"
          avatarUrl={imageUrl}
        />
      }
    />
  );
};
