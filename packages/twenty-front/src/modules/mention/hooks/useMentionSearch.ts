import { SEARCH_QUERY } from '@/command-menu/graphql/queries/search';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { filterReadableActiveObjectMetadataItems } from '@/object-metadata/utils/filterReadableActiveObjectMetadataItems';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useCallback, useMemo } from 'react';
import {
  type SearchQuery,
  type SearchQueryVariables,
} from '~/generated/graphql';
import { FindManyAgentsDocument } from '~/generated-metadata/graphql';
import type { MentionSearchResult } from '@/mention/types/MentionSearchResult';
import { normalizeSearchText } from '~/utils/normalizeSearchText';

const MENTION_SEARCH_LIMIT = 50;

export const useMentionSearch = () => {
  const { activeObjectMetadataItems } = useFilteredObjectMetadataItems();
  const apolloCoreClient = useApolloCoreClient();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();

  const searchableObjectMetadataItems = useMemo(
    () =>
      filterReadableActiveObjectMetadataItems(
        activeObjectMetadataItems,
        objectPermissionsByObjectMetadataId,
      ).filter((item) => !item.isSystem && item.isSearchable),
    [activeObjectMetadataItems, objectPermissionsByObjectMetadataId],
  );

  const objectsToSearch = useMemo(
    () => searchableObjectMetadataItems.map(({ nameSingular }) => nameSingular),
    [searchableObjectMetadataItems],
  );

  const searchMentionRecords = useCallback(
    async (query: string): Promise<MentionSearchResult[]> => {
      const { data } = await apolloCoreClient.query<
        SearchQuery,
        SearchQueryVariables
      >({
        query: SEARCH_QUERY,
        variables: {
          searchInput: query,
          limit: MENTION_SEARCH_LIMIT,
          includedObjectNameSingulars: objectsToSearch,
        },
      });

      const searchRecords = data?.search.edges.map((edge) => edge.node) ?? [];
      const { data: agentsData } = await apolloCoreClient.query({
        query: FindManyAgentsDocument,
      });

      const normalizedQuery = normalizeSearchText(query);
      const matchedAgents = (agentsData?.findManyAgents ?? [])
        .filter(
          (agent) =>
            normalizeSearchText(agent.label).includes(normalizedQuery) ||
            normalizeSearchText(agent.name).includes(normalizedQuery),
        )
        .map((agent) => ({
          // Keep exact assigned Superagent portrait in mention chips.
          imageUrl:
            (agent.modelConfiguration as
              | {
                  superagentProfile?: {
                    imageUrl?: string;
                  };
                }
              | null
              | undefined)?.superagentProfile?.imageUrl ?? '',
          mentionType: 'agent' as const,
          recordId: agent.id,
          objectNameSingular: 'agent',
          objectLabelSingular: 'Agent',
          label: agent.label,
        }));

      return [
        ...matchedAgents,
        ...searchRecords.map((searchRecord) => ({
          mentionType: 'record' as const,
          recordId: searchRecord.recordId,
          objectNameSingular: searchRecord.objectNameSingular,
          objectLabelSingular: searchRecord.objectLabelSingular,
          label: searchRecord.label,
          imageUrl: searchRecord.imageUrl ?? '',
        })),
      ];
    },
    [apolloCoreClient, objectsToSearch],
  );

  return { searchMentionRecords, searchableObjectMetadataItems };
};
