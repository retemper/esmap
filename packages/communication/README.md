# @esmap/communication

Inter-app communication primitives — event bus, global state, and app props.

A standalone package for data sharing between MFEs. Zero external dependencies.

## Installation

```bash
pnpm add @esmap/communication
```

## Event Bus

Type-safe pub/sub event bus:

```ts
import { createEventBus } from '@esmap/communication';
import type { EventBus } from '@esmap/communication';

// Define a typed event map
type AppEvents = {
  'user:login': { userId: string; role: string };
  'cart:update': { itemCount: number };
  'notification:show': { message: string; level: 'info' | 'error' };
};

const bus: EventBus<AppEvents> = createEventBus<AppEvents>({
  maxHistory: 50, // Event history limit (default: 100)
  onHandlerError: (event, error) => {
    // Handler error callback (optional)
    console.error(`Handler error in ${event}:`, error);
  },
});

// Subscribe — payload type is inferred automatically
const unsubscribe = bus.on('user:login', (payload) => {
  console.log(payload.userId); // string
  console.log(payload.role); // string
});

// One-time subscription
bus.once('cart:update', (payload) => {
  console.log(payload.itemCount);
});

// Emit — payload type is checked at compile time
bus.emit('user:login', { userId: '123', role: 'admin' });

// Unsubscribe
unsubscribe();

// Remove all listeners for a specific event
bus.off('cart:update');

// Query history
bus.getHistory(); // all events
bus.getHistory('user:login'); // specific event only

// Listener count
bus.listenerCount('user:login'); // number

// Clear everything
bus.clear();
```

**Handler error isolation:** If one handler throws, the remaining handlers still execute.

## Global State

Shared state management across apps:

```ts
import { createGlobalState } from '@esmap/communication';

const state = createGlobalState({
  currentUser: null as string | null,
  theme: 'light' as 'light' | 'dark',
  locale: 'en',
});

// Read (frozen copy)
const current = state.getState();

// Write (shallow merge)
state.setState({ theme: 'dark' });

// Subscribe
const unsubscribe = state.subscribe((newState, prevState) => {
  console.log('State changed:', prevState, '->', newState);
});

// Subscribe to a specific key only
state.select('theme', (newTheme, prevTheme) => {
  document.body.dataset.theme = newTheme;
});

// Reset to initial state
state.reset();
```

**No-op optimization:** Uses `Object.is()` comparison — subscribers are not notified if no values actually changed.

## App Props

Props passing between MFEs:

```ts
import { createAppProps } from '@esmap/communication';

const appProps = createAppProps({ userId: '', permissions: [] as string[] });

// Shell sets props
appProps.setProps({ userId: '123', permissions: ['read', 'write'] });

// MFE reads props (frozen copy)
const props = appProps.getProps();

// Subscribe to changes
const unsubscribe = appProps.onPropsChange((newProps, prevProps) => {
  console.log('Props changed:', newProps);
});
```
