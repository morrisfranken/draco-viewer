// Parses OBJ text off the main thread, so textures can decode (and the UI stays responsive)
// meanwhile. Returns plain geometry arrays, transferred without copying.
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

self.onmessage = ({ data: { id, buffer } }) => {
  try {
    const group = new OBJLoader().parse(new TextDecoder().decode(buffer));
    const objects = [];
    const transfer = [];
    group.traverse((o) => {
      if (!o.geometry) return;
      const attributes = {};
      for (const [key, a] of Object.entries(o.geometry.attributes)) {
        attributes[key] = { array: a.array, itemSize: a.itemSize, normalized: a.normalized };
        transfer.push(a.array.buffer);
      }
      objects.push({
        type: o.isPoints ? 'points' : o.isLineSegments ? 'lines' : 'mesh',
        name: o.name,
        attributes,
        groups: o.geometry.groups,
        materials: Array.isArray(o.material) ? o.material.map((m) => m.name) : o.material.name,
      });
    });
    self.postMessage({ id, objects, materialLibraries: group.materialLibraries }, transfer);
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
