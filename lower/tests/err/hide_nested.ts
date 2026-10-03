const outer = (): void => {
  "hide http";
  const inner = (): void => {
    http.get("/x", (res: any) => {});
  };
};
// error: 4:5: http is hidden here
