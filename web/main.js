import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const $ = (sel) => document.querySelector(sel);
const ui = {
  canvas: $('#viewport'),
  title: $('#title'),
  meta: $('#meta'),
  empty: $('#empty'),
  loading: $('#loading'),
  loadingText: $('#loading-text'),
  progress: $('#progress'),
  toast: $('#toast'),
  help: $('#help'),
  dropOverlay: $('#drop-overlay'),
  fileInput: $('#file-input'),
  cullButton: $('[data-action="cull"]'),
  pointSizeGroup: $('.point-size'),
  pointSize: $('#point-size'),
  pointSizeValue: $('#point-size-value'),
};

// ---------- Settings ----------

const BACKGROUNDS = ['dark', 'gray', 'light'];
const settings = { cull: false, background: 'dark', pointSize: 2 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('drc-viewer') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('drc-viewer', JSON.stringify(settings)); } catch {} };

// ---------- Decoders ----------
// Started before WebGL init (which blocks for a few hundred ms while the GPU process
// starts), so the file read and decoder wasm compilation run in parallel with it.

const initialFiles = window.electronAPI?.initialFiles();
// Each worker is a separate isolate compiling the decoder wasm; on a cold start 2 is
// clearly faster than one per core, and plenty for our file sizes.
const workerLimit = 2;
const draco = new DRACOLoader().setDecoderPath('libs/draco/').setWorkerLimit(workerLimit);
const ktx2 = new KTX2Loader().setTranscoderPath('libs/basis/').setWorkerLimit(workerLimit);
// Spawn the workers up front instead of on first decode. Uses loader internals, so it is
// skipped (and loading just starts a bit slower) if a three.js upgrade changes them.
if (draco._getWorker && draco._releaseTask) {
  for (let i = 0; i < workerLimit; i++) draco._getWorker(-1 - i, 0).then((w) => draco._releaseTask(w, -1 - i));
}
const ktx2Ready = ktx2.init();

// ---------- Renderer, scene, camera ----------

const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

ktx2.detectSupport(renderer); // picks the GPU texture format, needed before workers start
ktx2Ready.then(() => {
  if (ktx2.workerPool?._initWorker) for (let i = 0; i < workerLimit; i++) ktx2.workerPool._initWorker(i);
});
const gltfLoader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(3, 2, 3);
scene.add(camera);

// Lights only affect lit (non-unlit) materials, e.g. plain .drc meshes.
// A headlight attached to the camera keeps the model readable from every angle.
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3d42, 1.4));
const headlight = new THREE.DirectionalLight(0xffffff, 1.8);
headlight.position.set(0.4, 0.6, 0);
headlight.target.position.set(0, 0, -1);
camera.add(headlight, headlight.target);

const root = new THREE.Group();
scene.add(root);

