import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSection = styled.section<{ $elevated: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $elevated }) => ($elevated ? '3px' : '2px')};
  margin-bottom: ${({ $elevated }) =>
    $elevated ? themeCssVariables.spacing[1] : themeCssVariables.spacing[2]};
`;

type ChatSidebarSectionProps = {
  children: ReactNode;
  surface?: 'default' | 'elevated';
};

export const ChatSidebarSection = ({
  children,
  surface = 'default',
}: ChatSidebarSectionProps) => {
  return (
    <StyledSection $elevated={surface === 'elevated'}>{children}</StyledSection>
  );
};
