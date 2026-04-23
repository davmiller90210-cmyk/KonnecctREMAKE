import { styled } from '@linaria/react';
import { type ChangeEvent } from 'react';

import { IconSearch } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  flex-shrink: 0;
  margin: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]} 0;
  position: relative;
`;

const StyledIcon = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  height: 100%;
  left: ${themeCssVariables.spacing[3]};
  pointer-events: none;
  position: absolute;
  top: 0;
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.pill};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 36px;
  outline: none;
  padding: 0 ${themeCssVariables.spacing[3]} 0 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 3px ${themeCssVariables.background.transparent.blue};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

type ChatSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export const ChatSearchField = ({
  value,
  onChange,
  placeholder,
}: ChatSearchFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <StyledWrap>
      <StyledIcon>
        <IconSearch size={16} stroke={1.6} />
      </StyledIcon>
      <StyledInput
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </StyledWrap>
  );
};
