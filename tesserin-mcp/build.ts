/**
 * tesserin-mcp/build.ts
 * esbuild bundle script — produces a single self-contained dist/index.js.
 * Run with:  node --experimental-strip-types build.ts
 * Or from root: pnpm mcp:build
 */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('dist', { recursive: true })

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  // Shebang so the file can be run directly after chmod +x
  banner: { js: '#!/usr/bin/env node' },
  // Keep readable for debugging; set to true for production releases
  minify: false,
  sourcemap: false,
  // Exclude only truly native addons — bundle the MCP SDK and Zod
  external: [],
  // Log to stderr so we can pipe stdout cleanly
  logLevel: 'info',
})

console.log('\n✅  tesserin-mcp bundled → dist/index.js')
console.log('   Run: node tesserin-mcp/dist/index.js')
console.log('   HTTP: node tesserin-mcp/dist/index.js --http')
