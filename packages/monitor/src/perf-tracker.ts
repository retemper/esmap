/**
 * Tracks MFE app loading performance.
 * Uses the Performance API (mark/measure) to record the elapsed time of each lifecycle phase.
 */

/** A single performance measurement result */
export interface PerfMeasurement {
  /** App name */
  readonly appName: string;
  /** Lifecycle phase */
  readonly phase: string;
  /** Elapsed time (ms) */
  readonly duration: number;
  /** Start time (ms, based on performance.now) */
  readonly startTime: number;
}

/** Performance event listener */
type PerfListener = (measurement: PerfMeasurement) => void;

/**
 * Tracker for MFE lifecycle performance.
 * Provides precise time measurements using the Performance API.
 */
export class PerfTracker {
  private readonly measurements: PerfMeasurement[] = [];
  private readonly listeners: PerfListener[] = [];
  private readonly activeMarks = new Map<string, number>();

  /**
   * Starts a measurement. Used in pair with markEnd.
   * @param appName - app name
   * @param phase - lifecycle phase (e.g., "load", "bootstrap", "mount")
   */
  markStart(appName: string, phase: string): void {
    const key = `${appName}:${phase}`;
    this.activeMarks.set(key, performance.now());
  }

  /**
   * Ends a measurement and records the result.
   * Listener errors are isolated and do not affect other listeners.
   * @param appName - app name
   * @param phase - lifecycle phase
   * @returns measurement result, or undefined if markStart was not called
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
        // Listener errors are isolated -- they do not block other listeners
      }
    }

    return measurement;
  }

  /** Returns all recorded measurement results. */
  getMeasurements(): readonly PerfMeasurement[] {
    return this.measurements;
  }

  /** Returns measurement results for a specific app only. */
  getMeasurementsForApp(appName: string): readonly PerfMeasurement[] {
    return this.measurements.filter((m) => m.appName === appName);
  }

  /**
   * Summarizes measurement results per app.
   * Calculates total loading time (load + bootstrap + mount) for each app.
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

  /** Registers a measurement event listener. Returns an unsubscribe function. */
  onMeasurement(listener: PerfListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Resets all records and listeners. */
  clear(): void {
    this.measurements.length = 0;
    this.activeMarks.clear();
    this.listeners.length = 0;
  }
}
