// An app whose pages import from their own bundle and from sae:.
import { greet } from "./lib/greet.ts";
import { greet as again } from "app:/lib/greet.ts";
import { band } from "sae:scales";
ui.text(`app imports: ${greet("sae")} ${again("app") === greet("app")}`);
ui.text(`band: ${band(["a", "b"], [0, 100])("b")}`);
ui.btn("Outside", () => browserContext.changePage("/outside"));
ui.btn("Escape", () => browserContext.changePage("/escape"));
