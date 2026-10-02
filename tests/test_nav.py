#!/usr/bin/env python3
"""Navigation spec, driven over the AetherUIDriver.

Starts the dev page server on site/ and sae-driver against it, then walks
pages by clicking real buttons and asserts on the widget tree the driver
reports. Needs `AETHER_UI_WITH_DRIVER=1 ./build.sh` and target/pageserver
(see README). Exit status is the number of failed checks.
"""
import json, os, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_PORT, DRIVER_PORT = 8091, 9334
BASE = f"http://127.0.0.1:{SITE_PORT}"
fails = 0


def widgets():
    with urllib.request.urlopen(f"http://127.0.0.1:{DRIVER_PORT}/widgets") as r:
        return json.load(r)


def texts():
    return [w["text"] for w in widgets() if w["type"] == "text"]


def click(label):
    ids = [w["id"] for w in widgets() if w["type"] == "button" and w["text"] == label]
    if not ids:
        raise AssertionError(f"no button labelled {label!r}; texts={texts()}")
    req = urllib.request.Request(
        f"http://127.0.0.1:{DRIVER_PORT}/widget/{ids[-1]}/click", method="POST")
    urllib.request.urlopen(req).read()


def wait_for(pred, what, timeout=3.0):
    """Navigation is deferred to the next event-loop turn and fetches over
    HTTP, so poll for the expected state rather than sleeping blind."""
    end = time.time() + timeout
    while time.time() < end:
        try:
            if pred():
                return True
        except (OSError, AssertionError):
            pass
        time.sleep(0.05)
    return False


def check(name, pred):
    global fails
    ok = wait_for(pred, name)
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else f"  texts={texts()}"))
    if not ok:
        fails += 1


def on_page(first_text, status_prefix):
    def pred():
        t = texts()
        return t[0].startswith(status_prefix) and first_text in t
    return pred


def main():
    server = subprocess.Popen([f"{ROOT}/target/pageserver", f"{ROOT}/site", str(SITE_PORT)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not wait_for(lambda: urllib.request.urlopen(BASE + "/").status == 200, "page server up", 10):
        print("FAIL page server never came up")
        server.terminate()
        return 1
    env = dict(os.environ, AETHER_UI_TEST_PORT=str(DRIVER_PORT))
    log = open(f"{ROOT}/target/test_nav.log", "w")
    sae = subprocess.Popen([f"{ROOT}/target/build/bin/sae-driver", BASE + "/"],
                           env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        if not wait_for(lambda: widgets() is not None, "driver up", 10):
            print("FAIL driver never came up")
            return 1
        check("home loads, currentUrl is the page's URL",
              lambda: on_page("You are at " + BASE + "/", "200 ")())
        baseline = len(widgets())

        click("About")
        check("changePage to /about", on_page("About", f"200 {BASE}/about"))
        click("Back")
        check("browserContext.back() returns home", on_page("Welcome to Sae it ain't so", "200 "))
        click("Forward")
        check("chrome Forward goes to /about again", on_page("About", f"200 {BASE}/about"))
        click("Home")
        check("Home", on_page("Welcome to Sae it ain't so", "200 "))

        click("A page that is not there")
        check("unknown path renders the site's 404 page with status 404",
              on_page("404: no such page", "404 "))
        click("Home")
        check("Home from 404", on_page("Welcome to Sae it ain't so", "200 "))

        click("Old home (302 to /)")
        check("302 is followed to /", on_page("Welcome to Sae it ain't so", f"200 {BASE}/"))

        click("A page that throws")
        check("a page that throws keeps what it built and says so",
              lambda: "Before the error" in texts() and "Inside the block" in texts()
              and "This page failed: see the console." in texts()
              and "Never reached" not in texts())
        click("Back")
        check("chrome Back after a broken page", on_page("Welcome to Sae it ain't so", "200 "))

        click("A page outside the dialect")
        check("a page outside the dialect shows where, and builds nothing",
              lambda: "This page could not be read:" in texts()
              and any(t.endswith("unsupported:3:1: class is not in the page dialect") for t in texts())
              and "You should not see this" not in texts())
        click("Back")
        check("Back from the unreadable page", on_page("Welcome to Sae it ain't so", "200 "))

        click("Counter")
        check("counter page", on_page("Counter page", "200 "))
        for _ in range(3):
            click("Increment")
        click("Home")
        check("Home from counter", on_page("Welcome to Sae it ain't so", "200 "))

        click("Calculator")
        check("calculator page (the design doc's example)", on_page(" 0", "200 "))
        display = lambda want: (lambda: want in texts())
        for k in ("4", "2"):
            click(k)
        check("4 2 shows 42 (reactive state bound to text)", display(" 42"))
        click("C")
        check("C clears", display(" 0"))
        for k in ("7", "+", "3", "="):
            click(k)
        check("7 + 3 = 10 (button block + onclick + closure-held op)", display(" 10"))
        click("C")
        for k in ("6", "*", "7", "="):
            click(k)
        check("6 * 7 = 42 (the row's op, captured per iteration)", display(" 42"))
        click("Home")
        check("Home from calculator", on_page("Welcome to Sae it ain't so", "200 "))

        click("Form")
        check("form page", on_page("echo: ", "200 "))
        fid = [w["id"] for w in widgets() if w["type"] == "textfield"][-1]
        urllib.request.urlopen(urllib.request.Request(
            f"http://127.0.0.1:{DRIVER_PORT}/widget/{fid}/set_text?v=Ada", method="POST")).read()
        check("textfield handler receives the text", lambda: "echo: Ada" in texts())
        click("Read")
        check("get_text reads the field synchronously", lambda: "read: Ada" in texts())
        check("scroll block built its rows", lambda: "row 29" in texts())
        click("Home")
        check("Home from form", on_page("Welcome to Sae it ain't so", "200 "))

        click("Modifier misuse")
        check("a top-level modifier throws; earlier widgets stay",
              lambda: "Before the misuse" in texts() and "Never reached" not in texts()
              and "This page failed: see the console." in texts())
        click("Back")
        check("Back from misuse", on_page("Welcome to Sae it ain't so", "200 "))

        for _ in range(5):
            click("About")
            wait_for(on_page("About", "200 "), "about")
            click("Home")
            wait_for(on_page("Welcome to Sae it ain't so", "200 "), "home")
        check(f"widget census back to {baseline} after 5 round trips (no leak)",
              lambda: len(widgets()) == baseline)
    finally:
        sae.terminate()
        server.terminate()
        sae.wait()
        server.wait()
        log.close()

    out = open(f"{ROOT}/target/test_nav.log").read()
    global fails
    for want in ("count 1", "count 2", "count 3", "ReferenceError",
                 "margin() must be called inside a container's block"):
        ok = want in out
        print(("ok   " if ok else "FAIL ") + f"console shows {want!r}")
        if not ok:
            fails += 1
    print(f"{fails} failed")
    return fails


if __name__ == "__main__":
    sys.exit(main())
