"seeks native engine";
"seeks native solver, reduced functionality without";
// One line per native module (docs/natives.md); the page may then name
// natives. (No page API in saejs, so natives is undefined here; the host
// installs natives.engine for an app whose own host has it compiled in.)
print(typeof natives);
// expect: undefined
