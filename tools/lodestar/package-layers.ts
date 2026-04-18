import { definePlugin, defineRule } from '@retemper/lodestar';

interface PackageLayer {
  readonly name: string;
  readonly path: string;
  readonly canImport?: readonly string[];
}

interface PackageLayersOptions {
  readonly layers: readonly PackageLayer[];
  readonly allowTypeOnly?: boolean;
}

const packageLayersRule = defineRule<PackageLayersOptions>({
  name: 'package-layers',
  description:
    'Enforces cross-package dependency direction by package-name imports (e.g., "@scope/pkg"). Complements architecture/layers which only handles relative imports.',
  needs: ['fs', 'ast'],
  schema: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            canImport: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'path'],
        },
      },
      allowTypeOnly: { type: 'boolean' },
    },
    required: ['layers'],
  },
  async check(ctx) {
    const { layers, allowTypeOnly = false } = ctx.options;

    const fileToLayer = new Map<string, PackageLayer>();
    for (const layer of layers) {
      const files = await ctx.providers.fs.glob(layer.path);
      for (const file of files) {
        fileToLayer.set(file, layer);
      }
    }

    const layerNames = layers.map((l) => l.name);

    for (const [file, sourceLayer] of fileToLayer) {
      const imports = await ctx.providers.ast.getImports(file);
      const allowed = new Set(sourceLayer.canImport ?? []);

      for (const imp of imports) {
        if (allowTypeOnly && imp.isTypeOnly) continue;

        const targetLayer = layerNames.find(
          (name) => imp.source === name || imp.source.startsWith(`${name}/`),
        );
        if (!targetLayer) continue;
        if (targetLayer === sourceLayer.name) continue;

        if (!allowed.has(targetLayer)) {
          ctx.report({
            message: `Package "${sourceLayer.name}" cannot import from "${targetLayer}" — not listed in canImport`,
            location: imp.location,
          });
        }
      }
    }

    ctx.meta(`${fileToLayer.size} files, ${layers.length} packages`);
  },
});

export const packageLayersPlugin = definePlugin(() => ({
  name: 'esmap',
  rules: [packageLayersRule],
}));
