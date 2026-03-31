import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerfTracker } from './perf-tracker.js';

describe('PerfTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('measures duration using markStart/markEnd', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(250);

    tracker.markStart('@flex/checkout', 'load');
    const result = tracker.markEnd('@flex/checkout', 'load');

    expect(result).toBeDefined();
    expect(result!.appName).toBe('@flex/checkout');
    expect(result!.phase).toBe('load');
    expect(result!.duration).toBe(150);
    expect(result!.startTime).toBe(100);
  });

  it('returns undefined when markEnd is called without markStart', () => {
    const tracker = new PerfTracker();
    const result = tracker.markEnd('@flex/checkout', 'load');
    expect(result).toBeUndefined();
  });

  it('getMeasurements() returns all measurement results', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200);

    tracker.markStart('app-a', 'load');
    tracker.markEnd('app-a', 'load');
    tracker.markStart('app-b', 'load');
    tracker.markEnd('app-b', 'load');

    expect(tracker.getMeasurements()).toHaveLength(2);
  });

  it('getMeasurementsForApp() returns only results for a specific app', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(300);

    tracker.markStart('app-a', 'load');
    tracker.markEnd('app-a', 'load');
    tracker.markStart('app-b', 'load');
    tracker.markEnd('app-b', 'load');
    tracker.markStart('app-a', 'mount');
    tracker.markEnd('app-a', 'mount');

    const appAMeasurements = tracker.getMeasurementsForApp('app-a');
    expect(appAMeasurements).toHaveLength(2);
    expect(appAMeasurements.every((m) => m.appName === 'app-a')).toBe(true);
  });

  it('summarize() provides total time and per-phase time for each app', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(150)
      .mockReturnValueOnce(150)
      .mockReturnValueOnce(200);

    tracker.markStart('app-a', 'load');
    tracker.markEnd('app-a', 'load');
    tracker.markStart('app-a', 'bootstrap');
    tracker.markEnd('app-a', 'bootstrap');
    tracker.markStart('app-a', 'mount');
    tracker.markEnd('app-a', 'mount');

    const summary = tracker.summarize();
    const appSummary = summary.get('app-a');

    expect(appSummary).toBeDefined();
    expect(appSummary!.total).toBe(200);
    expect(appSummary!.phases.load).toBe(100);
    expect(appSummary!.phases.bootstrap).toBe(50);
    expect(appSummary!.phases.mount).toBe(50);
  });

  it('onMeasurement listener is called when measurement completes', () => {
    const tracker = new PerfTracker();
    const listener = vi.fn();

    tracker.onMeasurement(listener);

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: 'app',
        phase: 'load',
      }),
    );
  });

  it('is not called after the listener is unsubscribed', () => {
    const tracker = new PerfTracker();
    const listener = vi.fn();

    const unsubscribe = tracker.onMeasurement(listener);
    unsubscribe();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener).not.toHaveBeenCalled();
  });

  it('clear() resets all measurements and active marks', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    tracker.clear();

    expect(tracker.getMeasurements()).toStrictEqual([]);
  });

  it('can track different phases of multiple apps concurrently', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0) // app-a:load start
      .mockReturnValueOnce(50) // app-b:load start
      .mockReturnValueOnce(100) // app-a:load end
      .mockReturnValueOnce(200); // app-b:load end

    tracker.markStart('app-a', 'load');
    tracker.markStart('app-b', 'load');
    tracker.markEnd('app-a', 'load');
    tracker.markEnd('app-b', 'load');

    const measurements = tracker.getMeasurements();
    expect(measurements).toHaveLength(2);
    expect(measurements[0].duration).toBe(100);
    expect(measurements[1].duration).toBe(150);
  });

  it('summarize() returns an empty Map when there are no apps', () => {
    const tracker = new PerfTracker();
    const summary = tracker.summarize();
    expect(summary.size).toBe(0);
  });

  it('clear() also resets listeners', () => {
    const tracker = new PerfTracker();
    const listener = vi.fn();

    tracker.onMeasurement(listener);
    tracker.clear();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);
    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener).not.toHaveBeenCalled();
  });

  it('other listeners still execute even if one throws an error', () => {
    const tracker = new PerfTracker();
    const listener1 = vi.fn(() => {
      throw new Error('listener error');
    });
    const listener2 = vi.fn();

    tracker.onMeasurement(listener1);
    tracker.onMeasurement(listener2);

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);
    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });
});
