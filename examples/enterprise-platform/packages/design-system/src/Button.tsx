import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { theme } from './theme.js';

/** Button 컴포넌트 props */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 버튼 시각적 변형 */
  readonly variant?: 'primary' | 'secondary' | 'ghost';
  /** 버튼 크기 */
  readonly size?: 'sm' | 'md' | 'lg';
  /** 버튼 내용 */
  readonly children: ReactNode;
}

/** 변형별 스타일 맵 */
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

/** 크기별 패딩 맵 */
const sizeStyles: Record<string, Record<string, string>> = {
  sm: { padding: '4px 12px', fontSize: '13px' },
  md: { padding: '8px 16px', fontSize: '14px' },
  lg: { padding: '12px 24px', fontSize: '16px' },
};

/**
 * 공유 디자인 시스템 Button.
 * 모든 MFE에서 동일한 인스턴스를 사용하여 일관된 UI를 제공한다.
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
