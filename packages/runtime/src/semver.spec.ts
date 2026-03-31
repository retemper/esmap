import { describe, it, expect } from 'vitest';
import { parseSemver, compareVersions, satisfiesRange } from './semver.js';

describe('parseSemver', () => {
  it('parses major.minor.patch format', () => {
    expect(parseSemver('18.3.1')).toStrictEqual({ major: 18, minor: 3, patch: 1 });
  });

  it('sets patch to 0 for major.minor format', () => {
    expect(parseSemver('18.3')).toStrictEqual({ major: 18, minor: 3, patch: 0 });
  });

  it('sets minor and patch to 0 when only major is provided', () => {
    expect(parseSemver('18')).toStrictEqual({ major: 18, minor: 0, patch: 0 });
  });

  it('strips the v prefix and parses', () => {
    expect(parseSemver('v1.2.3')).toStrictEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses version 0.0.0', () => {
    expect(parseSemver('0.0.0')).toStrictEqual({ major: 0, minor: 0, patch: 0 });
  });

  it('throws an error for invalid strings', () => {
    expect(() => parseSemver('abc')).toThrow('Invalid semver version');
  });

  it('throws an error for empty strings', () => {
    expect(() => parseSemver('')).toThrow('Invalid semver version');
  });

  it('throws an error when there are 4 or more segments', () => {
    expect(() => parseSemver('1.2.3.4')).toThrow('Invalid semver version');
  });
});

describe('compareVersions', () => {
  it('returns 0 for identical versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toStrictEqual(0);
  });

  it('returns 1 when major is greater', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toStrictEqual(1);
  });

  it('returns -1 when major is less', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toStrictEqual(-1);
  });

  it('compares by minor', () => {
    expect(compareVersions('1.3.0', '1.2.0')).toStrictEqual(1);
    expect(compareVersions('1.2.0', '1.3.0')).toStrictEqual(-1);
  });

  it('compares by patch', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toStrictEqual(1);
    expect(compareVersions('1.2.3', '1.2.4')).toStrictEqual(-1);
  });

  it('0.0.0 and 0.0.0 are equal', () => {
    expect(compareVersions('0.0.0', '0.0.0')).toStrictEqual(0);
  });
});

describe('satisfiesRange', () => {
  describe('exact match', () => {
    it('satisfies when versions are identical', () => {
      expect(satisfiesRange('1.2.3', '1.2.3')).toStrictEqual(true);
    });

    it('does not satisfy when versions differ', () => {
      expect(satisfiesRange('1.2.4', '1.2.3')).toStrictEqual(false);
    });
  });

  describe('>= range', () => {
    it('satisfies for the same version', () => {
      expect(satisfiesRange('18.0.0', '>=18.0.0')).toStrictEqual(true);
    });

    it('satisfies for a higher version', () => {
      expect(satisfiesRange('19.0.0', '>=18.0.0')).toStrictEqual(true);
    });

    it('does not satisfy for a lower version', () => {
      expect(satisfiesRange('17.0.0', '>=18.0.0')).toStrictEqual(false);
    });
  });

  describe('^ (caret) range', () => {
    it('18.3.1 satisfies ^18.0.0', () => {
      expect(satisfiesRange('18.3.1', '^18.0.0')).toStrictEqual(true);
    });

    it('18.0.0 satisfies ^18.0.0', () => {
      expect(satisfiesRange('18.0.0', '^18.0.0')).toStrictEqual(true);
    });

    it('19.0.0 does not satisfy ^18.0.0', () => {
      expect(satisfiesRange('19.0.0', '^18.0.0')).toStrictEqual(false);
    });

    it('17.9.9 does not satisfy ^18.0.0', () => {
      expect(satisfiesRange('17.9.9', '^18.0.0')).toStrictEqual(false);
    });

    it('18.1.9 does not satisfy ^18.2.0', () => {
      expect(satisfiesRange('18.1.9', '^18.2.0')).toStrictEqual(false);
    });

    it('18.2.2 does not satisfy ^18.2.3', () => {
      expect(satisfiesRange('18.2.2', '^18.2.3')).toStrictEqual(false);
    });

    it('0.2.5 satisfies ^0.2.3', () => {
      expect(satisfiesRange('0.2.5', '^0.2.3')).toStrictEqual(true);
    });

    it('0.3.0 does not satisfy ^0.2.3', () => {
      expect(satisfiesRange('0.3.0', '^0.2.3')).toStrictEqual(false);
    });

    it('0.0.3 satisfies ^0.0.3', () => {
      expect(satisfiesRange('0.0.3', '^0.0.3')).toStrictEqual(true);
    });

    it('0.0.4 does not satisfy ^0.0.3', () => {
      expect(satisfiesRange('0.0.4', '^0.0.3')).toStrictEqual(false);
    });
  });

  describe('~ (tilde) range', () => {
    it('18.3.5 satisfies ~18.3.0', () => {
      expect(satisfiesRange('18.3.5', '~18.3.0')).toStrictEqual(true);
    });

    it('18.3.0 satisfies ~18.3.0', () => {
      expect(satisfiesRange('18.3.0', '~18.3.0')).toStrictEqual(true);
    });

    it('18.4.0 does not satisfy ~18.3.0', () => {
      expect(satisfiesRange('18.4.0', '~18.3.0')).toStrictEqual(false);
    });

    it('18.2.9 does not satisfy ~18.3.0', () => {
      expect(satisfiesRange('18.2.9', '~18.3.0')).toStrictEqual(false);
    });

    it('19.3.0 does not satisfy ~18.3.0', () => {
      expect(satisfiesRange('19.3.0', '~18.3.0')).toStrictEqual(false);
    });

    it('1.2.2 does not satisfy ~1.2.3', () => {
      expect(satisfiesRange('1.2.2', '~1.2.3')).toStrictEqual(false);
    });
  });
});
