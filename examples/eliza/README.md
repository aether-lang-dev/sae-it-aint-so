# ELIZA, on sae

A port of Tsyne's ELIZA (BSD-3-Clause, Copyright (c) 2025 Paul Hammant; see
[NOTICE.md](NOTICE.md)), Joseph Weizenbaum's 1966 chatbot: a Rogerian
psychotherapist made of keyword rules, ranks, wildcard patterns and pronoun
reflection.

```sh
target/build/bin/sae --app examples/eliza
SAE_TEST_APP=examples/eliza tests/run_spec.sh spec_eliza
```

Try "I am feeling sad" or "I remember my childhood". `Debug` adds a line
saying which rule answered and what it captured; `Clear` starts over; "bye"
ends the session. `lib/eliza-engine.ts` runs headless in
`lower/tests/mod/ex_eliza.ts`, with the response chosen by the test.
