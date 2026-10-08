// Every import form, against lib/counter.ts and lib/again.ts.
import describe, { count, inc, Counter, twice, shown as alias } from "./lib/counter.ts";
import * as ns from "./lib/counter.ts";
import { bump, extra, counter } from "./lib/again.ts";
import type { Nothing } from "./lib/counter.ts";
import { type AlsoNothing, name } from "./lib/counter.ts";
import "./lib/counter.ts";

print(name, count, inc(), inc(2));
print("snapshot:", count, "live:", ns.count);
print(describe());
print(twice(21), alias);
print(new Counter().tick());
print(bump(10), ns.count, counter.count, extra);
print(Object.keys(ns).sort().join(","));
// expect: counter 0 1 3
// expect: snapshot: 0 live: 3
// expect: counter at 3 of 10
// expect: 42 not exported
// expect: 1
// expect: 13 13 13 1
// expect: Counter,count,default,inc,limit,name,shown,twice
