import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerfTracker } from './perf-tracker.js';

describe('PerfTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('markStart/markEnd로 duration을 측정한다', () => {
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

  it('markStart 없이 markEnd를 호출하면 undefined를 반환한다', () => {
    const tracker = new PerfTracker();
    const result = tracker.markEnd('@flex/checkout', 'load');
    expect(result).toBeUndefined();
  });

  it('getMeasurements()는 모든 측정 결과를 반환한다', () => {
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

  it('getMeasurementsForApp()는 특정 앱의 결과만 반환한다', () => {
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

  it('summarize()는 앱별 총 시간과 phase별 시간을 제공한다', () => {
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

  it('onMeasurement 리스너가 측정 완료 시 호출된다', () => {
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

  it('리스너 해제 후에는 호출되지 않는다', () => {
    const tracker = new PerfTracker();
    const listener = vi.fn();

    const unsubscribe = tracker.onMeasurement(listener);
    unsubscribe();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener).not.toHaveBeenCalled();
  });

  it('clear()는 모든 측정과 활성 마크를 초기화한다', () => {
    const tracker = new PerfTracker();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    tracker.clear();

    expect(tracker.getMeasurements()).toStrictEqual([]);
  });

  it('동시에 여러 앱의 다른 phase를 추적할 수 있다', () => {
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

  it('summarize()는 앱이 없으면 빈 Map을 반환한다', () => {
    const tracker = new PerfTracker();
    const summary = tracker.summarize();
    expect(summary.size).toBe(0);
  });

  it('clear()는 리스너도 초기화한다', () => {
    const tracker = new PerfTracker();
    const listener = vi.fn();

    tracker.onMeasurement(listener);
    tracker.clear();

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);
    tracker.markStart('app', 'load');
    tracker.markEnd('app', 'load');

    expect(listener).not.toHaveBeenCalled();
  });

  it('리스너가 에러를 던져도 다른 리스너는 실행된다', () => {
    const tracker = new PerfTracker();
    const listener1 = vi.fn(() => {
      throw new Error('리스너 에러');
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
