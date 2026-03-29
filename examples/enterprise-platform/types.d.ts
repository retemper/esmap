/**
 * 런타임에 import map으로 해석되는 외부 모듈의 TypeScript 선언.
 * 빌드 시 Vite externals로 처리되어 번들에 포함되지 않으며,
 * 브라우저에서 import map을 통해 실제 URL로 매핑된다.
 */

declare module '@enterprise/design-system' {
  import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from 'react';

  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: 'primary' | 'secondary' | 'ghost';
    readonly size?: 'sm' | 'md' | 'lg';
    readonly children: ReactNode;
  }

  export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    readonly title?: string;
    readonly padding?: 'sm' | 'md' | 'lg';
    readonly children: ReactNode;
  }

  export interface Theme {
    readonly colors: {
      readonly primary: string;
      readonly secondary: string;
      readonly text: string;
      readonly textDimmed: string;
      readonly background: string;
      readonly surface: string;
      readonly border: string;
      readonly success: string;
      readonly error: string;
      readonly warning: string;
    };
    readonly spacing: {
      readonly xs: string;
      readonly sm: string;
      readonly md: string;
      readonly lg: string;
      readonly xl: string;
    };
  }

  export function Button(props: ButtonProps): ReactNode;
  export function Card(props: CardProps): ReactNode;
  export const theme: Theme;
}

declare module '@enterprise/activity-feed' {
  import type { MfeApp } from '@esmap/shared';
  const app: MfeApp;
  export default app;
}
