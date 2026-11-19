# Contacts, on sae

A port of Tsyne's Contacts (Copyright (c) 2025 Paul Hammant, BSD-2-Clause
terms; see [NOTICE.md](NOTICE.md)) to a sae app: a searchable list with the
favourites first, a star to toggle each, edit and delete.

```sh
target/build/bin/sae --app examples/contacts
SAE_TEST_APP=examples/contacts SAE_STORAGE_DIR=target/spec-storage tests/run_spec.sh spec_contacts
```

`Add` and `Edit` open one form (name, phone, email, address, notes); the
contacts are kept in app storage. `lib/contacts-service.ts` is Tsyne's
service and runs headless in `lower/tests/mod/ex_contacts.ts`.
