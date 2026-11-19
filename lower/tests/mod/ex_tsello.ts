// examples/tsello's store, headless: the cases of Tsyne's
// ported-apps/tsello/store.test.ts (Rajasegar Chandran and Paul Hammant, MIT),
// with the snapshot standing where PouchDB did.
import { KanbanStore } from "./examples/tsello/lib/store.ts";
import { eq } from "./lib/check.ts";

const titles = (s: KanbanStore) => s.getLists().map((l) => l.title);
const labels = (s: KanbanStore, listId: string) => s.getCardsForList(listId).map((c) => c.label);

const s = new KanbanStore();
eq("seeded: three lists, seven cards", [titles(s), s.getListCount(), s.getCardCount()], [["To Do", "Doing", "Done"], 3, 7]);
eq("To Do has 3 cards, Doing 2, Done 2", s.getLists().map((l) => l.cardIds.length), [3, 2, 2]);
eq("the seed cards, in order", labels(s, "list-001"), ["Design wireframes", "Set up CI pipeline", "Write unit tests"]);

const a = s.addList("Backlog");
eq("addList appends, with the next id", [a.title, a.id, titles(s)[3], s.getListCount()], ["Backlog", "list-004", "Backlog", 4]);
s.renameList("list-004", "Icebox");
s.renameList("nope", "x");
eq("renameList changes the title; an unknown id is ignored", titles(s), ["To Do", "Doing", "Done", "Icebox"]);
const c = s.addCard("list-004", "Think");
eq("addCard puts a card on the list, returns it; an unknown list gives undefined", [c, s.addCard("nope", "x"), labels(s, "list-004")], [{ id: "card-008", label: "Think", listId: "list-004" }, undefined, ["Think"]]);
s.updateCard("card-008", "Think harder"); s.updateCard("nope", "x");
eq("updateCard changes the label; an unknown id is ignored", s.getCard("card-008")!.label, "Think harder");
s.deleteList("list-004"); s.deleteList("nope");
eq("deleteList removes the list and its cards", [s.getListCount(), s.getCardCount(), s.getCard("card-008")], [3, 7, undefined]);
s.deleteCard("card-002"); s.deleteCard("nope");
eq("deleteCard removes the card from its list", [labels(s, "list-001"), s.getCardCount()], [["Design wireframes", "Write unit tests"], 6]);

const copy = s.getLists(); copy[0].title = "changed"; copy[0].cardIds.push("x");
eq("getLists hands out copies", [titles(s)[0], s.getLists()[0].cardIds.length], ["To Do", 2]);
const cc = s.getCard("card-001")!; cc.label = "changed";
eq("so does getCard", s.getCard("card-001")!.label, "Design wireframes");
eq("an unknown list or card", [s.getListById("nope"), s.getCard("nope"), s.getCardsForList("nope")], [undefined, undefined, []]);

const m = new KanbanStore();
m.moveCard("card-001", "list-002");
eq("moving a card to another list puts it last there, and its listId follows", [labels(m, "list-001"), labels(m, "list-002"), m.getCard("card-001")!.listId], [["Set up CI pipeline", "Write unit tests"], ["Implement login page", "Review pull requests", "Design wireframes"], "list-002"]);
m.moveCard("card-002", "list-003", 0);
eq("to a position", labels(m, "list-003"), ["Set up CI pipeline", "Create project repo", "Define requirements"]);
m.moveCard("card-003", "list-003", 99);
eq("a position past the end puts it last", labels(m, "list-003").slice(-1), ["Write unit tests"]);
m.moveCard("card-004", "list-002", 2);
eq("within a list it reorders", labels(m, "list-002"), ["Review pull requests", "Design wireframes", "Implement login page"]);
m.moveCard("card-005", "list-002", 0); m.moveCard("card-005", "list-002", 0);
m.moveCard("nope", "list-001"); m.moveCard("card-005", "nope");
eq("moving to the same place again, or an unknown card or list, changes nothing more", [labels(m, "list-002")[0], m.getCardCount()], ["Review pull requests", 7]);

const n = new KanbanStore();
let calls = 0;
const off = n.subscribe(() => { calls++; });
const calls2: number[] = [0];
n.subscribe(() => { calls2[0]++; });
n.addList("a"); n.addCard("list-001", "x"); n.updateCard("card-008", "y"); n.moveCard("card-008", "list-002"); n.renameList("list-001", "z"); n.deleteCard("card-008"); n.deleteList("list-004");
eq("every change notifies, every subscriber", [calls, calls2[0]], [7, 7]);
off(); n.addList("b");
eq("unsubscribe stops it", [calls, calls2[0]], [7, 8]);

const u = new KanbanStore();
eq("card count is the sum over the lists, each card on a real list", [u.getCardCount(), u.getLists().reduce((t, l) => t + l.cardIds.length, 0), u.getLists().every((l) => u.getCardsForList(l.id).every((cd) => cd.listId === l.id))], [7, 7, true]);
u.clear();
eq("clear empties everything", [u.getListCount(), u.getCardCount()], [0, 0]);
u.addList("Fresh"); u.addCard("list-001", "one");
eq("and the ids start again", [u.getLists()[0].id, u.getCardsForList("list-001")[0].id], ["list-001", "card-001"]);
const ids = new Set<string>();
const ids2 = new KanbanStore();
for (let i = 0; i < 20; i++) ids.add(ids2.addCard("list-001", "c")!.id);
eq("sequential ids are unique", ids.size, 20);

const keep = new KanbanStore();
keep.addList("Extra"); keep.addCard("list-004", "Kept"); keep.moveCard("card-001", "list-004", 0); keep.deleteCard("card-007");
const again = new KanbanStore(JSON.parse(JSON.stringify(keep.snapshot())));
eq("a store comes back from its snapshot, with its counters", [again.snapshot(), again.addCard("list-001", "next")!.id], [keep.snapshot(), "card-009"]);
eq("an empty snapshot seeds the sample board", new KanbanStore({ lists: [], cards: [], nextListId: 1, nextCardId: 1 }).getCardCount(), 7);
// expect: ok seeded: three lists, seven cards
// expect: ok To Do has 3 cards, Doing 2, Done 2
// expect: ok the seed cards, in order
// expect: ok addList appends, with the next id
// expect: ok renameList changes the title; an unknown id is ignored
// expect: ok addCard puts a card on the list, returns it; an unknown list gives undefined
// expect: ok updateCard changes the label; an unknown id is ignored
// expect: ok deleteList removes the list and its cards
// expect: ok deleteCard removes the card from its list
// expect: ok getLists hands out copies
// expect: ok so does getCard
// expect: ok an unknown list or card
// expect: ok moving a card to another list puts it last there, and its listId follows
// expect: ok to a position
// expect: ok a position past the end puts it last
// expect: ok within a list it reorders
// expect: ok moving to the same place again, or an unknown card or list, changes nothing more
// expect: ok every change notifies, every subscriber
// expect: ok unsubscribe stops it
// expect: ok card count is the sum over the lists, each card on a real list
// expect: ok clear empties everything
// expect: ok and the ids start again
// expect: ok sequential ids are unique
// expect: ok a store comes back from its snapshot, with its counters
// expect: ok an empty snapshot seeds the sample board
