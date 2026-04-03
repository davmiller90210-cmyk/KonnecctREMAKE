import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useContext, useMemo, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Table } from '@/ui/layout/table/components/Table';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { type WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';
import { CoreObjectNameSingular, SettingsPath } from 'twenty-shared/types';
import {
  generateILikeFiltersForCompositeFields,
  getSettingsPath,
} from 'twenty-shared/utils';
import {
  AppTooltip,
  Avatar,
  H2Title,
  IconChevronRight,
  TooltipDelay,
} from 'twenty-ui/display';
import { SearchInput } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';

import { SettingsRolesQueryEffect } from '@/settings/roles/components/SettingsRolesQueryEffect';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { normalizeSearchText } from '~/utils/normalizeSearchText';

const StyledTableContainer = styled.div<{ hasMoreRows?: boolean }>`
  > div {
    border-bottom: ${({ hasMoreRows }) =>
      hasMoreRows
        ? 'none'
        : `1px solid ${themeCssVariables.border.color.light}`};
  }
`;

const StyledMemberIconWrapper = styled.div`
  align-items: center;
  display: flex;
  margin-right: ${themeCssVariables.spacing[2]};
`;

const StyledTextContainerWithEllipsis = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSearchContainer = styled.div`
  padding-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledTableRows = styled.div`
  padding-bottom: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
`;

const StyledChevronWrapper = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  justify-content: flex-end;
  width: 100%;
`;

export const SettingsWorkspaceMembers = () => {
  const { theme } = useContext(ThemeContext);
  const { t } = useLingui();
  const navigateSettings = useNavigateSettings();
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const [debouncedSearchFilter] = useDebounce(searchFilter, 300);
  const searchServerFilter = useMemo(() => {
    if (!debouncedSearchFilter?.trim()) return undefined;

    const normalizedSearchTerm = normalizeSearchText(debouncedSearchFilter);
    const nameFilters = generateILikeFiltersForCompositeFields(
      normalizedSearchTerm,
      'name',
      ['firstName', 'lastName'],
    );

    return {
      or: [
        ...nameFilters,
        { userEmail: { ilike: `%${normalizedSearchTerm}%` } },
      ],
    };
  }, [debouncedSearchFilter]);

  const {
    records: workspaceMembers,
    fetchMoreRecords,
    hasNextPage,
    loading,
  } = useFindManyRecords<WorkspaceMember>({
    objectNameSingular: CoreObjectNameSingular.WorkspaceMember,
    filter: searchServerFilter,
  });

  const handleSearchChange = (text: string) => {
    setSearchFilter(text);
  };

  const { ref: fetchMoreRef } = useInView({
    onChange: async (inView) => {
      if (inView && hasNextPage && !loading && !isFetchingMore) {
        setIsFetchingMore(true);
        await fetchMoreRecords();
        setIsFetchingMore(false);
      }
    },
    delay: 100,
    rootMargin: '1000px',
    threshold: 0,
  });

  const optimizedWorkspaceMembers = useMemo(() => {
    if (!searchFilter.trim()) {
      return workspaceMembers;
    }

    const normalizedSearchTerm = normalizeSearchText(searchFilter);
    const searchTerms = normalizedSearchTerm.split(/\s+/);

    return workspaceMembers.filter((member) => {
      const firstName = normalizeSearchText(member.name.firstName);
      const lastName = normalizeSearchText(member.name.lastName);
      const email = normalizeSearchText(member.userEmail);
      const fullName = `${firstName} ${lastName}`.trim();

      return searchTerms.every(
        (term) =>
          firstName.includes(term) ||
          lastName.includes(term) ||
          fullName.includes(term) ||
          email.includes(term),
      );
    });
  }, [workspaceMembers, searchFilter]);

  return (
    <>
      <SettingsRolesQueryEffect />
      <SubMenuTopBarContainer
        title={t`Members`}
        links={[
          {
            children: <Trans>Workspace</Trans>,
            href: getSettingsPath(SettingsPath.Workspace),
          },
          { children: <Trans>Members</Trans> },
        ]}
      >
        <SettingsPageContainer>
          <Section>
            <H2Title
              title={t`Inviting people`}
              description={t`New members join through your Clerk organization. Invite them from the Clerk dashboard (or your identity provider), not from this app.`}
            />
          </Section>
          <Section>
            <H2Title
              title={t`Manage Members`}
              description={t`Manage the members of your workspace here`}
            />
            <StyledSearchContainer>
              <SearchInput
                value={searchFilter}
                onChange={handleSearchChange}
                placeholder={t`Search a team member...`}
              />
            </StyledSearchContainer>
            <StyledTableContainer hasMoreRows={hasNextPage}>
              <Table>
                <TableRow
                  gridAutoColumns="150px 1fr 40px"
                  mobileGridAutoColumns="100px 1fr 32px"
                >
                  <TableHeader>
                    <Trans>Name</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Email</Trans>
                  </TableHeader>
                  <TableHeader align="right"></TableHeader>
                </TableRow>
                <StyledTableRows>
                  {optimizedWorkspaceMembers.length > 0 ? (
                    optimizedWorkspaceMembers.map((workspaceMember) => (
                      <TableRow
                        gridAutoColumns="150px 1fr 40px"
                        mobileGridAutoColumns="100px 1fr 32px"
                        key={workspaceMember.id}
                        cursor="pointer"
                        onClick={() => {
                          if (
                            currentWorkspaceMember?.id === workspaceMember.id
                          ) {
                            return;
                          }
                          navigateSettings(SettingsPath.WorkspaceMemberPage, {
                            workspaceMemberId: workspaceMember.id,
                          });
                        }}
                      >
                        <TableCell>
                          <StyledMemberIconWrapper>
                            <Avatar
                              avatarUrl={workspaceMember.avatarUrl}
                              placeholderColorSeed={workspaceMember.id}
                              placeholder={workspaceMember.name.firstName ?? ''}
                              type="rounded"
                              size="sm"
                            />
                          </StyledMemberIconWrapper>
                          <StyledTextContainerWithEllipsis
                            id={`hover-text-${workspaceMember.id}`}
                          >
                            {workspaceMember.name.firstName +
                              ' ' +
                              workspaceMember.name.lastName}
                          </StyledTextContainerWithEllipsis>
                          <AppTooltip
                            anchorSelect={`#hover-text-${workspaceMember.id}`}
                            content={`${workspaceMember.name.firstName} ${workspaceMember.name.lastName}`}
                            noArrow
                            place="top"
                            positionStrategy="fixed"
                            delay={TooltipDelay.shortDelay}
                          />
                        </TableCell>
                        <TableCell>
                          <StyledTextContainerWithEllipsis>
                            {workspaceMember.userEmail}
                          </StyledTextContainerWithEllipsis>
                        </TableCell>
                        <TableCell align="right">
                          <StyledChevronWrapper>
                            {currentWorkspaceMember?.id !==
                              workspaceMember.id && (
                              <IconChevronRight size={theme.icon.size.sm} />
                            )}
                          </StyledChevronWrapper>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableCell color={themeCssVariables.font.color.tertiary}>
                      {!searchFilter
                        ? t`No members`
                        : t`No members match your search`}
                    </TableCell>
                  )}
                </StyledTableRows>
                {hasNextPage && (
                  <TableRow
                    gridAutoColumns="250px 1fr 1fr"
                    mobileGridAutoColumns="100px 1fr 1fr"
                  >
                    <TableCell>
                      <div ref={fetchMoreRef} style={{ height: '1px' }} />
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </Table>
            </StyledTableContainer>
          </Section>
        </SettingsPageContainer>
      </SubMenuTopBarContainer>
    </>
  );
};
