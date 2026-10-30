// Builds one zip per store family from the single extension/ source.
// Firefox needs background.scripts; Chrome and Edge reject it in Manifest V3 and use service_worker.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const source = join(root, 'extension');
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
const { version } = manifest;

function pack(sourceDir, filename) {
  const result = spawnSync(
    'npx',
    ['web-ext', 'build', '--source-dir', sourceDir, '--artifacts-dir', join(root, 'dist'), '--filename', filename, '--overwrite-dest'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

pack(source, `fontwise-${version}-firefox.zip`);

const staging = mkdtempSync(join(tmpdir(), 'fontwise-chromium-'));
try {
  cpSync(source, staging, { recursive: true });
  const chromium = structuredClone(manifest);
  delete chromium.background.scripts;
  delete chromium.browser_specific_settings;
  writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(chromium, null, 4)}\n`);
  pack(staging, `fontwise-${version}-chromium.zip`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
