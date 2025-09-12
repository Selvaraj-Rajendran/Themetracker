import React from "react";
import styled from "styled-components";

// ❌ Multiple theme violations in this component
const StyledButton = styled.button`
  background: #0066cc; /* Should use var(--dew-color-brand-primary) */
  color: #ffffff; /* Should use var(--dew-color-text-on-brand) */
  padding: 12px 24px; /* Should use var(--dew-spacing-sm) var(--dew-spacing-md) */
  border-radius: 6px; /* Should use var(--dew-radius-md) */
  border: none;
  font-size: 16px; /* Should use var(--dew-text-base) */
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #0052a3; /* Should use var(--dew-color-brand-primary-hover) */
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3); /* Should use var(--dew-shadow-md) */
  }

  &:active {
    transform: translateY(0);
    background: #004080; /* Should use var(--dew-color-brand-primary-pressed) */
  }
`;

const Button = ({ children, onClick, variant = "primary" }) => {
  const buttonStyle = {
    margin: "8px", // Should use var(--dew-spacing-sm)
    display: "inline-block",
  };

  return (
    <StyledButton
      onClick={onClick}
      style={buttonStyle}
      className="btn btn-primary" // Mixed styling approaches - not ideal
    >
      {children}
    </StyledButton>
  );
};

export default Button;
