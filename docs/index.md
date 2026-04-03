---
layout: home

hero:
  name: esmap
  text: Micro-frontends on native import maps
  tagline: Build-time generation, browser runtime, deploy server, and devtools — one framework.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/retemper/esmap

features:
  - title: Browser-native
    details: Built on W3C Import Maps — your MFEs are just ESM modules that the browser resolves natively.
  - title: Any bundler
    details: Vite plugin included, but not required. Works with any bundler that outputs ESM.
  - title: Independent deploys
    details: Update one MFE without rebuilding the host. Deploy-time coupling, not build-time.
  - title: JS + CSS isolation
    details: Proxy sandbox, snapshot sandbox, scoped styles, and global pollution detection.
  - title: Type-safe communication
    details: Event bus with full TypeScript inference. Global state and app props built in.
  - title: '~17.5 kB gzip total'
    details: Use only what you need — each package has zero cross-dependencies.
---
