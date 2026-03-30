/**
 * TypeScript declarations for external modules resolved via import map at runtime.
 * Processed as Vite externals at build time (not included in bundles),
 * and mapped to actual URLs in the browser via import map.
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
