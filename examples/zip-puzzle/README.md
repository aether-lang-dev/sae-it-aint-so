# Zip Puzzle, on sae

A port of Tsyne's Zip Puzzle (MIT, Paul Hammant; see [NOTICE.md](NOTICE.md))
to a sae app: draw one path from the dot numbered 1, through the numbered dots
in order, covering every cell exactly once.

```sh
target/build/bin/sae --app examples/zip-puzzle
```

Click a neighbour of the path's head to extend it; click the head, or any
earlier cell, to take the path back to there. A numbered dot can only be
taken in its turn. Five levels, 5x5 to 7x7; the status line counts cells and
reads `Solved!` at the end.

`lib/zip-puzzle.ts` is Tsyne's rules, run headless by
`lower/tests/mod/ex_zip_puzzle.ts` (Tsyne's logic tests). The spec plays a
snake through level 1:

```sh
SAE_TEST_APP=examples/zip-puzzle tests/run_spec.sh spec_zip_puzzle
```
