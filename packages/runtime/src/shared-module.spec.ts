import { describe, it, expect, vi } from 'vitest';
import { createSharedModuleRegistry, SharedVersionConflictError } from './shared-module.js';
import type { SharedModuleConfig } from './shared-module.js';

/** 테스트용 공유 모듈 설정을 생성한다. */
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
    it('모듈을 등록한다', () => {
      const registry = createSharedModuleRegistry();
      const config = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config);

      const registered = registry.getRegistered();
      expect(registered.get('react')).toStrictEqual([config]);
    });

    it('같은 이름으로 여러 버전을 등록한다', () => {
      const registry = createSharedModuleRegistry();
      const config1 = createMockConfig({ name: 'react', version: '18.2.0' });
      const config2 = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config1);
      registry.register(config2);

      const registered = registry.getRegistered();
      expect(registered.get('react')).toStrictEqual([config1, config2]);
    });

    it('서로 다른 이름의 모듈을 독립적으로 등록한다', () => {
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
    it('등록된 모듈을 로드하여 반환한다', async () => {
      const registry = createSharedModuleRegistry();
      const mockModule = { default: 'react-module' };
      const config = createMockConfig({ name: 'react', version: '18.3.1' });
      vi.mocked(config.factory).mockResolvedValue(mockModule);

      registry.register(config);
      const result = await registry.resolve('react');

      expect(result).toStrictEqual(mockModule);
    });

    it('등록되지 않은 모듈을 resolve하면 에러를 던진다', async () => {
      const registry = createSharedModuleRegistry();

      await expect(registry.resolve('unknown')).rejects.toThrow(SharedVersionConflictError);
    });

    it('이미 로드된 모듈은 캐시에서 반환한다', async () => {
      const registry = createSharedModuleRegistry();
      const config = createMockConfig({ name: 'react', version: '18.3.1' });

      registry.register(config);
      await registry.resolve('react');
      await registry.resolve('react');

      expect(config.factory).toHaveBeenCalledTimes(1);
    });

    it('여러 버전 중 가장 높은 호환 버전을 선택한다', async () => {
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

    it('requiredVersion 제약을 만족하는 버전만 선택한다', async () => {
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

  describe('inflight dedup — 동시 resolve 중복 방지', () => {
    it('동시에 같은 모듈을 resolve하면 factory를 한 번만 호출한다', async () => {
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
    it('singleton 모드에서 첫 번째 resolve 결과를 재사용한다', async () => {
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

    it('singleton에서 로드된 모듈 정보를 getLoaded로 확인한다', async () => {
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

  describe('버전 충돌', () => {
    it('strictVersion이면 호환 버전이 없을 때 에러를 던진다', async () => {
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

    it('strictVersion이 아니면 경고 후 최고 버전을 사용한다', async () => {
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

    it('여러 requiredVersion이 동시에 만족되는 버전을 선택한다', async () => {
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

      // ^18.0.0과 ~18.3.0을 모두 만족하는 18.3.1이 선택되어야 함
      const result = await registry.resolve('react');
      expect(result).toStrictEqual(targetModule);
    });

    it('strictVersion 에러에 모듈 이름이 포함된다', async () => {
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
        expect.fail('에러가 발생해야 합니다');
      } catch (error) {
        expect(error).toBeInstanceOf(SharedVersionConflictError);
        const conflictError = error instanceof SharedVersionConflictError ? error : undefined;
        expect(conflictError?.moduleName).toStrictEqual('react-dom');
      }
    });
  });

  describe('fallback factory', () => {
    it('호환 버전이 없고 fallback이 있으면 fallback을 사용한다', async () => {
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

      // strictVersion이지만 fallback이 우선
      const result = await registry.resolve('react');
      expect(result).toStrictEqual(fallbackModule);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fallback'));

      warnSpy.mockRestore();
    });
  });

  describe('eager 로딩', () => {
    it('eager: true면 register 시점에 즉시 로드를 시작한다', async () => {
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

      // factory가 register 시점에 호출되었어야 함
      expect(factory).toHaveBeenCalledTimes(1);
      // 이후 resolve는 캐시에서 반환
      const result = await registry.resolve('react');
      expect(result).toStrictEqual({ eager: true });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('waitForEager는 모든 eager 모듈이 로드될 때까지 기다린다', async () => {
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

    it('eager 로드 실패해도 waitForEager는 reject하지 않는다', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'broken',
          version: '1.0.0',
          eager: true,
          factory: vi.fn().mockRejectedValue(new Error('로드 실패')),
        }),
      );

      // waitForEager는 에러를 삼킨다
      await expect(registry.waitForEager()).resolves.toBeUndefined();
    });
  });

  describe('resolveSubpath — subpath exports', () => {
    it('subpath 팩토리를 통해 하위 모듈을 로드한다', async () => {
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

    it('subpath 결과를 캐시한다', async () => {
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

    it('등록되지 않은 subpath를 요청하면 에러를 던진다', async () => {
      const registry = createSharedModuleRegistry();

      registry.register(
        createMockConfig({
          name: 'react-dom',
          version: '18.3.1',
        }),
      );

      await expect(
        registry.resolveSubpath('react-dom', './nonexistent'),
      ).rejects.toThrow('subpath "./nonexistent"가 등록되지 않았습니다');
    });

    it('미등록 모듈의 subpath를 요청하면 에러를 던진다', async () => {
      const registry = createSharedModuleRegistry();

      await expect(
        registry.resolveSubpath('unknown', './client'),
      ).rejects.toThrow(SharedVersionConflictError);
    });
  });

  describe('from — 등록자 추적', () => {
    it('로드된 모듈에 등록자 정보가 포함된다', async () => {
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
    it('빈 레지스트리에서 빈 Map을 반환한다', () => {
      const registry = createSharedModuleRegistry();
      expect(registry.getRegistered().size).toStrictEqual(0);
    });
  });

  describe('getLoaded', () => {
    it('아무것도 로드하지 않았으면 빈 Map을 반환한다', () => {
      const registry = createSharedModuleRegistry();
      expect(registry.getLoaded().size).toStrictEqual(0);
    });

    it('로드 후 버전과 모듈 인스턴스를 포함한다', async () => {
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
