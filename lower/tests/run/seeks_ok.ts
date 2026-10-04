"seeks local-filesystem";
"seeks outgoing-http";
// One privilege per line; the page may then name fs and http. ui, vg,
// storage and browserContext need no seeking. (No page API on mqjs.)
const where = (): string => typeof fs + " " + typeof http + " " + typeof ui;
print(where());
const show = (shell: string): void => print(`a parameter named shell: ${shell}`);
show("mine");
// expect: undefined undefined undefined
// expect: a parameter named shell: mine
