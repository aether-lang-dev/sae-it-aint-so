// Terrain (docs/roadmap.md demo 13): sliders for noise scale, octaves and
// water level drive a value-noise / FBM heightmap, coloured by height into a
// vg.raster the page computes; "New seed" rolls the noise. The first page
// that needs pixels. Idea: Cosyne `procedural-terrain-canvas`-alike (a
// library noise function feeding a 2D heightmap); written fresh.
//
// The noise function lives in this page for now. When `sae:noise` (roadmap
// 8.1) lands, this becomes:   import { fbm } from "sae:noise";
const { text, btn, slider } = ui;

const W = 128, H = 128;
const px = new Uint8Array(W * H * 4);

let seed = 1;
let scale = 24;       // noise cell size in pixels
let octaves = 4;
let water = 40;       // 0..100 percent of the height range that is water

// --- a small value-noise, to be replaced by sae:noise ---------------------
const hash = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const noise = (x: number, y: number): number => {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smooth(x - x0), ty = smooth(y - y0);
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
};
const fbm = (x: number, y: number, n: number): number => {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < n; i++) { sum += noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
};
// -------------------------------------------------------------------------

// Height bands, water first: deep water, water, sand, grass, forest, rock, snow.
const bands: [number, number, number, number][] = [
  [0.05, 24, 64, 160], [0.12, 60, 120, 210], [0.20, 230, 210, 150],
  [0.45, 60, 150, 60], [0.65, 30, 100, 40], [0.85, 120, 120, 120], [1.01, 240, 240, 245],
];

let checksum = 0;
const render = () => {
  const level = water / 100;
  let sum = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = fbm(x / scale, y / scale, octaves);
      // Below the water level is water (two shades); above it the land bands
      // are stretched over what is left, so the water slider moves the coast.
      let r: number, g: number, b: number;
      if (h < level) {
        const deep = h < level * 0.6;
        [r, g, b] = deep ? [24, 64, 160] : [60, 120, 210];
      } else {
        const t = level >= 1 ? 1 : 0.2 + 0.81 * (h - level) / (1 - level);
        let i = 2;
        while (i < bands.length - 1 && t >= bands[i][0]) i++;
        [r, g, b] = [bands[i][1], bands[i][2], bands[i][3]];
      }
      const o = (y * W + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
      sum = (sum + r * 3 + g * 5 + b * 7 + x) | 0;
    }
  }
  checksum = sum >>> 0;
  if (raster) vg.raster_update(raster, px);
  print(`terrain: seed ${seed} scale ${scale} octaves ${octaves} water ${water} checksum ${checksum}`);
};

text("Terrain: value noise, coloured by height");
let raster = 0;
render();
vg.scene("0 0 128 128", 384, 384, () => {
  raster = vg.raster(W, H, px);
});
text("Scale");
slider(4, 64, scale, (v: number) => { scale = Math.round(v); render(); });
text("Octaves");
slider(1, 6, octaves, (v: number) => { octaves = Math.round(v); render(); });
text("Water level");
slider(0, 100, water, (v: number) => { water = Math.round(v); render(); });
btn("New seed", () => { seed = (seed * 7 + 13) % 1000003; render(); });
btn("Home", () => browserContext.changePage("/"));
