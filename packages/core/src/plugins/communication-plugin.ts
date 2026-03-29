/**
 * 앱 간 통신 플러그인.
 * EventBus와 GlobalState를 생성하여 PluginContext에 연결하고,
 * destroy 시 자동으로 정리한다.
 */

import { createEventBus, createGlobalState } from '@esmap/communication';
import type { EventBus, EventMap, GlobalState } from '@esmap/communication';
import type { EsmapPlugin, PluginCleanup, PluginContext } from '../plugin.js';

/** communication 플러그인 옵션 */
export interface CommunicationPluginOptions<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 이벤트 버스의 최대 이력 보관 수. 기본값 100. */
  readonly maxEventHistory?: number;
  /** 글로벌 상태 초기값. 미지정 시 빈 객체. */
  readonly initialState?: TState;
  /** 이벤트 핸들러 에러 콜백 */
  readonly onEventError?: (event: string, error: unknown) => void;
  /** 타입 안전을 위한 이벤트 맵 (런타임에는 영향 없음, 타입 추론용) */
  readonly _events?: TEvents;
}

/** communication 플러그인이 반환하는 리소스 */
export interface CommunicationResources<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 타입 안전한 이벤트 버스 */
  readonly eventBus: EventBus<TEvents>;
  /** 글로벌 상태 */
  readonly globalState: GlobalState<TState>;
}

/**
 * 앱 간 통신 플러그인을 생성한다.
 * EventBus와 GlobalState를 제공하며, destroy 시 자동 정리한다.
 *
 * @param options - communication 플러그인 옵션
 * @returns EsmapPlugin 인스턴스와 리소스 접근자
 *
 * @example
 * ```ts
 * const comm = communicationPlugin({ initialState: { user: null } });
 * const esmap = createEsmap({ config, plugins: [comm.plugin] });
 * comm.resources.eventBus.emit('user:login', { id: '123' });
 * ```
 */
export function communicationPlugin<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
>(
  options: CommunicationPluginOptions<TEvents, TState> = {},
): { readonly plugin: EsmapPlugin; readonly resources: CommunicationResources<TEvents, TState> } {
  const eventBus = createEventBus<TEvents>({
    maxHistory: options.maxEventHistory ?? 100,
    onHandlerError: options.onEventError,
  });

  // TState 제네릭의 기본값은 Record<string, unknown>이므로 {}는 안전하다.
  // TypeScript가 제네릭 타입에 리터럴을 할당하는 것을 허용하지 않아 단언이 필요하다.
  const initialState: TState = options.initialState ?? ({} as TState);
  const globalState = createGlobalState<TState>(initialState);

  const resources: CommunicationResources<TEvents, TState> = {
    eventBus,
    globalState,
  };

  const plugin: EsmapPlugin = {
    name: 'esmap:communication',

    install(_ctx: PluginContext): PluginCleanup {
      return () => {
        eventBus.clear();
        globalState.reset();
      };
    },
  };

  return { plugin, resources };
}
