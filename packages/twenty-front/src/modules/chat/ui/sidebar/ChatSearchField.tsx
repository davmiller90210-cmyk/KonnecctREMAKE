import { styled } from '@linaria/react';
import { type ChangeEvent } from 'react';

import { IconSearch } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div<{ $elevated: boolean }>`
  flex-shrink: 0;
  margin: ${({ $elevated }) =>
    $elevated
      ? `${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]} 0`
      : `${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]} 0`};
  position: relative;
`;

const StyledIcon = styled.span<{ $elevated: boolean }>`
  align-items: center;
  color: ${({ $elevated }) =>
    $elevated
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.tertiary};
  display: flex;
  height: 100%;
  left: ${themeCssVariables.spacing[3]};
  pointer-events: none;
  position: absolute;
  top: 0;
`;

const StyledInput = styled.input<{ $elevated: boolean }>`
  background: ${({ $elevated }) =>
    $elevated
      ? themeCssVariables.background.transparent.lighter
      : themeCssVariables.background.primary};
  border: 1px solid
    ${({ $elevated }) =>
      $elevated
        ? themeCssVariables.border.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.pill};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 36px;
  outline: none;
  padding: 0 ${themeCssVariables.spacing[3]} 0 36px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
  width: 100%;

  ${({ $elevated }) =>
    $elevated
      ? `
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    box-shadow: 0 0 0 1px ${themeCssVariables.background.transparent.blue} inset;
  `
      : ''}

  &:hover {
    border-color: ${({ $elevated }) =>
      $elevated
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.strong};
  }

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    box-shadow:
      0 0 0 3px ${themeCssVariables.background.transparent.blue},
      ${({ $elevated }) =>
        $elevated
          ? `0 0 20px ${themeCssVariables.background.transparent.blue}`
          : 'none'};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

type ChatSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Glass-style search (Communications nav card). */
  surface?: 'default' | 'elevated';
};

export const ChatSearchField = ({
  value,
  onChange,
  placeholder,
  surface = 'default',
}: ChatSearchFieldProps) => {
  const elevated = surface === 'elevated';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <StyledWrap $elevated={elevated}>
      <StyledIcon $elevated={elevated}>
        <IconSearch size={16} stroke={1.6} />
      </StyledIcon>
      <StyledInput
        $elevated={elevated}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </StyledWrap>
  );
};
