/**
 * Existing Module Federation configuration (migration source).
 * Reproduces configurations previously used in actual Webpack Module Federation.
 *
 * Demo points:
 * - This config is converted to an import map via @esmap/compat's convertMfToImportMap
 * - Preserves MF remote config structure while transitioning to the standard
 */
import type { MfRemoteConfig } from '@esmap/compat';

/** Legacy MF remote configuration */
export const legacyMfRemotes: readonly MfRemoteConfig[] = [
  {
    name: 'flexSettings',
    scope: '@flex/settings',
    remoteEntryUrl: 'https://cdn.old.example.com/settings/remoteEntry.js',
    exposes: [
      { key: './GeneralSettings', path: './src/pages/GeneralSettings.tsx' },
      { key: './NotificationSettings', path: './src/pages/NotificationSettings.tsx' },
      { key: './SecuritySettings', path: './src/pages/SecuritySettings.tsx' },
    ],
  },
  {
    name: 'flexProfile',
    scope: '@flex/profile',
    remoteEntryUrl: 'https://cdn.old.example.com/profile/remoteEntry.js',
    exposes: [{ key: './ProfileEditor', path: './src/components/ProfileEditor.tsx' }],
  },
];

/** Legacy MF shared configuration */
export const legacyMfShared: Readonly<Record<string, string>> = {
  react: '18.2.0',
  'react-dom': '18.2.0',
  'react-router-dom': '6.20.0',
};
