import { SEARCH_QUERY } from '@/command-menu/graphql/queries/search';
import { ApolloCoreClientContext } from '@/object-metadata/contexts/ApolloCoreClientContext';
import { flatObjectMetadataItemsSelector } from '@/object-metadata/states/flatObjectMetadataItemsSelector';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useApolloClient } from '@apollo/client/react';
import { useCallback, useContext, useMemo } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  type SearchQuery,
  type SearchQueryVariables,
} from '~/generated/graphql';
import { FindManyAgentsDocument } from '~/generated-metadata/graphql';
import type { MentionSearchResult } from '@/mention/types/MentionSearchResult';
import { normalizeSearchText } from '~/utils/normalizeSearchText';

const MENTION_SEARCH_LIMIT = 50;

/**
 * Universal CRM @mention search for any chat composer (Sendbird, or future providers).
 * Searches CRM records (contacts, leads, companies, deals, etc.) + AI agents.
 * Returns backend-agnostic MentionSearchResult items.
 */
export const useCrmMentionSearch = () => {
  const flatObjectMetadataItems =
    useAtomStateValue(flatObjectMetadataItemsSelector) ?? [];
  const apolloCoreClient = useContext(ApolloCoreClientContext);
  const apolloMetadataClient = useApolloClient();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();

  const objectsToSearch = useMemo(() => {
    const list = flatObjectMetadataItems.filter((objectMetadataItem) => {
      if (!objectMetadataItem.isActive) {
        return false;
      }

      const objectPermissions =
        objectPermissionsByObjectMetadataId[objectMetadataItem.id];

      if (!isDefined(objectPermissions)) {
        return true;
      }

      return objectPermissions.canReadObjectRecords;
    });

    return list
      .filter((item) => !item.isSystem && item.isSearchable)
      .map(({ nameSingular }) => nameSingular);
  }, [flatObjectMetadataItems, objectPermissionsByObjectMetadataId]);

  const searchMentionRecords = useCallback(
    async (query: string): Promise<MentionSearchResult[]> => {
      if (!apolloCoreClient) {
        return [];
      }

      try {
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
        const { data: agentsData } = await apolloMetadataClient.query({
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
      } catch {
        return [];
      }
    },
    [apolloCoreClient, apolloMetadataClient, objectsToSearch],
  );

  return { searchMentionRecords };
};
