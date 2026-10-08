// A top-level await: the page continues after its promise settles, with
// the page's widgets built in order.
import { lerp } from "sae:easing";
ui.text("before await");
const v = await new Promise<number>((ok) => ui.after(50, () => ok(lerp(0, 10, 0.5))));
ui.text(`after await: ${v}`);
await ui.sleep(10);
ui.text("done");
