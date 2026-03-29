# multi-mfe example

A working multi-MFE demo with browser routing, dynamic loading, and inter-app communication.

Integrates nearly every feature of the esmap framework.

## Run

```bash
cd examples/multi-mfe
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Structure

```
multi-mfe/
├── host/src/boot.ts        # Host app — integrates all packages
├── apps/
│   ├── app-nav/            # Navigation MFE (Vanilla JS)
│   ├── app-home/           # Home MFE (Vanilla JS)
│   ├── app-settings/       # Settings MFE (Vanilla JS)
│   └── app-react-dashboard/# Dashboard MFE (React + createReactMfeApp)
└── esmap.config.json       # Import map configuration
```

## Features Demonstrated

| Feature                 | Package                | Description                                          |
| ----------------------- | ---------------------- | ---------------------------------------------------- |
| Import map loading      | `@esmap/runtime`       | Inline import map injection                          |
| MFE lifecycle           | `@esmap/runtime`       | Register / load / mount / unmount via AppRegistry    |
| Routing                 | `@esmap/runtime`       | Router + beforeRouteChange / afterRouteChange guards |
| Error boundary          | `@esmap/runtime`       | Fallback UI + retry on load failure                  |
| React MFE               | `@esmap/react`         | React app wrapped with `createReactMfeApp()`         |
| JS isolation            | `@esmap/sandbox`       | Per-MFE ProxySandbox                                 |
| CSS isolation           | `@esmap/guard`         | CSS scoping + style isolation                        |
| Inter-app communication | `@esmap/communication` | EventBus + GlobalState                               |
| Developer tools         | `@esmap/devtools`      | Import map override API                              |
| Performance tracking    | `@esmap/monitor`       | PerfTracker per lifecycle phase                      |
| Prefetch                | `@esmap/runtime`       | Idle-time MFE preloading                             |
| Shared modules          | `@esmap/runtime`       | SharedModuleRegistry version negotiation             |
| Lifecycle hooks         | `@esmap/runtime`       | Shared logic before/after mount/unmount              |
