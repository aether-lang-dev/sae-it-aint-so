"seeks database fred";
"seeks database atlas, reduced functionality without";
// One line per database; the page may then name sqlite. (No page API in
// saejs, so sqlite is undefined here; the host installs sqlite.fred.)
const where = (): string => typeof sqlite;
print(where());
const show = (sqlite: string): void => print(`a parameter named sqlite: ${sqlite}`);
show("mine");
// expect: undefined
// expect: a parameter named sqlite: mine
