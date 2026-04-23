import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

type ChatSidebarSectionProps = {
  children: ReactNode;
};

export const ChatSidebarSection = ({ children }: ChatSidebarSectionProps) => {
  return <StyledSection>{children}</StyledSection>;
};
