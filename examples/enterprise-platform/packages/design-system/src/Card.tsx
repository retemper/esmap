import type { ReactNode, HTMLAttributes } from 'react';
import { theme } from './theme.js';

/** Card component props */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card title */
  readonly title?: string;
  /** Card padding */
  readonly padding?: 'sm' | 'md' | 'lg';
  /** Card content */
  readonly children: ReactNode;
}

/** Padding size map */
const paddingMap: Record<string, string> = {
  sm: '12px',
  md: '20px',
  lg: '32px',
};

/**
 * Shared design system Card.
 * A container component that visually groups content.
 */
export function Card({ title, padding = 'md', children, style, ...rest }: CardProps): ReactNode {
  const cardStyle: Record<string, string> = {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '8px',
    padding: paddingMap[padding],
  };

  return (
    <div style={{ ...cardStyle, ...style }} {...rest}>
      {title && (
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: theme.colors.text,
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
