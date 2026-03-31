import { InjectionToken, type Signal } from '@angular/core';

/**
 * Injection token for esmap props passed from the host application.
 * Angular components inject this to receive cross-framework props.
 *
 * @example
 * ```ts
 * import { Component, inject } from '@angular/core';
 * import { ESMAP_PROPS } from '@esmap/angular';
 *
 * @Component({ selector: 'app-root', template: '{{ props().name }}' })
 * export class AppComponent {
 *   readonly props = inject(ESMAP_PROPS);
 * }
 * ```
 */
export const ESMAP_PROPS = new InjectionToken<Signal<Readonly<Record<string, unknown>>>>(
  'ESMAP_PROPS',
);
