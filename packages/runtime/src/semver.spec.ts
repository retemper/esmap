import { describe, it, expect } from 'vitest';
import { parseSemver, compareVersions, satisfiesRange } from './semver.js';

describe('parseSemver', () => {
  it('major.minor.patch 형식을 파싱한다', () => {
    expect(parseSemver('18.3.1')).toStrictEqual({ major: 18, minor: 3, patch: 1 });
  });

  it('major.minor 형식에서 patch를 0으로 설정한다', () => {
    expect(parseSemver('18.3')).toStrictEqual({ major: 18, minor: 3, patch: 0 });
  });

  it('major만 있을 때 minor와 patch를 0으로 설정한다', () => {
    expect(parseSemver('18')).toStrictEqual({ major: 18, minor: 0, patch: 0 });
  });

  it('v 접두사를 제거하고 파싱한다', () => {
    expect(parseSemver('v1.2.3')).toStrictEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('0.0.0 버전을 파싱한다', () => {
    expect(parseSemver('0.0.0')).toStrictEqual({ major: 0, minor: 0, patch: 0 });
  });

  it('유효하지 않은 문자열에서 에러를 던진다', () => {
    expect(() => parseSemver('abc')).toThrow('유효하지 않은 semver 버전');
  });

  it('빈 문자열에서 에러를 던진다', () => {
    expect(() => parseSemver('')).toThrow('유효하지 않은 semver 버전');
  });

  it('세그먼트가 4개 이상이면 에러를 던진다', () => {
    expect(() => parseSemver('1.2.3.4')).toThrow('유효하지 않은 semver 버전');
  });
});

describe('compareVersions', () => {
  it('동일한 버전이면 0을 반환한다', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toStrictEqual(0);
  });

  it('major가 더 크면 1을 반환한다', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toStrictEqual(1);
  });

  it('major가 더 작으면 -1을 반환한다', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toStrictEqual(-1);
  });

  it('minor로 비교한다', () => {
    expect(compareVersions('1.3.0', '1.2.0')).toStrictEqual(1);
    expect(compareVersions('1.2.0', '1.3.0')).toStrictEqual(-1);
  });

  it('patch로 비교한다', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toStrictEqual(1);
    expect(compareVersions('1.2.3', '1.2.4')).toStrictEqual(-1);
  });

  it('0.0.0과 0.0.0은 같다', () => {
    expect(compareVersions('0.0.0', '0.0.0')).toStrictEqual(0);
  });
});

describe('satisfiesRange', () => {
  describe('정확 일치', () => {
    it('동일한 버전이면 만족한다', () => {
      expect(satisfiesRange('1.2.3', '1.2.3')).toStrictEqual(true);
    });

    it('다른 버전이면 만족하지 않는다', () => {
      expect(satisfiesRange('1.2.4', '1.2.3')).toStrictEqual(false);
    });
  });

  describe('>= 범위', () => {
    it('같은 버전이면 만족한다', () => {
      expect(satisfiesRange('18.0.0', '>=18.0.0')).toStrictEqual(true);
    });

    it('더 높은 버전이면 만족한다', () => {
      expect(satisfiesRange('19.0.0', '>=18.0.0')).toStrictEqual(true);
    });

    it('더 낮은 버전이면 만족하지 않는다', () => {
      expect(satisfiesRange('17.0.0', '>=18.0.0')).toStrictEqual(false);
    });
  });

  describe('^ (caret) 범위', () => {
    it('^18.0.0에서 18.3.1은 만족한다', () => {
      expect(satisfiesRange('18.3.1', '^18.0.0')).toStrictEqual(true);
    });

    it('^18.0.0에서 18.0.0은 만족한다', () => {
      expect(satisfiesRange('18.0.0', '^18.0.0')).toStrictEqual(true);
    });

    it('^18.0.0에서 19.0.0은 만족하지 않는다', () => {
      expect(satisfiesRange('19.0.0', '^18.0.0')).toStrictEqual(false);
    });

    it('^18.0.0에서 17.9.9는 만족하지 않는다', () => {
      expect(satisfiesRange('17.9.9', '^18.0.0')).toStrictEqual(false);
    });

    it('^18.2.0에서 18.1.9는 만족하지 않는다', () => {
      expect(satisfiesRange('18.1.9', '^18.2.0')).toStrictEqual(false);
    });

    it('^18.2.3에서 18.2.2는 만족하지 않는다', () => {
      expect(satisfiesRange('18.2.2', '^18.2.3')).toStrictEqual(false);
    });

    it('^0.2.3에서 0.2.5는 만족한다', () => {
      expect(satisfiesRange('0.2.5', '^0.2.3')).toStrictEqual(true);
    });

    it('^0.2.3에서 0.3.0은 만족하지 않는다', () => {
      expect(satisfiesRange('0.3.0', '^0.2.3')).toStrictEqual(false);
    });

    it('^0.0.3에서 0.0.3은 만족한다', () => {
      expect(satisfiesRange('0.0.3', '^0.0.3')).toStrictEqual(true);
    });

    it('^0.0.3에서 0.0.4는 만족하지 않는다', () => {
      expect(satisfiesRange('0.0.4', '^0.0.3')).toStrictEqual(false);
    });
  });

  describe('~ (tilde) 범위', () => {
    it('~18.3.0에서 18.3.5는 만족한다', () => {
      expect(satisfiesRange('18.3.5', '~18.3.0')).toStrictEqual(true);
    });

    it('~18.3.0에서 18.3.0은 만족한다', () => {
      expect(satisfiesRange('18.3.0', '~18.3.0')).toStrictEqual(true);
    });

    it('~18.3.0에서 18.4.0은 만족하지 않는다', () => {
      expect(satisfiesRange('18.4.0', '~18.3.0')).toStrictEqual(false);
    });

    it('~18.3.0에서 18.2.9는 만족하지 않는다', () => {
      expect(satisfiesRange('18.2.9', '~18.3.0')).toStrictEqual(false);
    });

    it('~18.3.0에서 19.3.0은 만족하지 않는다', () => {
      expect(satisfiesRange('19.3.0', '~18.3.0')).toStrictEqual(false);
    });

    it('~1.2.3에서 1.2.2는 만족하지 않는다', () => {
      expect(satisfiesRange('1.2.2', '~1.2.3')).toStrictEqual(false);
    });
  });
});
