// Bundles the viewer into dist/ (served by Electron via app:// and by nginx for the web version).
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const three = 'node_modules/three/examples/jsm/libs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/libs', { recursive: true });
cpSync('web/index.html', 'dist/index.html');
cpSync('web/style.css', 'dist/style.css');
cpSync('drc-icon.svg', 'dist/icon.svg');
// Full Draco decoder (the gltf/ variant can't decode point clouds).
for (const f of ['draco_decoder.wasm', 'draco_wasm_wrapper.js']) cpSync(`${three}/draco/${f}`, `dist/libs/draco/${f}`);
cpSync(`${three}/basis/basis_transcoder.js`, 'dist/libs/basis/basis_transcoder.js');
cpSync(`${three}/basis/basis_transcoder.wasm`, 'dist/libs/basis/basis_transcoder.wasm');

const options = {
  entryPoints: ['web/main.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !watch,
  sourcemap: watch,
  outfile: 'dist/viewer.js',
  logLevel: 'info',
};

if (watch) await (await esbuild.context(options)).watch();
else await esbuild.build(options);
