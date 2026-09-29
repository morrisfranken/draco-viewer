// Shared by the viewer (bundled) and the Electron main process (require), hence CommonJS.
// All asset references are expressed relative to the .obj file's directory, using '/'.

/** Normalize a reference: forward slashes, no leading './', collapse '..'. */
function normalizeRef(ref) {
  const parts = [];
  for (const part of ref.trim().replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** Resolve `ref` (as written inside the file `fromRef`) relative to the .obj directory. */
function resolveRef(fromRef, ref) {
  const dir = fromRef.includes('/') ? fromRef.slice(0, fromRef.lastIndexOf('/') + 1) : '';
  return normalizeRef(dir + ref.replace(/\\/g, '/'));
}

/** `mtllib` references in OBJ text (usually in the first lines). */
function mtllibRefs(objText) {
  const refs = [];
  for (const m of objText.matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t]*$/gm)) refs.push(normalizeRef(m[1]));
  return [...new Set(refs)];
}

// Texture options that may precede the file name in a map_* statement, with their arg count.
const MAP_OPTIONS = { '-blendu': 1, '-blendv': 1, '-bm': 1, '-boost': 1, '-cc': 1, '-clamp': 1,
  '-imfchan': 1, '-mm': 2, '-o': 3, '-s': 3, '-t': 3, '-texres': 1, '-type': 1 };

function mapFileName(args) {
  const tokens = args.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length && tokens[i].startsWith('-') && MAP_OPTIONS[tokens[i].toLowerCase()] !== undefined) {
    const max = MAP_OPTIONS[tokens[i].toLowerCase()];
    i++;
    // -o/-s/-t take 1 to 3 numbers
    for (let n = 0; n < max && i < tokens.length - 1 && /^[-+]?[\d.]+$|^(on|off)$|^[rgbmlz]$/i.test(tokens[i]); n++) i++;
  }
  return tokens.slice(i).join(' ');
}

/** Parse the parts of an MTL file the viewer uses: diffuse color, diffuse map and opacity. */
function parseMtl(text) {
  const materials = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const space = line.search(/\s/);
    const key = (space < 0 ? line : line.slice(0, space)).toLowerCase();
    const value = space < 0 ? '' : line.slice(space + 1).trim();
    if (key === 'newmtl') materials[value] = current = { name: value };
    else if (!current) continue;
    else if (key === 'kd') current.color = value.split(/\s+/).slice(0, 3).map(Number);
    else if (key === 'map_kd') current.map = normalizeRef(mapFileName(value));
    else if (key === 'd') current.opacity = Number(value);
    else if (key === 'tr') current.opacity = 1 - Number(value);
  }
  return materials;
}

/** Diffuse texture references in an MTL file (relative to that MTL file). */
function mtlTextureRefs(text) {
  return [...new Set(Object.values(parseMtl(text)).map((m) => m.map).filter(Boolean))];
}

module.exports = { normalizeRef, resolveRef, mtllibRefs, parseMtl, mtlTextureRefs };
