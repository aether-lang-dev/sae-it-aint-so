"seal except ui, storage";
// The page names only what its seal lists, plus anything it binds itself.
print(typeof ui);
const show = (fs: string): void => print(`a parameter named fs: ${fs}`);
show("mine");
const tidy = (): void => {
  "hide storage";
  print(typeof ui);   // ui is still in reach here
};
tidy();
print(typeof storage);  // the hide ended with its function
// expect: undefined
// expect: a parameter named fs: mine
// expect: undefined
// expect: undefined
