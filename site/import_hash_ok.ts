// The import names the bytes it expects (an SRI-alike); the server served
// exactly those.
import { version } from "./lib/card.ts#sha256-184ad196b6932544d80f8f2b61564d35621cc07587cacaf6be29ac6714fd0115";
ui.text(`hash ok: ${version}`);
