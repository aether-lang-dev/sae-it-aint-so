// gfx: a page's 3D scene, described in one batch a frame
// (docs/gpu-pages.md; ae3d.batch's layout, which three.js's AeRenderer
// writes). This sae checks and counts the batch natively but does not draw
// it yet; gfx.stats says what arrived. tests/spec_nav.ae reads the lines.
const { text, btn } = ui;

text("gfx");

// A cube of 8 corners and 12 triangles as mesh `id`, drawn `draws` times,
// in ae3d.batch's layout (version 1, 32-bit words).
function batch(frame: number, withMesh: boolean, draws: number, id = 1, magic = 0x31424541): Uint8Array {
  const v = 8, ix = 36;
  const words = 40 + 1 + (withMesh ? 3 + v * 8 + ix : 0) + 1 + 1 + draws * 20;
  const buf = new ArrayBuffer(words * 4);
  const u = new Uint32Array(buf), f = new Float32Array(buf);
  u[0] = magic; u[1] = 1; u[2] = words; u[3] = frame;
  for (let i = 0; i < 4; i++) { f[4 + i * 5] = 1; f[20 + i * 5] = 1; }   // view and lens: identity
  f[39] = 1;
  let at = 40;
  u[at++] = withMesh ? 1 : 0;
  if (withMesh) {
    u[at++] = id; u[at++] = v; u[at++] = ix;
    for (let c = 0; c < 8; c++) {
      f[at + c * 3] = c & 1 ? 0.5 : -0.5; f[at + c * 3 + 1] = c & 2 ? 0.5 : -0.5; f[at + c * 3 + 2] = c & 4 ? 0.5 : -0.5;
    }
    at += v * 8;   // positions, normals (zeros) and uvs (zeros)
    const tri = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
    for (const t of tri) u[at++] = t;
  }
  u[at++] = 0;          // frees
  u[at++] = draws;
  for (let d = 0; d < draws; d++) {
    u[at] = id; u[at + 1] = 1; u[at + 2] = 0; f[at + 3] = 1;
    for (let i = 0; i < 4; i++) f[at + 4 + i * 5] = 1;
    f[at + 4 + 12] = d;  // each draw moved along x
    at += 20;
  }
  return new Uint8Array(buf);
}

const line = (s: { frame: number; meshes: number; vertices: number; triangles: number; draws: number; batches: number; drawn: boolean }) =>
  `frame ${s.frame}: meshes ${s.meshes}, vertices ${s.vertices}, triangles ${s.triangles}, draws ${s.draws}, batches ${s.batches}, drawn ${s.drawn}`;

const scene = gfx.scene(320, 240);
gfx.submit(scene, batch(1, true, 1));
print(`gfx ${line(gfx.stats(scene))}`);
gfx.submit(scene, batch(2, false, 2));          // the mesh kept, drawn twice
const second = gfx.stats(scene);
print(`gfx ${line(second)}`);
text(`gfx ${line(second)}`);

const refused = (what: string, fn: () => void) => {
  try { fn(); print(`gfx ${what}: taken`); } catch (e) { print(`gfx ${what}: ${(e as Error).message}`); }
};
refused("not a batch", () => gfx.submit(scene, batch(3, true, 1, 1, 7)));
refused("a draw of a mesh it has not", () => gfx.submit(scene, batch(3, false, 1, 9)));
refused("a mesh of two million vertices", () => {
  const b = batch(3, true, 1);
  new Uint32Array(b.buffer)[42] = 2000000;
  gfx.submit(scene, b);
});
print(`gfx after the refusals ${line(gfx.stats(scene))}`);
const more = [gfx.scene(8, 8), gfx.scene(8, 8), gfx.scene(8, 8)];
refused("a fifth scene", () => gfx.scene(8, 8));
for (const s of more) gfx.free(s);
gfx.free(scene);
refused("stats of a freed scene", () => gfx.stats(scene));

btn("Home", () => browserContext.changePage("/"));