const controls = new OrbitControls(camera, ui.canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.18;
controls.zoomToCursor = true;
controls.screenSpacePanning = true;
controls.addEventListener('change', requestRender);

// ---------- Rendering (on demand: no frames are scheduled while nothing changes) ----------

let frameQueued = false;
let radius = 1;
let animation = null;

function requestRender() {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
}
window.addEventListener('resize', resize);
resize();

function frame(now) {
  frameQueued = false;
  if (animation) stepAnimation(now);
  // With damping, update() keeps returning true (and emits 'change', which queues the
  // next frame) until the motion settles; after that the loop stops by itself.
  controls.update();
  // Keep depth precision good at any zoom level.
  const d = camera.position.distanceTo(controls.target);
  camera.near = Math.max(d * 0.002, radius * 1e-5);
  camera.far = d + radius * 4;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

function animateTo(position, target, duration = 350) {
  animation = {
    start: performance.now(), duration,
    fromPos: camera.position.clone(), toPos: position,
    fromTarget: controls.target.clone(), toTarget: target,
  };
  requestRender();
}

function stepAnimation(now) {
  const a = animation;
  const t = Math.min(1, (now - a.start) / a.duration);
  const k = 1 - Math.pow(1 - t, 3);
  camera.position.lerpVectors(a.fromPos, a.toPos, k);
  controls.target.lerpVectors(a.fromTarget, a.toTarget, k);
  if (t === 1) animation = null;
  requestRender();
}

// ---------- Model handling ----------

const bounds = new THREE.Box3();
const sphere = new THREE.Sphere();

function hasModel() { return root.children.length > 0; }

function clearModel() {
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
  root.clear();
  root.position.set(0, 0, 0);
}

function forEachMaterial(fn) {
  root.traverse((o) => { for (const m of [].concat(o.material || [])) fn(m, o); });
}

function applyCulling() {
  forEachMaterial((m, o) => {
    if (o.isPoints) return;
    m.side = settings.cull ? THREE.FrontSide : THREE.DoubleSide;
    m.needsUpdate = true;
  });
  ui.cullButton.setAttribute('aria-pressed', String(settings.cull));
  requestRender();
}

function applyPointSize() {
  forEachMaterial((m) => { if (m.isPointsMaterial) m.size = settings.pointSize; });
  ui.pointSize.value = settings.pointSize;
  ui.pointSizeValue.textContent = settings.pointSize;
  requestRender();
}

function frameModel(animate = true, direction) {
  if (!hasModel()) return;
  bounds.setFromObject(root).getBoundingSphere(sphere);
  radius = sphere.radius || 1;
  const center = bounds.getCenter(new THREE.Vector3());
  const dir = direction || camera.position.clone().sub(controls.target).normalize();

  // Tight fit: distance at which all 8 box corners are inside the view frustum.
  const basis = new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), camera.up);
  const right = new THREE.Vector3().setFromMatrixColumn(basis, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(basis, 1);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / 1.08; // 8% margin
  const tanH = tanV * camera.aspect;
  let dist = 0;
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z).sub(center);
    const depth = corner.dot(dir);
    dist = Math.max(dist, Math.abs(corner.dot(right)) / tanH + depth, Math.abs(corner.dot(up)) / tanV + depth);
  }

  const position = center.clone().addScaledVector(dir, dist);
  if (animate) animateTo(position, center);
  else { camera.position.copy(position); controls.target.copy(center); }
  controls.maxDistance = radius * 20;
  requestRender();
}

// Draco hands back vertex colors as floats in their stored range (often 0-255, sRGB).
// Convert to linear (what three.js expects) and store as normalized 16-bit: half the
// memory of floats, without the banding that linear 8-bit would give in dark tones.
function linearColors(attribute) {
  const a = attribute.array;
  let max = 0;
  for (let i = 0; i < a.length; i += 7) if (a[i] > max) max = a[i];
  const scale = max > 255 ? 1 / 65535 : max > 1 ? 1 / 255 : 1;
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lut = scale === 1 / 255 ? Float32Array.from({ length: 256 }, (_, i) => toLinear(i / 255)) : null;
  const alpha = attribute.itemSize === 4;
  const out = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const c = alpha && i % 4 === 3 ? a[i] * scale : lut ? lut[a[i] | 0] : toLinear(a[i] * scale);
    out[i] = Math.round(Math.min(1, Math.max(0, c)) * 65535);
  }
  return new THREE.BufferAttribute(out, attribute.itemSize, true);
}

function buildDracoObject(geometry) {
  const hasColor = !!geometry.attributes.color;
  if (hasColor) geometry.setAttribute('color', linearColors(geometry.attributes.color));
  if (!geometry.index) {
    geometry.deleteAttribute('normal'); // unused by PointsMaterial
    const material = new THREE.PointsMaterial({
      size: settings.pointSize, sizeAttenuation: false,
      vertexColors: hasColor, color: hasColor ? 0xffffff : 0xcfd4dc,
    });
    return { object: new THREE.Points(geometry, material), points: geometry.attributes.position.count };
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: hasColor, color: hasColor ? 0xffffff : 0xb9bec6, roughness: 0.85, metalness: 0,
  });
  return { object: new THREE.Mesh(geometry, material), triangles: geometry.index.count / 3 };
}

// KTX2 textures keep their transcoded mip levels in JS memory; once they are on the GPU
// that copy is dead weight (tens of MB for tiled models).
function releaseAfterUpload(texture) {
  if (!texture.isCompressedTexture) return;
  texture.onUpdate = () => {
    texture.mipmaps = [];
    texture.onUpdate = null;
  };
}

