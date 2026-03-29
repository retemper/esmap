import { describe, it, expect } from 'vitest';
import { parseArgs, requireFlag } from './parse-args.js';

describe('parseArgs', () => {
  it('서브커맨드를 추출한다', () => {
    const result = parseArgs(['node', 'esmap', 'deploy']);

    expect(result.command).toBe('deploy');
    expect(result.help).toBe(false);
  });

  it('--key value 형태의 플래그를 파싱한다', () => {
    const result = parseArgs([
      'node',
      'esmap',
      'deploy',
      '--server',
      'http://localhost:3000',
      '--name',
      '@flex/checkout',
    ]);

    expect(result.command).toBe('deploy');
    expect(result.flags).toStrictEqual({
      server: 'http://localhost:3000',
      name: '@flex/checkout',
    });
  });

  it('--help 플래그를 인식한다', () => {
    const result = parseArgs(['node', 'esmap', '--help']);

    expect(result.help).toBe(true);
  });

  it('-h 단축 플래그를 인식한다', () => {
    const result = parseArgs(['node', 'esmap', '-h']);

    expect(result.help).toBe(true);
  });

  it('커맨드와 --help을 함께 사용할 수 있다', () => {
    const result = parseArgs(['node', 'esmap', 'deploy', '--help']);

    expect(result.command).toBe('deploy');
    expect(result.help).toBe(true);
  });

  it('인자가 없으면 command가 undefined이다', () => {
    const result = parseArgs(['node', 'esmap']);

    expect(result.command).toBeUndefined();
    expect(result.flags).toStrictEqual({});
  });

  it('값 없는 플래그는 "true"로 처리한다', () => {
    const result = parseArgs(['node', 'esmap', 'status', '--verbose']);

    expect(result.flags.verbose).toBe('true');
  });
});

describe('requireFlag', () => {
  it('존재하는 플래그 값을 반환한다', () => {
    const result = requireFlag({ server: 'http://localhost' }, 'server', 'test');

    expect(result).toBe('http://localhost');
  });

  it('플래그가 없으면 에러를 던진다', () => {
    expect(() => requireFlag({}, 'server', 'deploy')).toThrow(
      "Missing required flag --server for 'deploy' command",
    );
  });

  it('플래그 값이 "true"(값 없음)이면 에러를 던진다', () => {
    expect(() => requireFlag({ server: 'true' }, 'server', 'deploy')).toThrow(
      "Missing required flag --server for 'deploy' command",
    );
  });
});
