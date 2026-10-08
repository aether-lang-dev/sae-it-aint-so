# contrib.sqlite: expose the authorizer, limits, extension control, and the prepared-statement column API

**From:** sae (`services/sqlite/module.ae`, branch wave1/sqlite, 2026-10-08)

## Motivation

sae gives an installed app SQLite databases by name (`sqlite.notes.all(sql,
params)`), and must hold each connection to exactly one file: an app's page
must not `ATTACH DATABASE '/any/path'`, `DETACH`, `VACUUM INTO '/path'`,
call `load_extension()`, or set a PRAGMA that names a directory. SQLite's
own answer is `sqlite3_set_authorizer` (deny `SQLITE_ATTACH`,
`SQLITE_DETACH`, the `load_extension` function, `SQLITE_PRAGMA` for the
directory pragmas), `sqlite3_limit(db, SQLITE_LIMIT_ATTACHED, 0)` and
`sqlite3_enable_load_extension(db, 0)`.

sae also returns rows as plain objects with the right JS types, which needs
the prepared statement's column count, names and types, `double` columns
and binds, 64-bit binds and columns in one call, `last_insert_rowid`, and
named parameters (`$id`).

## What contrib.sqlite has today

`open/close/exec/query`, `prepare`, `bind_int/text/blob/i64(hi,lo)/null`,
`step`, `next_row`, `column_int/i64(hi,lo)/text/blob`, `reset`,
`finalize`, `changes`, `errmsg`. None of the calls above.

## What sae does meanwhile (no C, no fork)

`services/sqlite/module.ae` declares the missing calls itself, against the
`libsqlite3` the module already links through `@link`:

```
extern sqlite3_set_authorizer(db: ptr, cb: fn(ptr, int, string, string, string, string) -> int, ud: ptr) -> int
extern sqlite3_limit(db: ptr, id: int, val: int) -> int
extern sqlite3_enable_load_extension(db: ptr, on: int) -> int
extern sqlite3_column_count(stmt: ptr) -> int
extern sqlite3_column_name(stmt: ptr, i: int) -> string
extern sqlite3_column_type(stmt: ptr, i: int) -> int
extern sqlite3_column_double(stmt: ptr, i: int) -> float
extern sqlite3_column_int64(stmt: ptr, i: int) -> long long
extern sqlite3_bind_double(stmt: ptr, i: int, v: float) -> int
extern sqlite3_bind_int64(stmt: ptr, i: int, v: long long) -> int
extern sqlite3_bind_parameter_count(stmt: ptr) -> int
extern sqlite3_bind_parameter_index(stmt: ptr, name: string) -> int
extern sqlite3_last_insert_rowid(db: ptr) -> long long
```

The authorizer is an Aether function cast `authorize_ as fn(ptr, int,
string, string, string, string) -> int`: the typed-function-pointer form the
language reference names for "libcurl/sqlite hooks" works as documented
(the `const char*` arguments arrive as strings; `string.string_length`
handles the NULLs SQLite passes). This is verified by
`tests/spec_sqlite_service.ae` in sae, including a statement handed
straight to `contrib.sqlite` on the same connection being refused.

So nothing blocks sae. The ask is to move these into `contrib.sqlite` so a
second Aether program needing them does not redeclare SQLite's ABI, and so
`module.ae` stays the one description of what the veneer offers.

## The ask

Add to `contrib.sqlite/module.ae` (Go-style wrappers over the raw externs,
as the v2 surface is):

- `set_authorizer(db, cb: fn(ptr, int, string, string, string, string) -> int, ud: ptr) -> string`,
  with the action codes (`SQLITE_ATTACH` 24, `SQLITE_DETACH` 25,
  `SQLITE_PRAGMA` 19, `SQLITE_FUNCTION` 31, ...) and `SQLITE_DENY` 1 /
  `SQLITE_IGNORE` 2 as exported constants, or an `Authorizer` named
  function-pointer type.
- `limit(db, id, val) -> int` with the `SQLITE_LIMIT_*` constants
  (`SQLITE_LIMIT_ATTACHED` is 7, not 6, which is `FUNCTION_ARG`: the
  constants belong in the module so nobody counts).
- `enable_load_extension(db, on) -> string`.
- `column_count`, `column_name`, `column_type` (with `SQLITE_INTEGER` 1 ..
  `SQLITE_NULL` 5), `column_double`, `column_int64 -> long`,
  `bind_double`, `bind_int64(stmt, idx, v: long)`,
  `bind_parameter_count`, `bind_parameter_index`, `last_insert_rowid -> long`.
  The `(hi, lo)` split pair can stay for MSVC; a `long` form beside it is
  what every other platform wants.

When these land, sae drops its externs (one block at the top of
`services/sqlite/module.ae`) and pins the aether version that has them.
