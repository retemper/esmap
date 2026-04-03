# CSS Scoping

::: warning WIP
This page is under construction.
:::

`@esmap/guard` prevents CSS leakage between micro-frontends.

## Scoped Styles

Automatically scopes CSS rules to the MFE's container element, preventing styles from leaking to the host or other MFEs.

## Global Pollution Detection

Detects when an MFE adds global styles (e.g., `body { ... }`) and warns in development, helping you catch unintended side effects early.
