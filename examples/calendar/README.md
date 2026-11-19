# Calendar, on sae

A port of Tsyne's Calendar (Copyright (c) 2025 Paul Hammant, BSD-2-Clause
terms; see [NOTICE.md](NOTICE.md)) to a sae app: a month grid with a dot on
days that have events, `< Prev`, `Next >` and `Today`, `+ New Event`, and the
events of today and the next seven days, each with `Delete`.

```sh
target/build/bin/sae --app examples/calendar
SAE_TEST_APP=examples/calendar tests/run_spec.sh spec_calendar
```

Additions to Tsyne's page: a title field for the new event, and `Go to` a date
as `YYYY-MM-DD`. `lib/calendar-service.ts` is Tsyne's service (with a clock it
can be given) and runs headless in `lower/tests/mod/ex_calendar.ts` with the
date held at 19 November 2026.
