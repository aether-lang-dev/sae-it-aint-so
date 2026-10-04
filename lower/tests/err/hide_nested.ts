"seeks outgoing-http";
const outer = (): void => {
  "hide http";
  const inner = (): void => {
    http.get("/x", (res: any) => {});
  };
};
// error: 5:5: http is hidden here
