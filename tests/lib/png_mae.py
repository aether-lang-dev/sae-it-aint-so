#!/usr/bin/env python3
"""png_mae.py REF.png GRID.txt W H STEP [MAXERR]

Mean absolute error, over R, G and B, between a reference PNG (librsvg's
rendering of a corpus SVG, from aether-ui's vg/test/screenshots) and the
pixels a sae page's canvas drew, as the AetherUIDriver's /pixelgrid wrote
them (one AARRGGBB per line, every STEP px across a W x H replay, row by
row). The reference's alpha is composited over white, as the harness does;
an unpainted canvas pixel (00000000) is the window's white. Prints
`mae <value> samples <n>` and exits 1 when MAXERR is given and exceeded.
Pure Python (zlib only): the lanes have no PIL."""
import struct, sys, zlib

def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, w, h, ctype, bitdepth = 8, [], 0, 0, 0, 8
    while pos < len(data):
        n, = struct.unpack(">I", data[pos:pos+4]); tag = data[pos+4:pos+8]; body = data[pos+8:pos+8+n]
        if tag == b"IHDR":
            w, h, bitdepth, ctype = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat.append(body)
        pos += 12 + n
    assert bitdepth == 8, "8-bit PNGs only"
    bpp = {2: 3, 6: 4, 0: 1, 4: 2}[ctype]
    raw = zlib.decompress(b"".join(idat))
    stride = w * bpp
    rows, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]; line = bytearray(raw[p+1:p+1+stride]); p += 1 + stride
        for i in range(stride):
            a = line[i-bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i-bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        rows.append(bytes(line)); prev = line
    return w, h, bpp, rows

def ref_rgb(rows, bpp, x, y):
    px = rows[y][x*bpp:(x+1)*bpp]
    if bpp == 4:
        r, g, b, a = px
        return tuple(int(round(v * a / 255 + 255 * (1 - a / 255))) for v in (r, g, b))
    if bpp == 3: return tuple(px)
    if bpp == 2:
        v, a = px; v = int(round(v * a / 255 + 255 * (1 - a / 255))); return (v, v, v)
    return (px[0],) * 3

def main():
    ref, grid, w, h, step = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    maxerr = float(sys.argv[6]) if len(sys.argv) > 6 else None
    rw, rh, bpp, rows = read_png(ref)
    vals = [l.strip() for l in open(grid) if l.strip()]
    xs = list(range(0, w, step)); ys = list(range(0, h, step))
    assert len(vals) == len(xs) * len(ys), f"grid has {len(vals)} samples, expected {len(xs)*len(ys)}"
    total, n, i = 0, 0, 0
    for y in ys:
        for x in xs:
            v = int(vals[i], 16); i += 1
            a = (v >> 24) & 255
            if a == 0: got = (255, 255, 255)
            else: got = ((v >> 16) & 255, (v >> 8) & 255, v & 255)
            rx, ry = min(rw - 1, x * rw // w), min(rh - 1, y * rh // h)
            want = ref_rgb(rows, bpp, rx, ry)
            total += sum(abs(g - r) for g, r in zip(got, want)); n += 3
    mae = total / n if n else 255.0
    print(f"mae {mae:.2f} samples {n // 3}")
    if maxerr is not None and mae > maxerr:
        print(f"FAIL: mae {mae:.2f} exceeds {maxerr}"); sys.exit(1)

if __name__ == "__main__": main()
