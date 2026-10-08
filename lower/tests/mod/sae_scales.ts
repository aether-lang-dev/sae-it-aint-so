// sae:scales: linear, log, band and ordinal, with ticks, invert and nice.
import { linear, log, band, ordinal, ticks, tickStep } from "sae:scales";
const x = linear().domain([0, 100]).range([0, 300]);
print("linear:", x(50), x(0), x(100), x(150), x.invert(150));
print("clamp:", x.clamp(true)(150), x.clamp());
print("ticks:", x.ticks(5).join(","), "|", ticks(0, 1, 5).join(","), "|", ticks(10, 0, 4).join(","));
print("tickStep:", tickStep(0, 100, 10), tickStep(0, 7, 10), tickStep(0, 1, 3));
print("nice:", linear().domain([3, 97]).nice(10).domain().join(","), linear([0.13, 0.77], [0, 1]).nice(5).domain().join(","));
print("reversed range:", linear([0, 10], [200, 0])(2.5), linear([0, 10], [200, 0]).invert(50));
const y = log().domain([1, 1000]).range([0, 3]);
print("log:", y(10), y(1000), y.invert(2), y.ticks().join(","));
print("log nice:", log([3, 500], [0, 1]).nice().domain().join(","));
print("log wide ticks:", log([1, 1e6], [0, 1]).ticks().join(","));
const b = band().domain(["a", "b", "c"]).range([0, 300]).padding(0.1);
print("band:", [b("a"), b("b"), b("c"), b.bandwidth(), b.step()].map((v) => v.toFixed(2)).join(" "), b("z"));
print("band no padding:", band(["p", "q"], [0, 100])("q"), band(["p", "q"], [0, 100]).bandwidth());
const c = ordinal().domain(["a", "b"]).range(["red", "green"]);
print("ordinal:", c("a"), c("b"), c("c"), c("a"), c.domain().join(","));
print("getters:", x.domain().join(","), x.range().join(","), b.padding());
// expect: linear: 150 0 300 450 50
// expect: clamp: 300 true
// expect: ticks: 0,20,40,60,80,100 | 0,0.2,0.4,0.6,0.8,1 | 10,8,6,4,2,0
// expect: tickStep: 10 0.5 0.5
// expect: nice: 0,100 0.1,0.8
// expect: reversed range: 150 7.5
// expect: log: 1 3 100 1,2,3,4,5,6,7,8,9,10,20,30,40,50,60,70,80,90,100,200,300,400,500,600,700,800,900,1000
// expect: log nice: 1,1000
// expect: log wide ticks: 1,10,100,1000,10000,100000,1000000
// expect: band: 9.68 106.45 203.23 87.10 96.77 NaN
// expect: band no padding: 50 50
// expect: ordinal: red green red red a,b,c
// expect: getters: 0,100 0,300 0.1
