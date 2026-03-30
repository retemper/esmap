/**
 * Inter-app communication plugin.
 * Creates EventBus and GlobalState, connects them to PluginContext,
 * and automatically cleans up on destroy.
 */

import { createEventBus, createGlobalState } from '@esmap/communication';
import type { EventBus, EventMap, GlobalState } from '@esmap/communication';
import type { EsmapPlugin, PluginCleanup, PluginContext } from '../plugin.js';

/** Communication plugin options */
export interface CommunicationPluginOptions<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Maximum number of event history entries to retain. Default 100. */
  readonly maxEventHistory?: number;
  /** Initial global state value. Defaults to empty object if not specified. */
  readonly initialState?: TState;
  /** Event handler error callback */
  readonly onEventError?: (event: string, error: unknown) => void;
  /** Event map for type safety (no runtime effect, used for type inference only) */
  readonly _events?: TEvents;
}

/** Resources returned by the communication plugin */
export interface CommunicationResources<
  TEvents extends EventMap = EventMap,
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Type-safe event bus */
  readonly eventBus: EventBus<TEvents>;
  /** Global state */
  readonly globalState: GlobalState<TState>;
}

/**
 * Creates the inter-app communication plugin.
 * Provides EventBus and GlobalState, with automatic cleanup on destroy.
 *
 * @param options - communication plugin options
 * @returns EsmapPlugin instance and resource accessor
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

  // The default value for TState generic is Record<string, unknown>, so {} is safe.
  // TypeScript does not allow assigning literals to generic types, so an assertion is needed.
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
