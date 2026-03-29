/**
 * 기존 Module Federation 설정 (마이그레이션 소스).
 * 실제 Webpack Module Federation에서 사용하던 설정을 재현한다.
 *
 * 시연 포인트:
 * - 이 설정이 @esmap/compat의 convertMfToImportMap으로 import map으로 변환됨
 * - MF remote 설정의 구조를 보존하면서 표준으로 전환
 */
import type { MfRemoteConfig } from '@esmap/compat';

/** 기존 MF remote 설정 */
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
    exposes: [
      { key: './ProfileEditor', path: './src/components/ProfileEditor.tsx' },
    ],
  },
];

/** 기존 MF shared 설정 */
export const legacyMfShared: Readonly<Record<string, string>> = {
  react: '18.2.0',
  'react-dom': '18.2.0',
  'react-router-dom': '6.20.0',
};
