# Communication

::: warning WIP
This page is under construction.
:::

`@esmap/communication` provides type-safe inter-MFE communication.

## Event Bus

```ts
import { createEventBus } from '@esmap/communication';

interface Events {
  'cart:updated': { itemCount: number };
  'user:logged-in': { userId: string };
}

const bus = createEventBus<Events>();

// Subscribe
bus.on('cart:updated', ({ itemCount }) => {
  console.log(`Cart now has ${itemCount} items`);
});

// Publish
bus.emit('cart:updated', { itemCount: 3 });
```

## Global State

```ts
import { createGlobalState } from '@esmap/communication';

const state = createGlobalState({ theme: 'light' });

// Read
console.log(state.get().theme);

// Update
state.set({ theme: 'dark' });

// Subscribe to changes
state.subscribe((next) => console.log(next.theme));
```
