# @esmap/monitor

Performance monitoring for micro-frontends. Tracks timing metrics for each lifecycle phase (load, bootstrap, mount, unmount) to identify bottlenecks and regressions. (1.1 kB gzip)

## Installation

```bash
pnpm add @esmap/monitor
```

## Classes

### `PerfTracker`

```ts
class PerfTracker {
  markStart(appName: string, phase: string): void;
  markEnd(appName: string, phase: string): PerfMeasurement | undefined;
  getMeasurements(): readonly PerfMeasurement[];
  getMeasurementsForApp(appName: string): readonly PerfMeasurement[];
  summarize(): ReadonlyMap<string, { total: number; phases: Record<string, number> }>;
  onMeasurement(listener: (measurement: PerfMeasurement) => void): () => void;
  clear(): void;
}
```

Tracks MFE app loading performance using the Performance API (`mark`/`measure`). Call `markStart` and `markEnd` in pairs around lifecycle phases to record timing. Listener errors are isolated.

## Functions

### `createWebVitalsTracker`

```ts
function createWebVitalsTracker(options?: WebVitalsOptions): WebVitalsTracker;
```

Creates a per-MFE Web Vitals (CLS, LCP, INP) tracker. Uses `PerformanceObserver` to identify which MFE app caused each metric by traversing DOM ancestry to find the scope attribute.

### `findAppScope`

```ts
function findAppScope(element: Element | null, attr: string): string | null;
```

Finds the closest MFE scope name from an element by traversing up the DOM to find the nearest `[attr]` attribute.

## Types

### `PerfMeasurement`

| Property    | Type     | Description                                 |
| ----------- | -------- | ------------------------------------------- |
| `appName`   | `string` | App name                                    |
| `phase`     | `string` | Lifecycle phase                             |
| `duration`  | `number` | Elapsed time (ms)                           |
| `startTime` | `number` | Start time (ms, based on `performance.now`) |

### `WebVitalsTracker`

| Method      | Signature                                                 | Description                              |
| ----------- | --------------------------------------------------------- | ---------------------------------------- |
| `getMetric` | `(metric: WebVitalMetric) => ReadonlyMap<string, number>` | Returns per-app values for a metric      |
| `summarize` | `() => ReadonlyMap<string, { cls, lcp, inp }>`            | Summarizes all metrics per app           |
| `onVital`   | `(listener: WebVitalListener) => () => void`              | Registers a metric event listener        |
| `destroy`   | `() => void`                                              | Stops tracking and disconnects observers |

### `WebVitalsOptions`

| Property         | Type     | Description                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `scopeAttribute` | `string` | Attribute name to identify app containers (default: `"data-esmap-scope"`) |

### `AppWebVital`

| Property  | Type                 | Description             |
| --------- | -------------------- | ----------------------- |
| `appName` | `string`             | Attributed app name     |
| `metric`  | `WebVitalMetric`     | Metric type             |
| `value`   | `number`             | Metric value            |
| `entries` | `PerformanceEntry[]` | Raw performance entries |

### `WebVitalMetric`

```ts
type WebVitalMetric = 'CLS' | 'LCP' | 'INP';
```
