import { type TimelineActivity } from '@/activities/timeline-activities/types/TimelineActivity';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import {
  IconCirclePlus,
  IconEditCircle,
  IconMessage,
  IconRestore,
  IconTrash,
  useIcons,
} from 'twenty-ui/display';

export const EventIconDynamicComponent = ({
  event,
  linkedObjectMetadataItem,
}: {
  event: TimelineActivity;
  linkedObjectMetadataItem: EnrichedObjectMetadataItem | null;
}) => {
  const { getIcon } = useIcons();
  const [, eventAction] = event.name.split('.');

  if (
    event.name === 'record.chat-linked' ||
    event.name === 'record.chat-mentioned' ||
    Boolean(event.properties?.diff?.chatActivity)
  ) {
    return <IconMessage />;
  }

  if (eventAction === 'created') {
    return <IconCirclePlus />;
  }
  if (eventAction === 'updated') {
    return <IconEditCircle />;
  }
  if (eventAction === 'deleted') {
    return <IconTrash />;
  }
  if (eventAction === 'restored') {
    return <IconRestore />;
  }

  const IconComponent = getIcon(linkedObjectMetadataItem?.icon);

  return <IconComponent />;
};
