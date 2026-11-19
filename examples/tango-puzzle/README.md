# Tango Puzzle, on sae

A port of Tsyne's Tango Puzzle (MIT, Paul Hammant; see [NOTICE.md](NOTICE.md))
to a sae app: fill the grid with suns and moons so that no three in a row (or
column) are the same and each row and column holds as many of each.

```sh
target/build/bin/sae --app examples/tango-puzzle
```

Click a cell to cycle empty, sun, moon; givens are tinted and stay. `Undo`
(or `z`) takes the last click back, `Reset` returns to the givens, `<` and `>`
change level (five, 4x4 and 6x6). Cells in a violation turn red, the status
line says so, and `Solved!` when the board is complete and valid.

`lib/tango-puzzle.ts` is Tsyne's rules, run headless by
`lower/tests/mod/ex_tango_puzzle.ts` (Tsyne's logic tests, and a search that
every level can be won). The spec plays level 1 through the driver:

```sh
SAE_TEST_APP=examples/tango-puzzle tests/run_spec.sh spec_tango_puzzle
```
