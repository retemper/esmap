/**
 * Seed script that initializes the import map server with local build artifacts.
 * Reads esmap-manifest.json and shared-deps-manifest.json from the dist/ directory
 * to compose the server's import map.
 *
 * Usage: pnpm seed (run after pnpm build)
 *
 * When the --dev flag is passed, MFE app entries are mapped to their respective Vite dev server URLs.
 * Shared dependencies and design system use the built artifacts as-is.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ImportMap, MfeManifest } from '@esmap/shared';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../../dist');
const DATA_DIR = resolve(__dirname, '../../../data');

/** HOST_BASE is the host Vite dev server's /apps endpoint (resolved from the host origin when import map is injected with relative paths) */
const HOST_BASE = '/apps';

/** Whether the --dev flag is set. In dev mode, MFE apps point to individual Vite dev servers. */
const isDev = process.argv.includes('--dev');

/** Vite dev server port for each MFE app directory */
const DEV_PORTS: Record<string, number> = {
  auth: 3101,
  dashboard: 3102,
  'team-directory': 3103,
  'activity-feed': 3104,
  'task-board': 3105,
  notifications: 3106,
  'legacy-settings': 3107,
};

/** Entry file paths for apps that differ from the default entry (src/index.tsx) */
const DEV_ENTRIES: Record<string, string> = {
  'legacy-settings': 'src/index.ts',
};

/** Reads app name and entry from the manifest file and converts to an import map entry */
async function readManifest(appDir: string): Promise<{ name: string; entry: string } | null> {
  try {
    const manifestPath = join(DIST_DIR, 'apps', appDir, 'esmap-manifest.json');
    const content = await readFile(manifestPath, 'utf-8');
    const manifest: MfeManifest = JSON.parse(content);
    return { name: manifest.name, entry: manifest.entry };
  } catch {
    console.warn(`[seed] ${appDir}/esmap-manifest.json not found, skipping`);
    return null;
  }
}

/** Composes an import map from local build artifacts and saves it to the data directory */
async function seed(): Promise<void> {
  const imports: Record<string, string> = {};

  // 1. Shared dependency mapping
  try {
    const sharedManifestPath = join(DIST_DIR, 'shared', 'shared-deps-manifest.json');
    const sharedContent = await readFile(sharedManifestPath, 'utf-8');
    const sharedManifests: readonly { name: string; exports: Record<string, string> }[] =
      JSON.parse(sharedContent);

    for (const dep of sharedManifests) {
      const entryFile = dep.exports['.'];
      if (entryFile) {
        imports[dep.name] = `${HOST_BASE}/shared/${entryFile}`;
      }
    }
  } catch {
    console.warn('[seed] shared-deps-manifest.json not found, skipping shared dependencies');
  }

  // 2. Design system mapping
  try {
    const dsManifestPath = join(DIST_DIR, 'design-system', 'esmap-manifest.json');
    const dsContent = await readFile(dsManifestPath, 'utf-8');
    const dsManifest: MfeManifest = JSON.parse(dsContent);
    imports[dsManifest.name] = `${HOST_BASE}/design-system/${dsManifest.entry}`;
  } catch {
    console.warn('[seed] design-system manifest not found, skipping');
  }

  // 3. MFE app mapping
  const appDirs = [
    'auth',
    'dashboard',
    'team-directory',
    'activity-feed',
    'task-board',
    'notifications',
    'legacy-settings',
  ];

  if (isDev) {
    for (const appDir of appDirs) {
      const port = DEV_PORTS[appDir];
      if (port === undefined) {
        console.warn(`[seed] No dev port mapping for ${appDir}, skipping`);
        continue;
      }
      const entry = DEV_ENTRIES[appDir] ?? 'src/index.tsx';
      imports[`@enterprise/${appDir}`] = `http://localhost:${port}/${entry}`;
    }
  } else {
    for (const appDir of appDirs) {
      const result = await readManifest(appDir);
      if (result) {
        imports[result.name] = `${HOST_BASE}/${appDir}/${result.entry}`;
      }
    }
  }

  // 4. Write import map
  const importMap: ImportMap = { imports };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'importmap.json'), JSON.stringify(importMap, null, 2));
  await writeFile(join(DATA_DIR, 'history.json'), JSON.stringify([]));

  console.log('[seed] Import map generated:');
  console.log(JSON.stringify(importMap, null, 2));
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