function collectStats(object, stats) {
  const textures = new Set();
  object.traverse((o) => {
    if (!o.geometry) return;
    const g = o.geometry;
    if (o.isPoints) stats.points += g.attributes.position.count;
    else if (o.isMesh) stats.triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    stats.vertices += g.attributes.position.count;
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) {
        if (v?.isTexture && !textures.has(v)) {
          v.anisotropy = maxAnisotropy;
          releaseAfterUpload(v);
          textures.add(v);
        }
      }
    }
  });
  stats.textures += textures.size;
}

function sniffType(buffer, name) {
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength)));
  if (magic.startsWith('glTF')) return 'glb';
  if (magic === 'DRACO') return 'drc';
  const ext = name.split('.').pop().toLowerCase();
  return ext === 'glb' || ext === 'drc' ? ext : null;
}

async function parseFile({ name, buffer }) {
  const type = sniffType(buffer, name);
  if (type === 'glb') return (await gltfLoader.parseAsync(buffer, '')).scene;
  if (type === 'drc') {
    const geometry = await new Promise((resolve, reject) =>
      draco.decodeDracoFile(buffer, resolve, null, null, THREE.LinearSRGBColorSpace, reject));
    return buildDracoObject(geometry).object;
  }
  throw new Error(`${name}: not a .drc or .glb file`);
}

let loadToken = 0;

/** files: Array<{ name: string, buffer: ArrayBuffer }> — loaded together as one scene. */
async function loadFiles(files) {
  if (!files.length) return;
  const token = ++loadToken;
  const started = performance.now();
  const totalBytes = files.reduce((s, f) => s + f.buffer.byteLength, 0);
  const label = files.length === 1 ? files[0].name : `${files.length} files`;
  setLoading(`Decoding ${label}…`);
  hideToast();

  try {
    const objects = await Promise.all(files.map(parseFile));
    if (token !== loadToken) return;

    clearModel();
    const stats = { points: 0, triangles: 0, vertices: 0, textures: 0 };
    for (const [i, object] of objects.entries()) {
      object.name = files[i].name;
      collectStats(object, stats);
      root.add(object);
    }
    // Recenter so large (e.g. georeferenced) coordinates don't cause float jitter.
    bounds.setFromObject(root);
    root.position.copy(bounds.getCenter(new THREE.Vector3()).negate());
    root.updateMatrixWorld(true);

    applyCulling();
    applyPointSize();
    ui.pointSizeGroup.hidden = stats.points === 0;
    frameModel(false, new THREE.Vector3(1, 0.7, 1).normalize());

    // Compile shaders and upload textures before we report the load time.
    await renderer.compileAsync(scene, camera);
    if (token !== loadToken) return;
    frame(performance.now());

    const ms = performance.now() - started;
    document.title = `${label} — Draco Viewer`;
    ui.title.textContent = label;
    ui.title.title = files.map((f) => f.name).join('\n');
    ui.meta.textContent = describe(stats, totalBytes, ms);
    ui.empty.hidden = true;
    document.querySelectorAll('[data-needs-model]').forEach((b) => (b.disabled = false));
  } catch (err) {
    console.error(err);
    if (token === loadToken) showToast(`Could not open ${label}: ${err.message || err.error || err}`);
  } finally {
    if (token === loadToken) setLoading(null);
  }
}

const fmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function describe(s, bytes, ms) {
  const parts = [];
  if (s.points) parts.push(`${fmt.format(s.points)} points`);
  if (s.triangles) parts.push(`${fmt.format(s.triangles)} triangles`);
  if (s.triangles) parts.push(`${fmt.format(s.vertices - s.points)} vertices`);
  if (s.textures) parts.push(`${s.textures} texture${s.textures > 1 ? 's' : ''}`);
  parts.push(bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.ceil(bytes / 1e3)} KB`);
  parts.push(`${ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s'}`);
  return parts.join('  ·  ');
}

// ---------- UI state ----------

function setLoading(text) {
  ui.loading.hidden = ui.progress.hidden = !text;
  if (text) {
    ui.loadingText.textContent = text;
    ui.empty.hidden = true;
  } else if (!hasModel()) {
    ui.empty.hidden = false;
  }
}

let toastTimer;
function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 6000);
}
function hideToast() { ui.toast.hidden = true; }

function setBackground(bg) {
  settings.background = BACKGROUNDS.includes(bg) ? bg : 'dark';
  document.body.dataset.bg = settings.background;
}

