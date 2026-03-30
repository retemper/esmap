/**
 * W3C Import Map JSON schema.
 * @see https://html.spec.whatwg.org/multipage/webappapis.html#import-maps
 */
export interface ImportMap {
  /** bare specifier to URL mapping */
  readonly imports: Readonly<Record<string, string>>;
  /** Override mapping per URL prefix */
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** SRI integrity hash (specifier to integrity string) */
  readonly integrity?: Readonly<Record<string, string>>;
}

/** A single mapping entry in the import map */
export interface ImportMapEntry {
  /** bare specifier (e.g., "react", "@flex/checkout") */
  readonly specifier: string;
  /** Resolved URL */
  readonly url: string;
}

/** Conflict resolution strategy when merging import maps */
export type ImportMapMergeStrategy = 'override' | 'skip' | 'error';
