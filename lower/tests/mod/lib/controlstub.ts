// For the control-function tests (sheet_control, sheet_control_more): an
// exec stubbed in Mockito's when/thenReturn manner, and what a call told it.
type Done = { ok: boolean; message: string; output?: unknown };
type Exec = (id: string, params: Record<string, string>) => Promise<Done>;
type Control = (exec: Exec, ...args: any[]) => unknown;

// exec, stubbed: each call recorded; each command answered with its output
// from `answers`, or refused when in `refused`.
export function stub(answers: Record<string, unknown> = {}, refused: readonly string[] = []) {
  const calls: [string, Record<string, string>][] = [];
  const exec: Exec = async (id, params) => {
    calls.push([id, { ...params }]);
    return refused.includes(id) ? { ok: false, message: `${id} refused` } : { ok: true, message: "", output: answers[id] };
  };
  return { exec, calls };
}

// A control function from `table` called on a fresh stub: what it gave, and
// the commands it told.
export async function told(table: Readonly<Record<string, Control>>, name: string, args: unknown[], answers: Record<string, unknown> = {}) {
  const s = stub(answers);
  const result = await table[name](s.exec, ...args);
  return [result, s.calls];
}

// What a call failed with, or "did not fail".
export async function failed(f: () => unknown): Promise<string> {
  try {
    await f();
    return "did not fail";
  } catch (e) {
    return (e as Error).message;
  }
}
