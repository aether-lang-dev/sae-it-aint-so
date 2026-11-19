# Calcudoku, on sae

A port of Tsyne's Calcudoku (KenKen; MIT, Paul Hammant; see
[NOTICE.md](NOTICE.md)) to a sae app: fill the grid with 1 to N, each row and
column once, each cage's numbers making its target with its operation.

```sh
target/build/bin/sae --app examples/calcudoku
```

Five puzzles, 3x3 to 5x5, each with its answer known. Click a cell and press
a digit button (or the key), `C` clears it, `Reset` empties the board, `Solve`
lets the solver play its answer in a cell at a time, and the status line
reads `Solved!` when the board is right. A cell that repeats a digit in its
row or column, or completes a wrong cage, turns red.

The board is a `vg` scene; `lib/calcudoku.ts` is Tsyne's rules and solver,
which `lower/tests/mod/ex_calcudoku.ts` runs headless (Tsyne's logic tests).
The spec, `tests/spec_calcudoku.ae`, plays level 1 through the driver:

```sh
SAE_TEST_APP=examples/calcudoku tests/run_spec.sh spec_calcudoku
```
