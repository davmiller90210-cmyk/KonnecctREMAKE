import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';

import { SettingsOptionCardContentButton } from '@/settings/components/SettingsOptions/SettingsOptionCardContentButton';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { TabList } from '@/ui/layout/tab-list/components/TabList';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

import { t } from '@lingui/core/macro';
import {
  H2Title,
  IconCpu,
  IconFileText,
  IconRobot,
  IconSettingsBolt,
  IconSparkles,
  IconTool,
} from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { Card, Section } from 'twenty-ui/layout';
import { SettingsAIMCP } from './components/SettingsAIMCP';
import { SettingsAIAgentsTable } from './components/SettingsAIAgentsTable';
import { SettingsAIModelsTab } from './components/SettingsAIModelsTab';
import { SettingsAgentSkills } from './components/SettingsAgentSkills';
import { SettingsToolsTable } from './components/SettingsToolsTable';
import { SETTINGS_AI_TABS } from './constants/SettingsAiTabs';

const StyledLinkContainer = styled.div`
  > a {
    text-decoration: none;
  }
`;

export const SettingsAI = () => {
  const activeTabId = useAtomComponentStateValue(
    activeTabIdComponentState,
    SETTINGS_AI_TABS.COMPONENT_INSTANCE_ID,
  );

  const tabs = [
    {
      id: SETTINGS_AI_TABS.TABS_IDS.AGENTS,
      title: t`Agents`,
      Icon: IconRobot,
    },
    {
      id: SETTINGS_AI_TABS.TABS_IDS.MODELS,
      title: t`Models`,
      Icon: IconCpu,
    },
    {
      id: SETTINGS_AI_TABS.TABS_IDS.SKILLS,
      title: t`Skills`,
      Icon: IconSparkles,
    },
    {
      id: SETTINGS_AI_TABS.TABS_IDS.TOOLS,
      title: t`Tools`,
      Icon: IconTool,
    },
    {
      id: SETTINGS_AI_TABS.TABS_IDS.MORE,
      title: t`More`,
      Icon: IconSettingsBolt,
    },
  ];

  const isAgentsTab = activeTabId === SETTINGS_AI_TABS.TABS_IDS.AGENTS;
  const isModelsTab = activeTabId === SETTINGS_AI_TABS.TABS_IDS.MODELS;
  const isSkillsTab = activeTabId === SETTINGS_AI_TABS.TABS_IDS.SKILLS;
  const isToolsTab = activeTabId === SETTINGS_AI_TABS.TABS_IDS.TOOLS;
  const isMoreTab = activeTabId === SETTINGS_AI_TABS.TABS_IDS.MORE;

  return (
    <SubMenuTopBarContainer
      title={t`Konnecct Agents`}
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: t`Konnecct Agents` },
      ]}
    >
      <SettingsPageContainer>
        <TabList
          tabs={tabs}
          componentInstanceId={SETTINGS_AI_TABS.COMPONENT_INSTANCE_ID}
        />
        {isAgentsTab && (
          <>
            <Section>
              <H2Title
                title={t`Agent hub`}
                description={t`Create and manage AI teammates that can reason, use tools, and execute workspace actions with role-aware permissions.`}
              />
              <Card rounded>
                <SettingsOptionCardContentButton
                  Icon={IconRobot}
                  title={t`Create Konnecct Agent`}
                  description={t`Use natural-language instructions, then refine with advanced settings for tools, role scope, response format, and evaluations.`}
                  Button={
                    <StyledLinkContainer>
                      <Link to={getSettingsPath(SettingsPath.AINewAgent)}>
                        <Button
                          title={t`New Agent`}
                          variant="secondary"
                          size="small"
                        />
                      </Link>
                    </StyledLinkContainer>
                  }
                />
              </Card>
            </Section>
            <Section>
              <H2Title
                title={t`Directory`}
                description={t`Browse all workspace agents, open profiles, and update teammate behaviors.`}
              />
              <Card rounded>
                <SettingsAIAgentsTable />
              </Card>
            </Section>
          </>
        )}
        {isModelsTab && <SettingsAIModelsTab />}
        {isSkillsTab && <SettingsAgentSkills />}
        {isToolsTab && <SettingsToolsTable />}
        {isMoreTab && (
          <>
            <Section>
              <H2Title
                title={t`System Prompt`}
                description={t`View and customize AI instructions`}
              />
              <Card rounded>
                <SettingsOptionCardContentButton
                  Icon={IconFileText}
                  title={t`System Prompt`}
                  description={t`View the AI system prompt and add custom instructions`}
                  Button={
                    <StyledLinkContainer>
                      <Link to={getSettingsPath(SettingsPath.AIPrompts)}>
                        <Button
                          title={t`Configure`}
                          variant="secondary"
                          size="small"
                        />
                      </Link>
                    </StyledLinkContainer>
                  }
                />
              </Card>
            </Section>
            <SettingsAIMCP />
          </>
        )}
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
