// SPDX-License-Identifier: BSD-3-Clause
// ELIZA, as a sae app. Ported from Tsyne's phone-apps/eliza (BSD-3-Clause,
// Copyright (c) 2025 Paul Hammant; see NOTICE.md), itself a port of Joseph
// Weizenbaum's 1966 chatbot: a Rogerian psychotherapist made of keyword rules,
// ranks, wildcard patterns and pronoun reflection (lib/eliza-engine.ts is
// Tsyne's engine). Clear starts over, Debug shows which rule answered, and
// the last twenty messages are shown, as in Tsyne.
import { elizaResponse, getInitialGreeting } from "./lib/eliza-engine.ts";

const { vstack, hstack, text, text_wrapped, btn, divider, spacer, scroll, clear, into, textfield, set_text, state, bind } = ui;

interface Msg { who: "You" | "ELIZA"; text: string; debug: boolean }

let messages: Msg[] = [{ who: "ELIZA", text: getInitialGreeting(), debug: false }];
let debugMode = false;
const status = state("Ready");
let list = 0;
let input = 0;

const refresh = (): void => {
  clear(list);
  into(list) {
    for (const m of messages.slice(-20)) text_wrapped(`${m.who}: ${m.text}`, 440);
  }
};

const say = (who: "You" | "ELIZA", t: string, debug = false): void => { messages.push({ who, text: t, debug }); };

const send = (raw: string): void => {
  const t = raw.trim();
  if (!t) return;
  say("You", t);
  const r = elizaResponse(t);
  if (r.response === null) {
    say("ELIZA", "Goodbye. It was nice talking to you.");
    status.set("Session ended");
  } else {
    if (debugMode && r.debug) {
      say("ELIZA", `[Pattern: "${r.debug.pattern}" | Rank: ${r.debug.rank}${r.debug.matches.length > 0 ? ` | Matches: ${r.debug.matches.join(", ")}` : ""}]`, true);
    }
    say("ELIZA", r.response);
  }
  refresh();
  set_text(input, "");
};

hstack(4) {
  btn("Clear", () => { messages = [{ who: "ELIZA", text: getInitialGreeting(), debug: false }]; refresh(); status.set("Conversation cleared"); });
  btn("Debug", () => { debugMode = !debugMode; status.set(debugMode ? "Debug mode: ON" : "Debug mode: OFF"); });
  spacer();
  bind(text(""), status);
}
divider();
scroll { list = vstack(4) }
divider();
hstack(4) {
  text("You:");
  input = textfield("Type a message");
  ui.on_submit(input, (t: string) => send(t));
  btn("Send", () => send(ui.get_text(input)));
}
text_wrapped("Type a message and press Enter. Try: \"I am feeling sad\" or \"I remember my childhood\"", 440);
refresh();
