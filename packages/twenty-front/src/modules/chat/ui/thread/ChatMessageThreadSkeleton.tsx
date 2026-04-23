import { styled } from '@linaria/react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  min-height: 0;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledAvatar = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: 50%;
  flex-shrink: 0;
  height: 36px;
  width: 36px;
`;

const StyledBlock = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledLine = styled.div<{ $width: string }>`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  height: 10px;
  max-width: ${({ $width }) => $width};
  opacity: 0.72;
`;

const StyledMeta = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMetaShort = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  height: 8px;
  opacity: 0.72;
  width: 120px;
`;

type ChatMessageThreadSkeletonProps = {
  rows?: number;
};

export const ChatMessageThreadSkeleton = ({
  rows = 6,
}: ChatMessageThreadSkeletonProps) => {
  return (
    <StyledRoot aria-busy aria-label="Loading messages">
      {Array.from({ length: rows }).map((_, index) => (
        <StyledRow key={index}>
          <StyledAvatar />
          <StyledBlock>
            <StyledMeta>
              <StyledMetaShort />
            </StyledMeta>
            <StyledLine $width="92%" />
            <StyledLine $width={index % 2 === 0 ? '64%' : '78%'} />
          </StyledBlock>
        </StyledRow>
      ))}
    </StyledRoot>
  );
};
