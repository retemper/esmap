# @esmap/monitor

마이크로 프론트엔드 성능 모니터링입니다. 각 라이프사이클 단계(로드, 부트스트랩, 마운트, 언마운트)의 타이밍 메트릭을 추적하여 병목 현상과 성능 저하를 식별합니다. (1.1 kB gzip)

## 설치

```bash
pnpm add @esmap/monitor
```

## 클래스

### `PerfTracker`

```ts
class PerfTracker {
  markStart(appName: string, phase: string): void;
  markEnd(appName: string, phase: string): PerfMeasurement | undefined;
  getMeasurements(): readonly PerfMeasurement[];
  onMeasure(listener: (measurement: PerfMeasurement) => void): () => void;
  getSummary(appName: string): Record<string, { count: number; avg: number; max: number }>;
  clear(): void;
}
```

MFE 앱 로딩 성능을 추적합니다. Performance API(mark/measure)를 사용하여 각 라이프사이클 단계의 경과 시간을 기록합니다.

## 함수

### `createWebVitalsTracker`

```ts
function createWebVitalsTracker(options?: WebVitalsOptions): WebVitalsTracker;
```

MFE별 Web Vitals(CLS, LCP, INP) 어트리뷰션을 제공합니다. PerformanceObserver를 사용하여 각 메트릭을 발생시킨 MFE 앱을 식별합니다.

### `findAppScope`

```ts
function findAppScope(element: Element | null, attr: string): string | null;
```

요소에서 가장 가까운 MFE 스코프 이름을 찾습니다.

## 타입

### `PerfMeasurement`

| 속성        | 타입     | 설명                                |
| ----------- | -------- | ----------------------------------- |
| `appName`   | `string` | 앱 이름                             |
| `phase`     | `string` | 라이프사이클 단계                   |
| `duration`  | `number` | 경과 시간 ms                        |
| `startTime` | `number` | 시작 시간 ms (performance.now 기준) |

### `WebVitalsOptions`

| 속성             | 타입     | 설명                                                 |
| ---------------- | -------- | ---------------------------------------------------- |
| `scopeAttribute` | `string` | 앱 컨테이너 식별 속성명 (기본값: 'data-esmap-scope') |

### `WebVitalsTracker`

| 메서드      | 시그니처                                                  | 설명                          |
| ----------- | --------------------------------------------------------- | ----------------------------- |
| `getMetric` | `(metric: WebVitalMetric) => ReadonlyMap<string, number>` | 특정 메트릭의 앱별 값을 반환  |
| `summarize` | `() => ReadonlyMap<string, { cls, lcp, inp }>`            | 모든 메트릭을 앱별로 요약     |
| `onVital`   | `(listener) => () => void`                                | 메트릭 이벤트 리스너를 등록   |
| `destroy`   | `() => void`                                              | 추적을 중지하고 옵저버를 해제 |

### `WebVitalMetric`

```ts
type WebVitalMetric = 'CLS' | 'LCP' | 'INP';
```
