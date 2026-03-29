import type { ReactNode, HTMLAttributes } from 'react';
import { theme } from './theme.js';

/** Card 컴포넌트 props */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 카드 제목 */
  readonly title?: string;
  /** 카드 패딩 */
  readonly padding?: 'sm' | 'md' | 'lg';
  /** 카드 내용 */
  readonly children: ReactNode;
}

/** 패딩 크기 맵 */
const paddingMap: Record<string, string> = {
  sm: '12px',
  md: '20px',
  lg: '32px',
};

/**
 * 공유 디자인 시스템 Card.
 * 콘텐츠를 시각적으로 그룹화하는 컨테이너 컴포넌트.
 */
export function Card({
  title,
  padding = 'md',
  children,
  style,
  ...rest
}: CardProps): ReactNode {
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
