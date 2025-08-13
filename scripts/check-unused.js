#!/usr/bin/env node
/**
 * Simple unused module detector.
 * Scans .js files under src/ (recursively) and reports those never imported.
 * Heuristics: ignores index.js at root, CLI scripts, and deprecated shim files.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = new URL('../src', import.meta.url).pathname;

/** Collect all .js files */
function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectFiles(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = collectFiles(SRC_DIR);
const importRegex = /import\s+(?:[^'";]+?from\s+)?["']([^"']+)["']|await import\(\s*["']([^"']+)["']\s*\)/g;

// Build map of occurrences
const used = new Set();
for (const file of files) {
  const code = readFileSync(file, 'utf8');
  let m;
  while ((m = importRegex.exec(code))) {
    const spec = m[1] || m[2];
    if (!spec) continue;
    if (spec.startsWith('.') || spec.startsWith('/')) {
      // Resolve relative
      let resolved = spec.startsWith('.') ? join(file, '..', spec) : spec;
      if (!resolved.endsWith('.js')) resolved += '.js';
      used.add(resolved);
    }
  }
}

// Normalize file paths for comparison
function normalize(p) {
  return p.replace(/\\/g, '/');
}
const normalizedUsed = new Set(Array.from(used).map(normalize));

const unused = [];
for (const file of files) {
  const rel = normalize(file);
  // Skip self if imported as deprecated shim or is this script itself
  if (rel.includes('/scripts/check-unused.js')) continue;
  if (rel.endsWith('/index.js')) continue;
  if (rel.endsWith('cosineSimilarity.js') && rel.includes('/core/memory/')) continue; // deprecated shim
  if (!normalizedUsed.has(rel)) unused.push(relative(process.cwd(), file));
}

if (unused.length === 0) {
  console.log('✅ Nenhum módulo não utilizado detectado');
  process.exit(0);
}
console.log('⚠️ Módulos potencialmente não utilizados:');
for (const f of unused) console.log(' -', f);
process.exit(0); // Non-fatal for now
