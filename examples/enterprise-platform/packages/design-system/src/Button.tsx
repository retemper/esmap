import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { theme } from './theme.js';

/** Button component props */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button visual variant */
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Button content */
  readonly children: ReactNode;
}

/** Style map per variant */
const variantStyles: Record<string, Record<string, string>> = {
  primary: {
    background: theme.colors.primary,
    color: '#ffffff',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: theme.colors.primary,
    border: `1px solid ${theme.colors.primary}`,
  },
  ghost: {
    background: 'transparent',
    color: theme.colors.text,
    border: '1px solid transparent',
  },
};

/** Padding map per size */
const sizeStyles: Record<string, Record<string, string>> = {
  sm: { padding: '4px 12px', fontSize: '13px' },
  md: { padding: '8px 16px', fontSize: '14px' },
  lg: { padding: '12px 24px', fontSize: '16px' },
};

/**
 * Shared design system Button.
 * Provides consistent UI by using the same instance across all MFEs.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  style,
  ...rest
}: ButtonProps): ReactNode {
  const baseStyle: Record<string, string> = {
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'opacity 0.15s',
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return (
    <button style={{ ...baseStyle, ...style }} {...rest}>
      {children}
    </button>
  );
}
