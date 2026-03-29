export { generateImportMap } from './generate/index.js';
export type { GenerateInput, GenerateResult } from './generate/index.js';

export { analyzeDependencyConflicts } from './analyze-deps.js';
export type {
  AppDependencyDeclaration,
  DependencyConflict,
  DependencyAnalysisResult,
} from './analyze-deps.js';

export { extractDeclarationsFromManifests } from './analyze-manifests.js';
