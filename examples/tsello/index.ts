// SPDX-License-Identifier: MIT
// Tsello, a kanban board, as a sae app. Ported from Tsyne's ported-apps/tsello
// (MIT; portions copyright (c) 2021 Rajasegar Chandran, copyright (c) 2026
// Paul Hammant; see NOTICE.md), itself ported from cl-trello-clone: lists of
// cards, with add, rename, edit and delete, and cards moved between lists.
// The store is Tsyne's (lib/store.ts); the board persists in app storage where
// Tsyne used PouchDB. Tsyne drags a card to a list; here a card moves with its
// < and > buttons, and is dragged up and down within its list.
import { KanbanStore } from "./lib/store.ts";
import type { KanbanList, KanbanCard } from "./lib/store.ts";

const { vstack, hstack, text, btn, divider, spacer, scroll, textfield, get_text, set_text, clear, into, reorderable, set_width, state, bind } = ui;

const load = () => {
  const s = storage.get("board");
  if (s === null) return null;
  try { return JSON.parse(s); } catch { return null; }
};
const store = new KanbanStore(load());
const status = state("");
let editing: { kind: "card" | "list"; id: string } | null = null;
let board = 0;
let newListField = 0;

const updateStatus = (): void => { status.set(`${store.getListCount()} lists, ${store.getCardCount()} cards`); };

const cardRow = (list: KanbanList, card: KanbanCard, i: number, ix: number, lists: KanbanList[]): void => {
  hstack(4) {
    if (editing && editing.kind === "card" && editing.id === card.id) {
      const f = textfield("Card text");
      set_text(f, card.label);
      ui.on_submit(f, (t: string) => { editing = null; if (t.trim()) store.updateCard(card.id, t.trim()); else render(); });
      btn("Save", () => { const t = get_text(f).trim(); editing = null; if (t) store.updateCard(card.id, t); else render(); });
      btn("Cancel", () => { editing = null; render(); });
    } else {
      text(card.label);
      spacer();
      if (ix > 0) btn("<", () => store.moveCard(card.id, lists[ix - 1].id));
      if (ix < lists.length - 1) btn(">", () => store.moveCard(card.id, lists[ix + 1].id));
      btn("Edit", () => { editing = { kind: "card", id: card.id }; render(); });
      btn("Delete", () => store.deleteCard(card.id));
    }
  }
};

const listColumn = (list: KanbanList, ix: number, lists: KanbanList[]): void => {
  const col = vstack(6) {
    hstack(4) {
      if (editing && editing.kind === "list" && editing.id === list.id) {
        const f = textfield("List title");
        set_text(f, list.title);
        ui.on_submit(f, (t: string) => { editing = null; if (t.trim()) store.renameList(list.id, t.trim()); else render(); });
        btn("Save", () => { const t = get_text(f).trim(); editing = null; if (t) store.renameList(list.id, t); else render(); });
        btn("Cancel", () => { editing = null; render(); });
      } else {
        text(list.title);
        spacer();
        btn("Rename", () => { editing = { kind: "list", id: list.id }; render(); });
        btn("Delete list", () => store.deleteList(list.id));
      }
    }
    divider();
    const cards = store.getCardsForList(list.id);
    if (cards.length === 0) text("No cards");
    else {
      const stack = vstack(4) { cards.forEach((c, i) => cardRow(list, c, i, ix, lists)) };
      reorderable(stack, (from: number, to: number) => store.moveCard(cards[from].id, list.id, to));
    }
    hstack(4) {
      const f = textfield(`Add a card to ${list.title}`);
      const add = (t: string) => { if (t.trim()) store.addCard(list.id, t.trim()); };
      ui.on_submit(f, add);
      btn("+ Add Card", () => add(get_text(f)));
    }
  };
  set_width(col, 300);
};

const render = (): void => {
  clear(board);
  into(board) {
    const lists = store.getLists();
    if (lists.length === 0) text("No lists yet. Add one to get started.");
    lists.forEach((l, ix) => listColumn(l, ix, lists));
  }
  updateStatus();
};

store.subscribe(() => {
  storage.set("board", JSON.stringify(store.snapshot()));
  render();
});

hstack(8) {
  text("Tsello");
  spacer();
  bind(text(""), status);
  spacer();
  newListField = textfield("New list title");
  const addList = (t: string) => { if (t.trim()) { store.addList(t.trim()); set_text(newListField, ""); } };
  ui.on_submit(newListField, addList);
  btn("+ Add List", () => addList(get_text(newListField)));
  btn("Clear All", () => store.clear());
}
divider();
scroll { board = hstack(10) }

render();
