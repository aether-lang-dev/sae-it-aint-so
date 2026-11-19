// examples/eliza's engine, headless: the cases of Tsyne's phone-apps/eliza/
// eliza.test.ts (Paul Hammant, BSD-3-Clause), with the response chosen
// by the test instead of by chance.
import { elizaResponse, getInitialGreeting, isQuitCommand } from "./examples/eliza/lib/eliza-engine.ts";
import { eq } from "./lib/check.ts";

const first = () => 0;
eq("the greeting", getInitialGreeting(), "Hello. I am ELIZA. What is your problem?");
eq("quit commands", ["quit", "bye", "goodbye", "exit", "hello", "I want to quit my job"].map(isQuitCommand), [true, true, true, true, false, true]);
eq("hello gets the first greeting", elizaResponse("hello", first), { response: "How do you do. Please state your problem.", debug: { pattern: "*", rank: 1, matches: ["hello"] } });
eq("sorry", elizaResponse("I am sorry", first).response, "Please don't apologize.");
eq("remember: the rule, the rank, the captures, reflected into the answer", elizaResponse("I remember my childhood", first), {
  response: "Do you often think of your childhood?",
  debug: { pattern: "* remember *", rank: 5, matches: ["i", "my childhood"] },
});
eq("each response of a rule can be picked", [0, 1, 2, 3].map((i) => elizaResponse("I remember my childhood", () => i).response), [
  "Do you often think of your childhood?", "Does thinking of your childhood bring anything else to mind?", "What else do you remember?", "Why do you recall your childhood right now?",
]);
eq("pronouns are reflected: I am happy does not come back as i am", elizaResponse("I am happy", first).response!.toLowerCase().includes("i am"), false);
eq("the computer keyword has a pattern", elizaResponse("Are you a computer?", first).debug!.pattern !== undefined, true);
eq("bye ends the session with no response", elizaResponse("bye"), { response: null });
const unknown = elizaResponse("asdfghjkl", first);
eq("nothing known gets a default", [typeof unknown.response, unknown.debug!.pattern, unknown.debug!.rank], ["string", "*", 0]);
eq("debug info is always there", Object.keys(elizaResponse("I want to be happy", first).debug!).sort(), ["matches", "pattern", "rank"]);
eq("a response is capitalised", elizaResponse("I am feeling sad", first).response![0], elizaResponse("I am feeling sad", first).response![0].toUpperCase());
// the same line, whatever Math.random says, answers from the rule's own list
const seen = new Set<string>();
for (let i = 0; i < 200; i++) seen.add(elizaResponse("I remember my childhood").response!);
eq("with chance on, all four answers turn up and no others", seen.size, 4);
// expect: ok the greeting
// expect: ok quit commands
// expect: ok hello gets the first greeting
// expect: ok sorry
// expect: ok remember: the rule, the rank, the captures, reflected into the answer
// expect: ok each response of a rule can be picked
// expect: ok pronouns are reflected: I am happy does not come back as i am
// expect: ok the computer keyword has a pattern
// expect: ok bye ends the session with no response
// expect: ok nothing known gets a default
// expect: ok debug info is always there
// expect: ok a response is capitalised
// expect: ok with chance on, all four answers turn up and no others
