# sae on Windows, and a page server in WSL

sae builds as a native 64-bit Win32 program (`sae.exe`, PE32+ x86-64) on
aether-ui's Win32 backend. The pages it loads can come from anywhere HTTP
reaches, including a Linux page server running in WSL on the same machine:
that is the shape of "a Linux server speaking TypeScript on the wire to a sae
browser native on Windows".

First done 2026-11-10 on win11 (Windows 11 26200, MSYS2 MINGW64, gcc 16.2),
with the pins in `pins` (Aether 0.905.0, aeb v0.344, aether-ui 4b553fd4).

## Building on Windows

The environment is MSYS2's MINGW64 shell, the one aether's own Windows CI
uses. `tools/setup-siblings.sh` and `./build.sh` work there as on Linux;
`.build.ae` has a `windows` arm (aether-ui's `aether_ui_win32.c` and the
Win32 system libraries).

sae's root links (`aether-ui`, `ui`, `vg`, and a few under `tests/` and
`lower/`) must be real symlinks. MSYS2 makes native ones with
`MSYS=winsymlinks:nativestrict`, which needs Windows' Developer Mode or an
elevated shell (an administrator's ssh session is elevated; that is how
win11 made them), and git makes them only with `core.symlinks=true`.
`nativestrict` refuses a link whose target does not exist yet, so check out
before the siblings exist, then make the links:

```sh
export MSYS=winsymlinks:nativestrict
git clone -c core.symlinks=false https://github.com/aether-lang-dev/sae-it-aint-so.git sae
cd sae
sh tools/setup-siblings.sh                   # ../aether, ../aether-ui, ../aeb at the pins
git config core.symlinks true
L=$(git ls-files -s | awk '$1==120000{print $4}')
rm -f $L && git checkout -- $L               # now real links
./build.sh                                   # target/build/bin/sae.exe
AETHER_UI_WITH_DRIVER=1 ./build.sh           # target/build/bin/sae-driver.exe
export PATH=$PWD/../aether/build:$PATH AETHER_HOME=$PWD/../aether
(cd tools && ae build pageserver.ae -o ../target/pageserver)
```

## A page server in WSL (wslc)

WSL's container CLI, `wslc` (in `C:\Program Files\WSL`), builds and runs
Linux images from a Dockerfile. The page server is a Linux program like any
other there. Build it on an x86_64 Linux host (Ubuntu 22.04's glibc keeps it
runnable on later ones), then stage it with its OpenSSL libraries and the
site it serves:

```
wsl/
  Dockerfile
  pageserver                    # target/pageserver from the Linux host
  lib/libssl.so.3 lib/libcrypto.so.3
  site/                         # git archive HEAD site | tar -x
```

```dockerfile
FROM ubuntu:22.04
COPY pageserver /sae/pageserver
COPY lib /sae/lib
COPY site /sae/site
ENV LD_LIBRARY_PATH=/sae/lib
EXPOSE 8091
CMD ["/sae/pageserver", "/sae/site", "8091"]
```

```bat
wslc build -t sae-pageserver:dev C:\path\to\wsl
wslc run -d --name saeps -p 8091:8091 sae-pageserver:dev
target\build\bin\sae.exe http://127.0.0.1:8091/
```

The page server listens on every interface inside the container (Aether's
HTTP server binds `0.0.0.0` unless told otherwise; its first line of output
names 127.0.0.1, which is only the address it suggests). wslc publishes the
port on the Windows side's loopback only (`127.0.0.1:8091->8091/tcp`), so the
browser on the same machine reaches it and other machines do not.

## Testing against it

`SAE_TEST_SERVER=external` makes `tests/run_spec.sh` use the page server that
already answers on `SAE_TEST_SITE_PORT` (8091) instead of starting
`target/pageserver`, and refuse to run when nothing does:

```sh
SAE_TEST_SERVER=external tests/run_spec.sh        # spec_nav: Windows sae, WSL page server
```

spec_nav is 48 passing that way on win11, as it is with both ends native on
Windows and on macOS.

## An app's backend on Windows

An app's backend (`docs/app-backend.md`) runs on Windows over the same
channel as everywhere: its stdin and stdout (`os.run_stdio`, Aether
0.908.0). A native one is a `.exe` in the app (`program` gets `.exe`
added); `spec_app_backend` and `spec_app_backend_stray` pass natively on
win11.

A Linux one runs in a WSL container: app.json's
`"backend": { "wslc": { "image": "<image>", "command": [...] } }`, which sae
runs as `wslc run --rm -i --pull never <image> <command...>`. `wslc` is found
on PATH, else at `%ProgramFiles%\WSL\wslc.exe` (an MSYS2 shell's PATH does
not have it). The image must already be there; wslc's own messages (pull
progress, "No such image") go to stderr, never into the channel.

The test image is tests/apps/backend's program compiled for Linux with the
Aether in `pins` (or `AETHER_REF=<branch or SHA>` from source), inside the
image, so nothing but wslc is needed on the Windows side:

```sh
sh tests/apps/backend_wslc/build-image.sh       # sae-backend-test:dev
SAE_TEST_APP=tests/apps/backend_wslc tests/run_spec.sh spec_app_backend_wslc
```

`tests/run_all.sh` builds the image before the spec on Windows (a cached
rebuild is seconds); elsewhere the spec checks that sae refuses a wslc
backend and says why.

## State (2026-11-11)

`tests/run_all.sh` natively on win11 (browser a Windows program, page server
the one already answering on 8091, so `SAE_TEST_SERVER=external`): 63 of 66
pass on Aether 0.908.0 and aether-ui 93d1b24e, the three backend specs among
them. The four aether-ui Win32 failures of the earlier 59 of 65 are fixed
there: set_focusable taken away from a stack (spec_keys), onsubmit in a
field's block (spec_grid: the driver's submit went through the key handlers,
where the grid took the Return), a two-key chord named with `Primary`
(spec_app_menus), and spec_aevg_parity's canvas, 449 px high instead of 400
(a scrollview's document was stretched to the view, handing its slack to the
canvas row). What it took before that: the binary's path, `fs.realpath`,
`%APPDATA%`, `%USERPROFILE%` and `%TEMP%` in the kernel's "/" form
(`slashes_`, `home_dir_`, `temp_dir_`); drive paths in services/files (a path
with no drive is outside every grant there); and tests and tools that read
CRLF output or MSYS2's `/c/...` spelling of `C:/...`.

Still failing, each a fix upstream:

- spec_app_bus: the courier file is to be readable only by its user. Aether's
  `fs.chmod` on Windows toggles the read-only attribute and ignores the rest,
  so the key is as readable as its folder. Needs an owner-only file in
  std.fs (a DACL on Windows).
- spec_app_httplist: `api.localhost` does not resolve on Windows (macOS and
  Linux resolve every `*.localhost` to loopback, RFC 6761). Needs Aether's
  resolver to do so on every platform.
- spec_escape failed in this run only because the run used an already-running
  page server on 8091 (it serves `site/`, and the spec needs its own site
  directory); it is not a Windows failure, rerun it with no server on 8091.

A page server already answering on 8091 (the WSL container) takes a native
run's requests on Windows, as wslc's 127.0.0.1 relay wins over the native
server's 0.0.0.0; `tests/run_spec.sh` now refuses to start then.
