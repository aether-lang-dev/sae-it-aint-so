# Gitify, on sae

A port of [Gitify](https://github.com/gitify-app/gitify) (your GitHub
notifications on the desktop, MIT; see [NOTICE.md](NOTICE.md)) from Electron
to a sae app: one TypeScript page whose GitHub calls run on sae's http, which
runs them on Aether actors.

```sh
target/build/bin/sae --app examples/gitify      # run it
tools/saepack.sh examples/gitify                # -> target/apps/Gitify.app
```

Sign in with a personal access token (scopes `notifications`, `read:user`,
`repo`), to github.com or a GitHub Enterprise host.

## What is ported

- **Sign in with a token**, to github.com or an Enterprise host
  (`https://<host>/api/v3`), checked with `GET /user` as Gitify does.
- **The notification list**, from `GET /notifications`, grouped by
  repository, with Gitify's wording for subject types and reasons
  ("Review Requested", "Mentioned") and "3 hours ago" times.
- **Gitify's actions**: open, mark read (`PATCH .../threads/{id}`), mark done
  (`DELETE`), mark a repository read and mark all read (`PUT`).
- **Open in the browser** as Gitify does: follow the subject's API URL to its
  `html_url`, add Gitify's `notification_referrer_id`, hand it to the system
  with `shell.open`, and mark it read if that setting is on.
- **Polling** at the interval GitHub asks for (`X-Poll-Interval`).
- **Settings**: show only participating, mark as read when opened, sign out.
  The account and settings are kept in app storage.

## What it may do

`app.json` grants `https://api.github.com/` for http and
`https://github.com/` for `shell.open`, nothing else; the page starts with
`"seeks outgoing-http"` and `"seeks open-urls"`. See
[docs/app-capabilities.md](../../docs/app-capabilities.md). An Enterprise
host needs its own `api/v3/` prefix added to the grant.

Gitify chains its API calls with `async`/`await`. Here, as in Gitify, they
are never more than one call deep (fetch the subject, then open it), so
sae's callbacks keep it plain.

## Not yet

| Gitify feature | What sae needs first |
|---|---|
| Tray / menu-bar icon, unread badge, desktop notifications and sound | Tray and notification capabilities for apps |
| OAuth device flow sign-in, several accounts | Nothing new; not done yet |
| GraphQL enrichment (who commented, PR state, labels) | Nothing new; more calls per note |
| Filters (by reason, type, user), keyboard shortcuts, themes | Small; not done yet |
| Opening at login, auto-update | Packaging work in `tools/saepack.sh` |

## Tests

```sh
SAE_TEST_APP=tests/apps/gitify SAE_STORAGE_DIR=$PWD/target/spec-storage \
  SAE_SHELL_LOG=$PWD/target/spec-shell.log tests/run_spec.sh spec_gitify
```

`tests/apps/gitify` is this page with a grant for the page server's mock
GitHub Enterprise API (`/api/v3` in `tools/pageserver.ae`, token
`test-token`). The spec signs in (after the kernel refuses github.com, which
the test grant leaves out, and the mock rejects a bad token), checks the
grouped list, opens a note and reads the URL the app handed to the system,
marks done, toggles participating, marks all read and signs out: 10 specs.
