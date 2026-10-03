"seal except ui, storage";
ui.text("hello");
http.get("/x", (res: any) => {});
// error: 3:1: http is sealed out of this page
