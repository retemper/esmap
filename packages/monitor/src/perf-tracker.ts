/**
 * MFE 앱 로딩 성능을 추적한다.
 * Performance API(mark/measure)를 활용하여 각 라이프사이클 단계의 소요 시간을 기록한다.
 */

/** 단일 성능 측정 결과 */
export interface PerfMeasurement {
  /** 앱 이름 */
  readonly appName: string;
  /** 라이프사이클 단계 */
  readonly phase: string;
  /** 소요 시간 (ms) */
  readonly duration: number;
  /** 시작 시간 (ms, performance.now 기준) */
  readonly startTime: number;
}

/** 성능 이벤트 리스너 */
type PerfListener = (measurement: PerfMeasurement) => void;

/**
 * MFE 라이프사이클 성능을 추적하는 트래커.
 * Performance API를 사용하여 정밀한 시간 측정을 제공한다.
 */
export class PerfTracker {
  private readonly measurements: PerfMeasurement[] = [];
  private readonly listeners: PerfListener[] = [];
  private readonly activeMarks = new Map<string, number>();

  /**
   * 측정을 시작한다. markEnd와 쌍으로 사용한다.
   * @param appName - 앱 이름
   * @param phase - 라이프사이클 단계 (예: "load", "bootstrap", "mount")
   */
  markStart(appName: string, phase: string): void {
    const key = `${appName}:${phase}`;
    this.activeMarks.set(key, performance.now());
  }

  /**
   * 측정을 종료하고 결과를 기록한다.
   * 리스너 에러는 격리되어 다른 리스너에 영향을 주지 않는다.
   * @param appName - 앱 이름
   * @param phase - 라이프사이클 단계
   * @returns 측정 결과. markStart가 없었으면 undefined
   */
  markEnd(appName: string, phase: string): PerfMeasurement | undefined {
    const key = `${appName}:${phase}`;
    const startTime = this.activeMarks.get(key);
    if (startTime === undefined) return undefined;

    this.activeMarks.delete(key);

    const duration = performance.now() - startTime;
    const measurement: PerfMeasurement = { appName, phase, duration, startTime };

    this.measurements.push(measurement);

    for (const listener of [...this.listeners]) {
      try {
        listener(measurement);
      } catch {
        // 리스너 에러는 격리 — 다른 리스너 실행을 막지 않는다
      }
    }

    return measurement;
  }

  /** 기록된 모든 측정 결과를 반환한다. */
  getMeasurements(): readonly PerfMeasurement[] {
    return this.measurements;
  }

  /** 특정 앱의 측정 결과만 반환한다. */
  getMeasurementsForApp(appName: string): readonly PerfMeasurement[] {
    return this.measurements.filter((m) => m.appName === appName);
  }

  /**
   * 측정 결과를 앱별로 요약한다.
   * 각 앱의 총 로딩 시간(load + bootstrap + mount)을 계산한다.
   */
  summarize(): ReadonlyMap<
    string,
    { readonly total: number; readonly phases: Record<string, number> }
  > {
    const summary = new Map<string, { total: number; phases: Record<string, number> }>();

    for (const measurement of this.measurements) {
      const existing = summary.get(measurement.appName) ?? { total: 0, phases: {} };
      existing.total += measurement.duration;
      existing.phases[measurement.phase] =
        (existing.phases[measurement.phase] ?? 0) + measurement.duration;
      summary.set(measurement.appName, existing);
    }

    return summary;
  }

  /** 측정 이벤트 리스너를 등록한다. 해제 함수를 반환한다. */
  onMeasurement(listener: PerfListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** 기록과 리스너를 모두 초기화한다. */
  clear(): void {
    this.measurements.length = 0;
    this.activeMarks.clear();
    this.listeners.length = 0;
  }
}
