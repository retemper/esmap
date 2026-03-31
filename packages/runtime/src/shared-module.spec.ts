import { describe, it, expect, vi } from 'vitest';
import { createSharedModuleRegistry, SharedVersionConflictError } from './shared-module.js';
import type { SharedModuleConfig } from './shared-module.js';

/** Creates a mock shared module config for testing. */
function createMockConfig(
  overrides: Partial<SharedModuleConfig> & { name: string; version: string },
): SharedModuleConfig {
  return {
    factory: vi.fn().mockResolvedValue({ default: `mock-${overrides.name}` }),
    ...overrides,
  };
}

describe('SharedModuleRegistry', () => {
  describe('register', () => {
    it('registers a module', () => {
      const registry = createSharedModuleRegistry();
      const config = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config);

      const registered = registry.getRegistered();
      expect(registered.get('react')).toStrictEqual([config]);
    });

    it('registers multiple versions under the same name', () => {
      const registry = createSharedModuleRegistry();
      const config1 = createMockConfig({ name: 'react', version: '18.2.0' });
      const config2 = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config1);
      registry.register(config2);

      const registered = registry.getRegistered();
      expect(registered.get('react')).toStrictEqual([config1, config2]);
    });

    it('registers modules with different names independently', () => {
      const registry = createSharedModuleRegistry();
      const reactConfig = createMockConfig({ name: 'react', version: '18.3.1' });
      const vueConfig = createMockConfig({ name: 'vue', version: '3.4.0' });

      registry.register(reactConfig);
      registry.register(vueConfig);

      const registered = registry.getRegistered();
      expect(registered.size).toStrictEqual(2);
    });
  });

  describe('resolve', () => {
    it('loads and returns a registered module', async () => {
      const registry = createSharedModuleRegistry();
      const mockModule = { default: 'react-module' };
      const config = createMockConfig({ name: 'react', version: '18.3.1' });
      vi.mocked(config.factory).mockResolvedValue(mockModule);

      registry.register(config);
      const result = await registry.resolve('react');

      expect(result).toStrictEqual(mockModule);
    });

    it('throws an error when resolving an unregistered module', async () => {
      const registry = createSharedModuleRegistry();

      await expect(registry.resolve('unknown')).rejects.toThrow(SharedVersionConflictError);
    });

    it('returns an already loaded module from cache', async () => {
      const registry = createSharedModuleRegistry();
      const config = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config);
      await registry.resolve('react');
      await registry.resolve('react');

      expect(config.factory).toHaveBeenCalledTimes(1);
    });

    it('selects the highest compatible version among multiple versions', async () => {
      const registry = createSharedModuleRegistry();
      const oldModule = { version: 'old' };
      const newModule = { version: 'new' };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.2.0',
          requiredVersion: '^18.0.0',
          factory: vi.fn().mockResolvedValue(oldModule),
        }),
      );
      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          requiredVersion: '^18.0.0',
          factory: vi.fn().mockResolvedValue(newModule),
        }),
      );

      const result = await registry.resolve('react');
      expect(result).toStrictEqual(newModule);
    });

    it('selects only versions that satisfy the requiredVersion constraint', async () => {
      const registry = createSharedModuleRegistry();
      const v17Module = { version: '17' };
      const v18Module = { version: '18' };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '17.0.2',
          factory: vi.fn().mockResolvedValue(v17Module),
        }),
      );
      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          requiredVersion: '^18.0.0',
          factory: vi.fn().mockResolvedValue(v18Module),
        }),
      );

      const result = await registry.resolve('react');
      expect(result).toStrictEqual(v18Module);
    });
  });

  describe('inflight dedup — concurrent resolve deduplication', () => {
    it('calls factory only once when resolving the same module concurrently', async () => {
      const registry = createSharedModuleRegistry();
      const factory = vi.fn().mockResolvedValue({ shared: true });
      registry.register(createMockConfig({ name: 'react', version: '18.3.1', factory }));

      const [result1, result2] = await Promise.all([
        registry.resolve('react'),
        registry.resolve('react'),
      ]);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(result1).toStrictEqual(result2);
    });
  });

  describe('singleton', () => {
    it('reuses the first resolve result in singleton mode', async () => {
      const registry = createSharedModuleRegistry();
      const sharedModule = { shared: true };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.2.0',
          singleton: true,
          factory: vi.fn().mockResolvedValue(sharedModule),
        }),
      );
      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          singleton: true,
          factory: vi.fn().mockResolvedValue({ other: true }),
        }),
      );

      const first = await registry.resolve('react');
      const second = await registry.resolve('react');

      expect(first).toStrictEqual(second);
    });

    it('verifies loaded module info via getLoaded in singleton mode', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          singleton: true,
        }),
      );

      await registry.resolve('react');

      const loaded = registry.getLoaded();
      expect(loaded.get('react')?.version).toStrictEqual('18.3.1');
    });
  });

  describe('version conflict', () => {
    it('throws an error when no compatible version exists with strictVersion', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react',
          version: '17.0.2',
          requiredVersion: '^18.0.0',
          strictVersion: true,
        }),
      );

      await expect(registry.resolve('react')).rejects.toThrow(SharedVersionConflictError);
    });

    it('warns and uses the highest version without strictVersion', async () => {
      const registry = createSharedModuleRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const fallbackModule = { fallback: true };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '17.0.2',
          requiredVersion: '^18.0.0',
          factory: vi.fn().mockResolvedValue(fallbackModule),
        }),
      );

      const result = await registry.resolve('react');

      expect(result).toStrictEqual(fallbackModule);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[esmap]'));

      warnSpy.mockRestore();
    });

    it('selects a version that satisfies multiple requiredVersions simultaneously', async () => {
      const registry = createSharedModuleRegistry();
      const targetModule = { target: true };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.2.0',
          requiredVersion: '^18.0.0',
          factory: vi.fn().mockResolvedValue({ old: true }),
        }),
      );
      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          requiredVersion: '~18.3.0',
          factory: vi.fn().mockResolvedValue(targetModule),
        }),
      );

      // 18.3.1 should be selected as it satisfies both ^18.0.0 and ~18.3.0
      const result = await registry.resolve('react');
      expect(result).toStrictEqual(targetModule);
    });

    it('includes the module name in strictVersion errors', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react-dom',
          version: '17.0.2',
          requiredVersion: '^18.0.0',
          strictVersion: true,
        }),
      );

      try {
        await registry.resolve('react-dom');
        expect.fail('should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SharedVersionConflictError);
        const conflictError = error instanceof SharedVersionConflictError ? error : undefined;
        expect(conflictError?.moduleName).toStrictEqual('react-dom');
      }
    });
  });

  describe('fallback factory', () => {
    it('uses fallback when no compatible version exists and fallback is available', async () => {
      const registry = createSharedModuleRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const fallbackModule = { from: 'fallback' };

      registry.register(
        createMockConfig({
          name: 'react',
          version: '17.0.2',
          requiredVersion: '^18.0.0',
          strictVersion: true,
          fallback: vi.fn().mockResolvedValue(fallbackModule),
        }),
      );

      // strictVersion but fallback takes priority
      const result = await registry.resolve('react');
      expect(result).toStrictEqual(fallbackModule);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fallback'));

      warnSpy.mockRestore();
    });
  });

  describe('eager loading', () => {
    it('starts loading immediately at register time when eager is true', async () => {
      const registry = createSharedModuleRegistry();
      const factory = vi.fn().mockResolvedValue({ eager: true });

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          eager: true,
          factory,
        }),
      );

      await registry.waitForEager();

      // factory should have been called at register time
      expect(factory).toHaveBeenCalledTimes(1);
      // Subsequent resolve returns from cache
      const result = await registry.resolve('react');
      expect(result).toStrictEqual({ eager: true });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('waitForEager waits until all eager modules are loaded', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          eager: true,
          factory: vi.fn().mockResolvedValue({ name: 'react' }),
        }),
      );
      registry.register(
        createMockConfig({
          name: 'lodash',
          version: '4.17.21',
          eager: true,
          factory: vi.fn().mockResolvedValue({ name: 'lodash' }),
        }),
      );

      await registry.waitForEager();

      expect(registry.getLoaded().size).toBe(2);
    });

    it('waitForEager does not reject even when eager load fails', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'broken',
          version: '1.0.0',
          eager: true,
          factory: vi.fn().mockRejectedValue(new Error('load failed')),
        }),
      );

      // waitForEager swallows errors
      await expect(registry.waitForEager()).resolves.toBeUndefined();
    });
  });

  describe('resolveSubpath — subpath exports', () => {
    it('loads a sub-module via subpath factory', async () => {
      const registry = createSharedModuleRegistry();
      const clientModule = { createRoot: vi.fn() };

      registry.register(
        createMockConfig({
          name: 'react-dom',
          version: '18.3.1',
          subpaths: {
            './client': vi.fn().mockResolvedValue(clientModule),
          },
        }),
      );

      const result = await registry.resolveSubpath('react-dom', './client');
      expect(result).toStrictEqual(clientModule);
    });

    it('caches subpath results', async () => {
      const registry = createSharedModuleRegistry();
      const factory = vi.fn().mockResolvedValue({ cached: true });

      registry.register(
        createMockConfig({
          name: 'react-dom',
          version: '18.3.1',
          subpaths: { './client': factory },
        }),
      );

      await registry.resolveSubpath('react-dom', './client');
      await registry.resolveSubpath('react-dom', './client');

      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('throws an error when requesting an unregistered subpath', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react-dom',
          version: '18.3.1',
        }),
      );

      await expect(registry.resolveSubpath('react-dom', './nonexistent')).rejects.toThrow(
        'subpath "./nonexistent"',
      );
    });

    it('throws an error when requesting a subpath of an unregistered module', async () => {
      const registry = createSharedModuleRegistry();

      await expect(registry.resolveSubpath('unknown', './client')).rejects.toThrow(
        SharedVersionConflictError,
      );
    });
  });

  describe('from — registrant tracking', () => {
    it('includes registrant info in loaded modules', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react',
          version: '18.3.1',
          from: 'checkout-app',
        }),
      );

      await registry.resolve('react');

      const loaded = registry.getLoaded();
      expect(loaded.get('react')?.from).toBe('checkout-app');
    });
  });

  describe('getRegistered', () => {
    it('returns an empty Map for an empty registry', () => {
      const registry = createSharedModuleRegistry();
      expect(registry.getRegistered().size).toStrictEqual(0);
    });
  });

  describe('getLoaded', () => {
    it('returns an empty Map when nothing has been loaded', () => {
      const registry = createSharedModuleRegistry();
      expect(registry.getLoaded().size).toStrictEqual(0);
    });

    it('includes version and module instance after loading', async () => {
      const registry = createSharedModuleRegistry();
      const mockModule = { loaded: true };

      registry.register(
        createMockConfig({
          name: 'lodash',
          version: '4.17.21',
          factory: vi.fn().mockResolvedValue(mockModule),
        }),
      );

      await registry.resolve('lodash');

      const loaded = registry.getLoaded();
      expect(loaded.get('lodash')).toStrictEqual({
        version: '4.17.21',
        module: mockModule,
        from: undefined,
      });
    });
  });
});
