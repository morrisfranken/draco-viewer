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

// `import source from 'worker:./file.js'` bundles that file as a worker and inlines it as
// a string (started from a Blob URL, which works both on file:// and on a web server).
// Workers only need three's core classes; resolving 'three' to the tree-shakeable sources
// (instead of the prebuilt bundle, renderer included) keeps them small.
const threeCore = {
  name: 'three-core',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: new URL('node_modules/three/src/Three.Core.js', import.meta.url).pathname }));
  },
};

const inlineWorker = {
  name: 'inline-worker',
  setup(build) {
    build.onResolve({ filter: /^worker:/ }, (args) => ({
      path: new URL(args.path.slice(7), `file://${args.resolveDir}/`).pathname,
      namespace: 'worker',
    }));
    build.onLoad({ filter: /.*/, namespace: 'worker' }, async (args) => {
      const result = await esbuild.build({
        entryPoints: [args.path], bundle: true, format: 'iife', target: 'es2022',
        minify: !watch, write: false, metafile: true, plugins: [threeCore],
      });
      return {
        contents: `export default ${JSON.stringify(result.outputFiles[0].text)};`,
        loader: 'js',
        watchFiles: Object.keys(result.metafile.inputs),
      };
    });
  },
};

const options = {
  entryPoints: ['web/main.js'],
  plugins: [inlineWorker],
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
