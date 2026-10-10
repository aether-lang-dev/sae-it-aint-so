// Assertions for the module tests that print, so a test's "// expect:" lines
// are its verdicts: "ok <label>" when it holds, the difference when not.
export function eq<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  print(a === e ? `ok ${label}` : `FAIL ${label}: got ${a}, want ${e}`);
}

export function throws(label: string, fn: () => unknown, kind: Function, message: string): void {
  try {
    fn();
    print(`FAIL ${label}: did not throw`);
  } catch (e) {
    const ok = e instanceof kind && String((e as Error).message) === message;
    print(ok ? `ok ${label}` : `FAIL ${label}: threw ${e}`);
  }
}

// A collaborator that records every call made on it, in order: name the
// interface, hand it over, then read `calls` (a mock in Mockito's sense, for
// tests that check what an object told its neighbours). Arguments are
// copied as JSON when the call is made, so a mutable one reads as it was.
export type Call = [string, ...unknown[]];

export function mock<T extends object>(): { it: T; calls: Call[] } {
  const calls: Call[] = [];
  const it = new Proxy({}, {
    get: (_t, name) => (...args: unknown[]) => { calls.push(JSON.parse(JSON.stringify([String(name), ...args]))); },
  }) as T;
  return { it, calls };
}
