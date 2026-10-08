// sae's prelude: the reactive surface a page sees (state, computed, bind,
// bind_enabled, bind_hidden, each, batch, the bind`...` template) and the
// vg helpers that are JavaScript all the way down (vg.animate, vg.items,
// vg.view_box over a state). Evaluated into every page's runtime by
// api_register_ (src/sae_host.ae, "wave1/aevg"), over the host primitives
// ui._cell/_cell_get/_cell_set/_computed/_batch/_bind/_widget_kind/
// _remove_child and the vg verbs. Embedded as src/sae_prelude.c by
// tools/embed-prelude.sh; tests/check_prelude.sh keeps the two in step.
//
// A State wraps one aether-ui cell: a number, string or boolean cell holds
// the value itself (so bind() is aether-ui's own bind_text/bind_value, and
// ui_set(s.h, v) on the raw handle still reaches every binding); any other
// value (an array, an object, null) lives here and the cell is a version
// counter, bumped on every set, so observers and each() still fire.
"use strict";
(function () {
  const ui_ = ui, vg_ = vg;
  const kindOf = (v) => (typeof v === "number" ? "f" : typeof v === "string" ? "s" : typeof v === "boolean" ? "b" : "v");
  let inBatch = 0, vgDirty = false;
  const vgRefresh = () => { if (inBatch > 0) { vgDirty = true; return; } vgDirty = false; vg_.refresh(); };

  class State {
    constructor(v) {
      this.kind = kindOf(v);
      this.h = ui_._cell(this.kind === "v" ? "i" : this.kind, this.kind === "v" ? 0 : v);
      this.val = v;
      this.ver = 0;
    }
    get value() { return this.kind === "v" ? this.val : ui_._cell_get(this.kind, this.h); }
    set value(v) { this.set(v); }
    get() { return this.value; }
    set(v) {
      if (this.kind === "v") { this.val = v; ui_._cell_set("i", this.h, ++this.ver); }
      else if (kindOf(v) !== this.kind) throw new TypeError(`state: a ${this.kind === "f" ? "number" : this.kind === "s" ? "string" : "boolean"} state cannot hold a ${typeof v}`);
      else ui_._cell_set(this.kind, this.h, v);
      vgRefresh();
      return v;
    }
    update(fn) { return this.set(fn(this.value)); }
    subscribe(fn) { observe(() => fn(this.value), [this]); return this; }
    toString() { return String(this.value); }
  }
  const isState = (s) => s instanceof State;
  const cellOf = (s) => (isState(s) ? s.h : typeof s === "number" ? s : 0);

  // observe(fn, states): fn now, and whenever any of the states changes
  // (once per batch per pair of inputs: aether-ui's observer watches two).
  const observe = (fn, states) => {
    const hs = states.map(cellOf).filter((h) => h > 0);
    if (hs.length === 0) { fn(); return; }
    let first = true;
    const run = () => { if (first) { first = false; fn(); } else fn(); };
    for (let i = 0; i < hs.length; i += 2) {
      const a = hs[i], b = i + 1 < hs.length ? hs[i + 1] : 0;
      if (i === 0) ui_._computed(run, a, b);
      else ui_._computed(() => { if (!first) fn(); }, a, b);
    }
  };

  const state = (v) => new State(v);
  const computed = (fn, ...states) => {
    const s = new State(fn());
    let seeded = false;
    observe(() => { if (seeded) s.set(fn()); seeded = true; }, states);
    return s;
  };

  // bind(widget, state): the widget's text follows the state; a text field
  // and a string state are bound both ways. bind`...` is the tagged template.
  const bind = (widget, s) => {
    const h = cellOf(s);
    if (h === 0) throw new TypeError("bind(widget, state): state is not a state");
    const two = isState(s) && s.kind === "s" && ui_._widget_kind(widget) === "textfield";
    ui_._bind(two ? "value" : "text", widget, h, 0);
    return widget;
  };
  const bindTemplate = (strings, values) => {
    const label = ui_.text("");
    const render = () => strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(isState(values[i]) ? values[i].value : values[i]) : ""), "");
    const d = new State(render());
    observe(() => d.set(render()), values.filter(isState));
    ui_._bind("text", label, d.h, 0);
    return label;
  };
  const bindAny = function (first, ...rest) {
    if (Array.isArray(first) && Object.prototype.hasOwnProperty.call(first, "raw")) return bindTemplate(first, rest);
    return bind(first, rest[0]);
  };
  const bind_enabled = (widget, s, invert) => { ui_._bind("enabled", widget, cellOf(s), invert ? 1 : 0); return widget; };
  const bind_hidden = (widget, s, invert) => { ui_._bind("hidden", widget, cellOf(s), invert ? 1 : 0); return widget; };

  const batch = (fn) => {
    inBatch++;
    let r;
    try { r = ui_._batch(fn); } finally { inBatch--; }
    if (inBatch === 0 && vgDirty) vgRefresh();
    return r;
  };

  // each(list_state, key, render): a column of rows, one per item, keyed:
  // a row whose key stays is kept (re-rendered only if its item is another
  // object or its index moved), a row whose key goes is removed, new keys at the end are
  // appended; a reorder or an insertion in the middle rebuilds the column.
  const each = (list, key, render) => {
    const keyOf = typeof key === "function" ? key : (it) => it[key];
    const container = ui_.vstack(0, () => {});
    let rows = [];   // [{key, item, h}]
    const build = (item, i) => ui_.vstack(0, () => render(item, i));
    const apply = () => {
      const items = list.value || [];
      const keys = items.map(keyOf);
      const old = new Map(rows.map((r) => [r.key, r]));
      const kept = keys.filter((k) => old.has(k));
      const keptOld = rows.filter((r) => keys.includes(r.key)).map((r) => r.key);
      const incremental = kept.every((k, i) => k === keptOld[i]) && keys.slice(kept.length).every((k) => !old.has(k)) && keys.slice(0, kept.length).every((k) => old.has(k));
      if (!incremental) {
        ui_.clear(container);
        rows = [];
        ui_.into(container, () => { items.forEach((item, i) => rows.push({ key: keys[i], item, i, h: build(item, i) })); });
        return;
      }
      for (const r of rows) if (!old.has(r.key) || !keys.includes(r.key)) ui_._remove_child(container, r.h);
      const next = [];
      items.forEach((item, i) => {
        const r = old.get(keys[i]);
        if (r) {
          if (r.item !== item || r.i !== i) { ui_.clear(r.h); ui_.into(r.h, () => render(item, i)); r.item = item; r.i = i; }
          next.push(r);
        } else {
          ui_.into(container, () => next.push({ key: keys[i], item, i, h: build(item, i) }));
        }
      });
      rows = next;
    };
    observe(apply, [list]);
    return container;
  };

  Object.assign(globalThis, { state, computed, bind: bindAny, bind_enabled, bind_hidden, each, batch });
  Object.assign(ui_, { state, computed, bind: bindAny, bind_enabled, bind_hidden, each, batch });

  // --- vg over the frame clock ---
  const easings = {
    linear: (t) => t,
    ease_in: (t) => t * t,
    ease_out: (t) => 1 - (1 - t) * (1 - t),
    ease_in_out: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  };
  const parseColor = (c) => {
    c = String(c || "").trim();
    let m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(c))) return [...m[1]].map((x) => parseInt(x + x, 16));
    if ((m = /^#([0-9a-f]{6})$/i.exec(c))) return [1, 3, 5].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    if ((m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(c))) return [+m[1], +m[2], +m[3]];
    return null;
  };
  const lerpColor = (a, b, t) => "rgb(" + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",") + ")";
  const tweens = new Set();
  let ticking = false;
  const tick = () => {
    const now = performance.now();
    for (const tw of tweens) {
      const t = Math.min(1, (now - tw.start) / tw.ms);
      tw.apply(tw.ease(t));
      if (t >= 1) { tweens.delete(tw); tw.finish(); }
    }
    if (tweens.size > 0) requestAnimationFrame(tick); else ticking = false;
  };
  const startTween = (tw) => {
    tweens.add(tw);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  };
  // vg.animate(target, { to, ms, easing, from }, done?): target is a shape
  // or group handle (to: { fill, opacity, transform via rotate/scale/
  // translate, cx, cy, r, x, y, w, h, x1, y1, x2, y2 }) or a numeric
  // state (to: a number). Returns { cancel(), done: Promise }.
  vg_.animate = (target, opts, done) => {
    const ms = opts.ms ?? 300;
    const ease = typeof opts.easing === "function" ? opts.easing : easings[opts.easing || "ease_out"] || easings.ease_out;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    let apply, finish = () => { if (done) done(); resolve(); };
    if (isState(target)) {
      const from = opts.from ?? target.value, to = opts.to;
      apply = (t) => target.set(from + (to - from) * t);
    } else {
      const cur = vg_.get(target), from = Object.assign({}, cur, opts.from || {}), to = opts.to || {};
      const fc = parseColor(from.fill), tc = parseColor(to.fill);
      const tf = { rotate: 0, scale: 1, tx: 0, ty: 0, ...(opts.from_transform || {}) };
      apply = (t) => {
        const o = {};
        for (const k of Object.keys(to)) {
          if (k === "fill") { if (fc && tc) o.fill = lerpColor(fc, tc, t); else if (t >= 1) o.fill = to.fill; }
          else if (k === "rotate" || k === "scale" || k === "translate") { /* below */ }
          else if (typeof to[k] === "number" && typeof from[k] === "number") o[k] = from[k] + (to[k] - from[k]) * t;
          else if (t >= 1) o[k] = to[k];
        }
        if ("rotate" in to || "scale" in to || "translate" in to) {
          const r = "rotate" in to ? tf.rotate + (to.rotate - tf.rotate) * t : tf.rotate;
          const s = "scale" in to ? tf.scale + (to.scale - tf.scale) * t : tf.scale;
          const [tx0, ty0] = [tf.tx, tf.ty], [tx1, ty1] = to.translate || [tx0, ty0];
          const tx = tx0 + (tx1 - tx0) * t, ty = ty0 + (ty1 - ty0) * t;
          const c = opts.center || [0, 0];
          o.transform = (opts.base ? opts.base + " " : "") + `translate(${tx} ${ty}) rotate(${r} ${c[0]} ${c[1]}) translate(${c[0]} ${c[1]}) scale(${s}) translate(${-c[0]} ${-c[1]})`;
        }
        vg_.set(target, o);
      };
    }
    const tw = { start: performance.now(), ms, ease, apply, finish };
    startTween(tw);
    return { cancel() { tweens.delete(tw); }, done: promise };
  };

  // vg.items(list_state, key, render, update?): a data join into the open
  // group: render(item, i) draws an item's shapes (returning the handle of
  // the one to keep); update(item, h) refreshes a kept one; a gone key's
  // shape is removed. New keys draw after the kept ones.
  vg_.items = (list, key, render, update) => {
    const keyOf = typeof key === "function" ? key : (it) => it[key];
    const group = vg_.g(() => {});
    let rows = new Map();
    const apply = () => {
      const items = list.value || [];
      const keys = items.map(keyOf);
      for (const [k, r] of rows) if (!keys.includes(k)) { vg_.remove(r.h); rows.delete(k); }
      vg_.into(group, () => {
        items.forEach((item, i) => {
          const r = rows.get(keys[i]);
          if (r) { if (update) update(item, r.h, i); r.item = item; }
          else rows.set(keys[i], { item, h: render(item, i) });
        });
      });
    };
    observe(apply, [list]);
    return group;
  };

  // vg.view_box(state | fn): the scene's viewBox follows it.
  const viewBox = vg_.view_box;
  vg_.view_box = (s) => viewBox(isState(s) ? () => s.value : s);
  vg_.easings = easings;
})();
