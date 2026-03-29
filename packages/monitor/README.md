# @esmap/monitor

Performance monitoring for MFE loading, bootstrapping, and mounting.

Provides precise timing measurements using `performance.now()`. Zero external dependencies.

## Installation

```bash
pnpm add @esmap/monitor
```

## PerfTracker

```ts
import { PerfTracker } from '@esmap/monitor';

const tracker = new PerfTracker();

// Measure
tracker.markStart('@myorg/checkout', 'load');
// ... loading ...
const result = tracker.markEnd('@myorg/checkout', 'load');
// -> { appName: '@myorg/checkout', phase: 'load', duration: 142.5, startTime: 1000.0 }

tracker.markStart('@myorg/checkout', 'bootstrap');
tracker.markEnd('@myorg/checkout', 'bootstrap');

tracker.markStart('@myorg/checkout', 'mount');
tracker.markEnd('@myorg/checkout', 'mount');
```

### Query Results

```ts
// All measurements
tracker.getMeasurements();

// Specific app only
tracker.getMeasurementsForApp('@myorg/checkout');

// Per-app summary (total time + per-phase breakdown)
const summary = tracker.summarize();
const checkout = summary.get('@myorg/checkout');
// -> { total: 250, phases: { load: 142.5, bootstrap: 57.5, mount: 50 } }
```

### Real-time Subscription

```ts
const unsubscribe = tracker.onMeasurement((measurement) => {
  // Send to external monitoring service
  analytics.track('mfe_perf', {
    app: measurement.appName,
    phase: measurement.phase,
    duration: measurement.duration,
  });
});

// Unsubscribe
unsubscribe();
```

Handler errors are isolated — one failing listener does not block others.

### Clear

```ts
tracker.clear(); // Clears all measurements, active marks, and listeners
```

## AppRegistry Integration Example

```ts
import { PerfTracker } from '@esmap/monitor';
import { AppRegistry } from '@esmap/runtime';

const tracker = new PerfTracker();
const registry = new AppRegistry();

registry.onStatusChange(({ appName, from, to }) => {
  if (to === 'LOADING') tracker.markStart(appName, 'load');
  if (to === 'BOOTSTRAPPING') {
    tracker.markEnd(appName, 'load');
    tracker.markStart(appName, 'bootstrap');
  }
  if (to === 'NOT_MOUNTED' && from === 'BOOTSTRAPPING') {
    tracker.markEnd(appName, 'bootstrap');
  }
  if (to === 'MOUNTED') tracker.markEnd(appName, 'mount');
});
```
