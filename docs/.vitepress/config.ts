import { defineConfig } from 'vitepress';
import type { DefaultTheme } from 'vitepress';

const guideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Introduction',
    items: [
      { text: 'What is esmap?', link: '/guide/what-is-esmap' },
      { text: 'Getting Started', link: '/guide/getting-started' },
    ],
  },
  {
    text: 'Core Concepts',
    items: [
      { text: 'Unified Kernel', link: '/guide/core' },
      { text: 'Import Maps', link: '/guide/import-maps' },
      { text: 'App Lifecycle', link: '/guide/app-lifecycle' },
      { text: 'Routing', link: '/guide/routing' },
      { text: 'Communication', link: '/guide/communication' },
    ],
  },
  {
    text: 'Isolation',
    items: [
      { text: 'JS Sandbox', link: '/guide/sandbox' },
      { text: 'CSS Scoping', link: '/guide/css-scoping' },
    ],
  },
  {
    text: 'Deploy',
    items: [
      { text: 'Server', link: '/guide/server' },
      { text: 'CLI', link: '/guide/cli' },
    ],
  },
  {
    text: 'Integrations',
    items: [
      { text: 'React', link: '/guide/react' },
      { text: 'Vue', link: '/guide/vue' },
      { text: 'Angular', link: '/guide/angular' },
      { text: 'Vite Plugin', link: '/guide/vite-plugin' },
      {
        text: 'Migration from Module Federation',
        link: '/guide/migration',
      },
    ],
  },
];

const apiSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Browser',
    items: [
      { text: '@esmap/core', link: '/api/core' },
      { text: '@esmap/runtime', link: '/api/runtime' },
      { text: '@esmap/react', link: '/api/react' },
      { text: '@esmap/vue', link: '/api/vue' },
      { text: '@esmap/angular', link: '/api/angular' },
      { text: '@esmap/communication', link: '/api/communication' },
      { text: '@esmap/sandbox', link: '/api/sandbox' },
      { text: '@esmap/guard', link: '/api/guard' },
      { text: '@esmap/devtools', link: '/api/devtools' },
      { text: '@esmap/monitor', link: '/api/monitor' },
    ],
  },
  {
    text: 'Build & Server',
    items: [
      { text: '@esmap/cli', link: '/api/cli' },
      { text: '@esmap/vite-plugin', link: '/api/vite-plugin' },
      { text: '@esmap/server', link: '/api/server' },
      { text: '@esmap/config', link: '/api/config' },
      { text: '@esmap/compat', link: '/api/compat' },
      { text: '@esmap/ssr', link: '/api/ssr' },
    ],
  },
];

const guideSidebarKo: DefaultTheme.SidebarItem[] = [
  {
    text: '소개',
    items: [
      { text: 'esmap이란?', link: '/ko/guide/what-is-esmap' },
      { text: '시작하기', link: '/ko/guide/getting-started' },
    ],
  },
  {
    text: '핵심 개념',
    items: [
      { text: '통합 커널', link: '/ko/guide/core' },
      { text: 'Import Maps', link: '/ko/guide/import-maps' },
      { text: '앱 라이프사이클', link: '/ko/guide/app-lifecycle' },
      { text: '라우팅', link: '/ko/guide/routing' },
      { text: '통신', link: '/ko/guide/communication' },
    ],
  },
  {
    text: '격리',
    items: [
      { text: 'JS 샌드박스', link: '/ko/guide/sandbox' },
      { text: 'CSS 스코핑', link: '/ko/guide/css-scoping' },
    ],
  },
  {
    text: '배포',
    items: [
      { text: '서버', link: '/ko/guide/server' },
      { text: 'CLI', link: '/ko/guide/cli' },
    ],
  },
  {
    text: '통합',
    items: [
      { text: 'React', link: '/ko/guide/react' },
      { text: 'Vue', link: '/ko/guide/vue' },
      { text: 'Angular', link: '/ko/guide/angular' },
      { text: 'Vite 플러그인', link: '/ko/guide/vite-plugin' },
      {
        text: 'Module Federation에서 마이그레이션',
        link: '/ko/guide/migration',
      },
    ],
  },
];

const apiSidebarKo: DefaultTheme.SidebarItem[] = [
  {
    text: '브라우저',
    items: [
      { text: '@esmap/core', link: '/ko/api/core' },
      { text: '@esmap/runtime', link: '/ko/api/runtime' },
      { text: '@esmap/react', link: '/ko/api/react' },
      { text: '@esmap/vue', link: '/ko/api/vue' },
      { text: '@esmap/angular', link: '/ko/api/angular' },
      { text: '@esmap/communication', link: '/ko/api/communication' },
      { text: '@esmap/sandbox', link: '/ko/api/sandbox' },
      { text: '@esmap/guard', link: '/ko/api/guard' },
      { text: '@esmap/devtools', link: '/ko/api/devtools' },
      { text: '@esmap/monitor', link: '/ko/api/monitor' },
    ],
  },
  {
    text: '빌드 & 서버',
    items: [
      { text: '@esmap/cli', link: '/ko/api/cli' },
      { text: '@esmap/vite-plugin', link: '/ko/api/vite-plugin' },
      { text: '@esmap/server', link: '/ko/api/server' },
      { text: '@esmap/config', link: '/ko/api/config' },
      { text: '@esmap/compat', link: '/ko/api/compat' },
      { text: '@esmap/ssr', link: '/ko/api/ssr' },
    ],
  },
];

export default defineConfig({
  title: 'esmap',
  description: 'Micro-frontends on native import maps',
  base: '/esmap/',
  cleanUrls: true,
  locales: {
    root: {
      label: 'English',
      lang: 'en',
    },
    ko: {
      label: '한국어',
      lang: 'ko',
      description: '네이티브 import map 기반 마이크로 프론트엔드',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/ko/guide/getting-started' },
          { text: 'API', link: '/ko/api/runtime' },
          {
            text: '링크',
            items: [
              {
                text: '변경 이력',
                link: 'https://github.com/retemper/esmap/releases',
              },
              {
                text: '기여하기',
                link: 'https://github.com/retemper/esmap/blob/main/CONTRIBUTING.md',
              },
            ],
          },
        ],
        sidebar: {
          '/ko/guide/': guideSidebarKo,
          '/ko/api/': apiSidebarKo,
        },
        editLink: {
          pattern: 'https://github.com/retemper/esmap/edit/main/docs/:path',
          text: '이 페이지 편집 제안하기',
        },
        footer: {
          message: 'MIT 라이선스에 따라 배포됩니다.',
          copyright: 'Copyright © 2024-present esmap contributors',
        },
        docFooter: {
          prev: '이전 페이지',
          next: '다음 페이지',
        },
        outline: {
          label: '이 페이지 목차',
        },
        lastUpdated: {
          text: '최종 수정일',
        },
        returnToTopLabel: '맨 위로',
        sidebarMenuLabel: '메뉴',
        darkModeSwitchLabel: '다크 모드',
      },
    },
  },
  themeConfig: {
    logo: {
      light: 'https://raw.githubusercontent.com/retemper/esmap/main/.github/logo-light.svg',
      dark: 'https://raw.githubusercontent.com/retemper/esmap/main/.github/logo-dark.svg',
    },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/runtime' },
      {
        text: 'Links',
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/retemper/esmap/releases',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/retemper/esmap/blob/main/CONTRIBUTING.md',
          },
        ],
      },
    ],
    sidebar: {
      '/guide/': guideSidebar,
      '/api/': apiSidebar,
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/retemper/esmap' }],
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/retemper/esmap/edit/main/docs/:path',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present esmap contributors',
    },
  },
});
