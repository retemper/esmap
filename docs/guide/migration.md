# Migration from Module Federation

::: warning WIP
This page is under construction.
:::

`@esmap/compat` provides a migration layer from Webpack Module Federation to esmap import maps.

## Overview

If you're currently using Module Federation, `@esmap/compat` lets you gradually migrate by translating MF remote entries into import map entries. This allows you to run both systems side by side during the transition.
