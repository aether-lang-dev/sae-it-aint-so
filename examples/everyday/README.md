# Everyday, on sae

Six of Tsyne's tutorial examples (15 tip calculator, 16 password generator,
18 dice roller, 19 BMI calculator, 20 rock paper scissors, 21 quiz; MIT,
Copyright (c) 2025 Paul Hammant; see [NOTICE.md](NOTICE.md)) as six views of
one sae app, a ladder of small pages that each use a few widgets.

```sh
target/build/bin/sae --app examples/everyday
SAE_TEST_APP=examples/everyday tests/run_spec.sh spec_everyday
```

`lib/everyday.ts` holds each example's rules as functions of their inputs;
`lower/tests/mod/ex_everyday.ts` runs them headless, the random ones with a
generator the test picks.