// ---------- File input: picker, drag & drop, URL, Electron ----------

async function loadFileList(fileList) {
  const list = [...fileList];
  if (!list.length) return;
  setLoading(`Reading ${list.length === 1 ? list[0].name : list.length + ' files'}…`);
  const files = await Promise.all(list.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
  loadFiles(files);
}

ui.fileInput.addEventListener('change', () => {
  loadFileList(ui.fileInput.files);
  ui.fileInput.value = '';
});

let dragDepth = 0;
const isFileDrag = (e) => e.dataTransfer?.types.includes('Files');
window.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth++;
  ui.dropOverlay.hidden = false;
});
window.addEventListener('dragover', (e) => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; ui.dropOverlay.hidden = true; } });
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  ui.dropOverlay.hidden = true;
  loadFileList(e.dataTransfer.files);
});

async function loadFromUrls(urls) {
  setLoading('Downloading…');
  try {
    const files = await Promise.all(urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return { name: decodeURIComponent(new URL(url, location.href).pathname.split('/').pop()), buffer: await res.arrayBuffer() };
    }));
    loadFiles(files);
  } catch (err) {
    setLoading(null);
    showToast(err.message);
  }
}

function toArrayBuffer(u8) {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? u8.buffer
    : u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

async function start() {
  const params = new URLSearchParams(location.search);
  const urls = params.getAll('model');
  if (initialFiles) {
    setLoading('Reading file…');
    const { files, errors } = await initialFiles;
    errors.forEach(showToast);
    if (files.length) return loadFiles(files.map((f) => ({ name: f.name, buffer: toArrayBuffer(f.data) })));
    setLoading(null);
  } else if (urls.length) {
    return loadFromUrls(urls);
  }
}

// ---------- Toolbar & keyboard ----------

const actions = {
  open: () => ui.fileInput.click(),
  fit: () => frameModel(),
  cull: () => { settings.cull = !settings.cull; saveSettings(); applyCulling(); },
  background: () => {
    setBackground(BACKGROUNDS[(BACKGROUNDS.indexOf(settings.background) + 1) % BACKGROUNDS.length]);
    saveSettings();
  },
  fullscreen: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()),
  help: () => { ui.help.hidden = !ui.help.hidden; },
  pointSize: (delta) => {
    settings.pointSize = THREE.MathUtils.clamp(settings.pointSize + delta, 1, 12);
    saveSettings();
    applyPointSize();
  },
};

document.querySelectorAll('[data-action]').forEach((el) => {
  el.addEventListener('click', () => { actions[el.dataset.action](); el.blur(); });
});
$('#empty-open').addEventListener('click', actions.open);
ui.pointSize.addEventListener('input', () => {
  settings.pointSize = Number(ui.pointSize.value);
  saveSettings();
  applyPointSize();
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && key === 'o') { e.preventDefault(); return actions.open(); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = {
    o: actions.open, f: actions.fit, b: actions.cull, g: actions.background,
    '?': actions.help, '[': () => actions.pointSize(-0.5), ']': () => actions.pointSize(0.5),
    escape: () => { ui.help.hidden = true; },
  };
  if (map[key]) { e.preventDefault(); map[key](); }
});

// Double-click: set the orbit pivot on the surface under the cursor, or frame all on background.
const raycaster = new THREE.Raycaster();
ui.canvas.addEventListener('dblclick', (e) => {
  if (!hasModel()) return;
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  raycaster.params.Points.threshold = radius * 0.003;
  const hit = raycaster.intersectObject(root, true)[0];
  if (!hit) return frameModel();
  const offset = hit.point.clone().sub(controls.target);
  animateTo(camera.position.clone().add(offset), hit.point.clone(), 300);
});

// Texture data is released after upload, so a lost GPU context can't be restored in place.
ui.canvas.addEventListener('webglcontextlost', () => showToast('The graphics context was lost. Reopen the file to continue.'));

ui.canvas.addEventListener('pointerdown', () => { animation = null; ui.help.hidden = true; });

// ---------- Boot ----------

setBackground(settings.background);
ui.cullButton.setAttribute('aria-pressed', String(settings.cull));
ui.pointSize.value = ui.pointSizeValue.textContent = settings.pointSize;
document.querySelectorAll('[data-needs-model]').forEach((b) => (b.disabled = true));
start();
