// The import names the bytes it expects (an SRI-alike); the server served
// exactly those.
import { version } from "./lib/card.ts#sha256-8b8caa0caf8ac7e6ffa782e1d8fb783bf6c184df3ab4a3a7e4f66008e841dc73";
ui.text(`hash ok: ${version}`);
