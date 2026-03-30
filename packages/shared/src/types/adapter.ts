/**
 * Rendering protocol that framework adapters implement.
 * Each framework (React, Vue, Svelte, etc.) only needs to implement this interface
 * to automatically integrate with the esmap MFE lifecycle.
 *
 * @typeParam TContext - framework-specific rendering context (React Root, Vue App, etc.)
 */
export interface AdapterProtocol<TContext> {
  /** Creates the rendering context and performs the initial render (e.g., createRoot + render) */
  mount(container: HTMLElement): TContext;
  /** Re-renders when props change */
  update(context: TContext, props: Readonly<Record<string, unknown>>): void;
  /** Cleans up the context and restores the DOM */
  unmount(context: TContext, container: HTMLElement): void;
}

/**
 * Options for the defineAdapter factory.
 * @typeParam TContext - framework-specific rendering context
 */
export interface DefineAdapterOptions<TContext> {
  /** Framework name (used in error messages and debugging) */
  readonly name: string;
  /** Framework-specific rendering protocol */
  readonly protocol: AdapterProtocol<TContext>;
}
