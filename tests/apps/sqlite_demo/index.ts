"seeks database notes";
// The sqlite demo app (tests/spec_app_sqlite.ae): inserts, queries, updates
// in a transaction, a transaction that throws, named parameters, a burst of
// concurrent calls, and leaving the page with work in flight.
const { text, btn, set_text } = ui;
interface Note { id: number; body: string; score: number | null; done: number }
interface Run { changes: number; lastId: number }
const db = sqlite.notes;

text(`sqlite: ${typeof sqlite} notes: ${typeof db}`);
const out = text("result: (none)");
const show = (s: string) => set_text(out, `result: ${s}`);
const fail = (e: unknown) => show(`error: ${e instanceof Error ? e.message : String(e)}`);
const count = async () => (await db.get("select count(*) as n from notes") as { n: number }).n;

btn("Reset", async () => {
  await db.run("delete from notes");
  await db.run("delete from sqlite_sequence where name = 'notes'").catch(() => undefined);
  await db.run("insert into notes (id, body, score) values (1, 'seed', 1.5)");
  show(`reset: ${await count()} row`);
});
btn("Insert", async () => {
  const r: Run = await db.run("insert into notes (body, score) values (?, ?)", ["milk", 2.25]);
  show(`inserted id=${r.lastId} changes=${r.changes}`);
});
btn("List", async () => {
  const rows: Note[] = await db.all("select id, body, score, done from notes order by id");
  show(`list: ${rows.map(n => `${n.id}:${n.body}:${n.score}:${n.done}`).join(" ")}`);
});
btn("Get named", async () => {
  const one = await db.get("select body from notes where id = $id", { id: 1 });
  const none = await db.get("select body from notes where id = ?", [999]);
  show(`named: ${one?.body} missing: ${none}`);
});
btn("Update in tx", async () => {
  const n = await db.transaction(async tx => {
    await tx.run("update notes set done = 1 where body = ?", ["milk"]);
    const r: Run = await tx.run("insert into notes (body) values (?)", ["bread"]);
    await tx.run("insert into tags (note_id, tag) values (?, ?)", [r.lastId, "food"]);
    return (await tx.get("select count(*) as n from notes where done = 1") as { n: number }).n;
  });
  show(`tx done: ${n} done, ${await count()} rows`);
});
btn("Failing tx", async () => {
  const before = await count();
  try {
    await db.transaction(async tx => {
      await tx.run("insert into notes (body) values (?)", ["ghost"]);
      await tx.run("insert into notes (body) values (?)", ["phantom"]);
      throw new Error("changed my mind");
    });
    show("tx should have thrown");
  } catch (e) {
    show(`tx rolled back: ${(e as Error).message}; ${before} -> ${await count()} rows`);
  }
});
btn("Bad SQL", async () => {
  try { await db.all("select * from nowhere"); show("no error?"); } catch (e) { fail(e); }
});
btn("Bad params", async () => {
  try { await db.all("select * from notes where id = ? and body = ?", [1]); show("no error?"); } catch (e) { fail(e); }
});
btn("Burst", async () => {
  // Twenty inserts and a count at once: one actor, one order.
  const before = await count();
  const ids = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    db.run("insert into notes (body) values (?)", [`burst ${i}`]).then((r: Run) => r.lastId)));
  const ordered = ids.every((id, i) => i === 0 || id > ids[i - 1]);
  show(`burst: ${before} -> ${await count()} rows, ids in order: ${ordered}`);
});
btn("Slow then leave", () => {
  // A query that takes a while; its answer comes after this page is gone.
  db.all("with recursive c(x) as (select 1 union all select x + 1 from c where x < 3000000) select count(*) as n from c")
    .then(() => show("should never show"));
  browserContext.changePage("/second");
});
btn("Open tx then leave", () => {
  // A transaction left open: the next page must not see its rows, and must
  // not wait on it.
  db.transaction(async tx => {
    await tx.run("insert into notes (body) values (?)", ["abandoned"]);
    await ui.sleep(60000);
  }).catch(() => undefined);
  ui.after(50, () => browserContext.changePage("/second"));
});
btn("Migrations", async () => {
  const rows: { name: string }[] = await db.all("select name from _sae_migrations order by name");
  show(`migrations: ${rows.map(r => r.name).join(" ")}`);
});
btn("Escapes page", () => browserContext.changePage("/escapes"));
btn("No-seek page", () => browserContext.changePage("/nosql"));
btn("Unknown page", () => browserContext.changePage("/unknown"));
btn("Optional page", () => browserContext.changePage("/optional"));
