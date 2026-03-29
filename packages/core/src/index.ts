export { createEsmap } from './create-esmap.js';
export { installAutoPerf } from './auto-perf.js';
export type { EsmapOptions, EsmapInstance } from './types.js';
export type { EsmapPlugin, PluginContext, PluginCleanup } from './plugin.js';
export { installPlugins, runCleanups } from './plugin.js';

export { guardPlugin } from './plugins/guard-plugin.js';
export type { GuardPluginOptions } from './plugins/guard-plugin.js';
export { sandboxPlugin } from './plugins/sandbox-plugin.js';
export type { SandboxPluginOptions } from './plugins/sandbox-plugin.js';
export { communicationPlugin } from './plugins/communication-plugin.js';
export type {
  CommunicationPluginOptions,
  CommunicationResources,
} from './plugins/communication-plugin.js';
export { keepAlivePlugin } from './plugins/keep-alive-plugin.js';
export type { KeepAlivePluginOptions } from './plugins/keep-alive-plugin.js';
export { domIsolationPlugin } from './plugins/dom-isolation-plugin.js';
export type { DomIsolationPluginOptions } from './plugins/dom-isolation-plugin.js';
export { intelligentPrefetchPlugin } from './plugins/intelligent-prefetch-plugin.js';
export type {
  IntelligentPrefetchPluginOptions,
  IntelligentPrefetchPluginResult,
} from './plugins/intelligent-prefetch-plugin.js';
