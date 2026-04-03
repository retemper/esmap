import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'esmap',
  description: 'Micro-frontends on native import maps',
  base: '/esmap/',
  cleanUrls: true,
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
      '/guide/': [
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
      ],
      '/api/': [
        {
          text: 'Browser',
          items: [
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
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/retemper/esmap' },
    ],
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
