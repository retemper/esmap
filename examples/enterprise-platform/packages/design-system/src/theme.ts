/** Design system theme token interface */
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

/** Default light theme */
export const theme: Theme = {
  colors: {
    primary: '#2563eb',
    secondary: '#7c3aed',
    text: '#1e293b',
    textDimmed: '#94a3b8',
    background: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
};
