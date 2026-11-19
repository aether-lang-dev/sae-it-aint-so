# Tsello, on sae

A port of Tsyne's Tsello kanban board (MIT; portions copyright Rajasegar
Chandran 2021 and Paul Hammant 2026, from cl-trello-clone; see
[NOTICE.md](NOTICE.md)) to a sae app: lists of cards.

```sh
target/build/bin/sae --app examples/tsello
SAE_TEST_APP=examples/tsello SAE_STORAGE_DIR=target/spec-storage tests/run_spec.sh spec_tsello
```

Add lists and cards from the fields, `Rename` and `Edit` them in place,
`Delete` cards and lists (a list takes its cards with it), `<` and `>` move a
card to the neighbouring list, and a card is dragged up or down within its
list. The board is kept in app storage; `Clear All` empties it (and the next
start brings back the sample board, as in Tsyne).

Not ported: dragging a card to another list with a ghost under the cursor,
which wants drop targets across containers. `lib/store.ts` is Tsyne's store
and runs headless in `lower/tests/mod/ex_tsello.ts`.
