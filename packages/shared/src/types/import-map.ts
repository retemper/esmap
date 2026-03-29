/**
 * W3C Import Map JSON 스키마.
 * @see https://html.spec.whatwg.org/multipage/webappapis.html#import-maps
 */
export interface ImportMap {
  /** bare specifier → URL 매핑 */
  readonly imports: Readonly<Record<string, string>>;
  /** URL prefix별 오버라이드 매핑 */
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** SRI integrity 해시 (specifier → integrity string) */
  readonly integrity?: Readonly<Record<string, string>>;
}

/** import map의 단일 매핑 항목 */
export interface ImportMapEntry {
  /** bare specifier (예: "react", "@flex/checkout") */
  readonly specifier: string;
  /** 해석될 URL */
  readonly url: string;
}

/** import map merge 시 충돌 해결 전략 */
export type ImportMapMergeStrategy = 'override' | 'skip' | 'error';
