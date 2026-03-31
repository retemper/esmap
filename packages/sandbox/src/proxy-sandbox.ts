/** Options for the proxy-based sandbox */
interface ProxySandboxOptions {
  /** Identifying name for the sandbox instance */
  readonly name: string;
  /** List of properties to read directly from the real window (defaults provided) */
  readonly allowList?: ReadonlyArray<PropertyKey>;
}

/** Proxy-based sandbox that isolates properties without polluting the real window */
const DEFAULT_ALLOW_LIST: ReadonlyArray<PropertyKey> = [
  'document',
  'location',
  'history',
  'navigator',
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'fetch',
  'performance',
];

/** Sandbox class that uses Proxy to isolate window property modifications */
class ProxySandbox {
  /** Sandbox name */
  readonly name: string;

  /** Whether the sandbox is currently active */
  private active = false;

  /** Internal map storing modified properties */
  private readonly modifiedPropsMap = new Map<PropertyKey, unknown>();

  /** Set tracking deleted properties */
  private readonly deletedPropsSet = new Set<PropertyKey>();

  /** List of properties to read directly from the real window */
  private readonly allowList: ReadonlySet<PropertyKey>;

  /** Proxy object exposed externally */
  readonly proxy: Window;

  /** Creates a ProxySandbox instance with the given options */
  constructor(options: ProxySandboxOptions) {
    this.name = options.name;
    this.allowList = new Set(options.allowList ?? DEFAULT_ALLOW_LIST);

    const modifiedPropsMap = this.modifiedPropsMap;
    const deletedPropsSet = this.deletedPropsSet;
    const allowList = this.allowList;
    const sandbox = this;

    const fakeWindow = Object.create(null) as Window;

    this.proxy = new Proxy(fakeWindow, {
      /** Property read: looks up in internal map > allowList > window, in order */
      get(_target, prop, _receiver): unknown {
        if (modifiedPropsMap.has(prop)) {
          return modifiedPropsMap.get(prop);
        }

        if (deletedPropsSet.has(prop)) {
          return undefined;
        }

        const value: unknown = Reflect.get(window, prop);

        if (allowList.has(prop) && typeof value === 'function') {
          return value.bind(window);
        }

        return value;
      },

      /** Property write: stores in internal map only when active */
      set(_target, prop, value): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.set(prop, value);
        deletedPropsSet.delete(prop);
        return true;
      },

      /** Property existence check: checks both internal map and window */
      has(_target, prop): boolean {
        if (deletedPropsSet.has(prop)) {
          return false;
        }
        return modifiedPropsMap.has(prop) || prop in window;
      },

      /** Property deletion: removes only from internal map */
      deleteProperty(_target, prop): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.delete(prop);
        deletedPropsSet.add(prop);
        return true;
      },

      /** Enumerable property list: merges sandbox modifications with window properties */
      ownKeys(): ArrayLike<string | symbol> {
        const windowKeys = Object.getOwnPropertyNames(window);
        const allKeys = new Set<string | symbol>(windowKeys);

        for (const key of modifiedPropsMap.keys()) {
          allKeys.add(key as string | symbol);
        }
        for (const key of deletedPropsSet) {
          allKeys.delete(key as string | symbol);
        }

        return [...allKeys];
      },

      /** Property descriptor lookup: returns modified properties as configurable + enumerable */
      getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
        if (modifiedPropsMap.has(prop)) {
          return {
            value: modifiedPropsMap.get(prop),
            writable: true,
            configurable: true,
            enumerable: true,
          };
        }

        if (deletedPropsSet.has(prop)) {
          return undefined;
        }

        const descriptor = Object.getOwnPropertyDescriptor(window, prop);
        if (descriptor) {
          return { ...descriptor, configurable: true };
        }
        return undefined;
      },

      /** Property definition: stores in internal map only when active */
      defineProperty(_target, prop, descriptor): boolean {
        if (!sandbox.active) {
          return true;
        }

        modifiedPropsMap.set(prop, descriptor.value);
        deletedPropsSet.delete(prop);
        return true;
      },
    });
  }

  /** Activates the sandbox and restores previous modifications if any */
  activate(): void {
    this.active = true;
  }

  /** Deactivates the sandbox */
  deactivate(): void {
    this.active = false;
  }

  /** Returns the list of property names modified so far */
  getModifiedProps(): ReadonlyArray<PropertyKey> {
    return [...this.modifiedPropsMap.keys()];
  }

  /** Returns whether the sandbox is currently active */
  isActive(): boolean {
    return this.active;
  }
}

export { ProxySandbox, DEFAULT_ALLOW_LIST };
export type { ProxySandboxOptions };
