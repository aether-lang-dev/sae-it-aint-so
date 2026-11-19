// SPDX-License-Identifier: MIT
// Tsello's kanban store, from Tsyne's ported-apps/tsello/store.ts (at
// ae3b8d44), itself ported from cl-trello-clone by Rajasegar Chandran.
// Portions copyright (c) 2021 Rajasegar Chandran, copyright (c) 2026 Paul
// Hammant, MIT (see ../NOTICE.md). Changes: PouchDB is gone. The store is an
// in-memory model as before; `snapshot()` is its state as plain data for the
// page to keep in app storage, and the constructor takes one back, where
// Tsyne wrote each change to its own documents. The lists, cards, ids, seed
// data, cascade on deleting a list and moveCard's clamped position are as
// they were.

export interface KanbanCard {
  id: string;
  label: string;
  listId: string;
}

export interface KanbanList {
  id: string;
  title: string;
  cardIds: string[];
}

export interface Snapshot {
  lists: KanbanList[];
  cards: KanbanCard[];
  nextListId: number;
  nextCardId: number;
}

type ChangeListener = () => void;

export class KanbanStore {
  private lists: KanbanList[] = [];
  private cards: Map<string, KanbanCard> = new Map();
  private nextListId = 1;
  private nextCardId = 1;
  private changeListeners: ChangeListener[] = [];

  /** From a snapshot, or seeded with Tsello's sample board when there is none. */
  constructor(snapshot?: Snapshot | null) {
    if (snapshot && snapshot.lists.length > 0) {
      this.lists = snapshot.lists.map((l) => ({ ...l, cardIds: [...l.cardIds] }));
      for (const c of snapshot.cards) this.cards.set(c.id, { ...c });
      this.nextListId = snapshot.nextListId;
      this.nextCardId = snapshot.nextCardId;
    } else {
      this.seed();
    }
  }

  snapshot(): Snapshot {
    return {
      lists: this.getLists(),
      cards: [...this.cards.values()].map((c) => ({ ...c })),
      nextListId: this.nextListId,
      nextCardId: this.nextCardId,
    };
  }

  // ========== Observable ==========
  subscribe(listener: ChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange() {
    this.changeListeners.forEach((listener) => listener());
  }

  // ========== Seed Data ==========

  private seed(): void {
    const todoId = this.generateListId();
    const doingId = this.generateListId();
    const doneId = this.generateListId();

    this.lists = [
      { id: todoId, title: 'To Do', cardIds: [] },
      { id: doingId, title: 'Doing', cardIds: [] },
      { id: doneId, title: 'Done', cardIds: [] },
    ];

    const seedCards = [
      { label: 'Design wireframes', listId: todoId },
      { label: 'Set up CI pipeline', listId: todoId },
      { label: 'Write unit tests', listId: todoId },
      { label: 'Implement login page', listId: doingId },
      { label: 'Review pull requests', listId: doingId },
      { label: 'Create project repo', listId: doneId },
      { label: 'Define requirements', listId: doneId },
    ];

    for (const { label, listId } of seedCards) {
      const cardId = this.generateCardId();
      this.cards.set(cardId, { id: cardId, label, listId });
      this.lists.find((l) => l.id === listId)!.cardIds.push(cardId);
    }
  }

  private generateListId(): string {
    return `list-${String(this.nextListId++).padStart(3, '0')}`;
  }

  private generateCardId(): string {
    return `card-${String(this.nextCardId++).padStart(3, '0')}`;
  }

  // ========== List CRUD ==========

  addList(title: string): KanbanList {
    const id = this.generateListId();
    const list: KanbanList = { id, title, cardIds: [] };
    this.lists.push(list);
    this.notifyChange();
    return { ...list, cardIds: [...list.cardIds] };
  }

  renameList(listId: string, newTitle: string): void {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return;
    list.title = newTitle;
    this.notifyChange();
  }

  deleteList(listId: string): void {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return;
    // Cascade: remove all cards in this list
    for (const cardId of list.cardIds) this.cards.delete(cardId);
    this.lists = this.lists.filter((l) => l.id !== listId);
    this.notifyChange();
  }

  getLists(): KanbanList[] {
    return this.lists.map((l) => ({ ...l, cardIds: [...l.cardIds] }));
  }

  getListById(listId: string): KanbanList | undefined {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return undefined;
    return { ...list, cardIds: [...list.cardIds] };
  }

  // ========== Card CRUD ==========

  addCard(listId: string, label: string): KanbanCard | undefined {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return undefined;
    const id = this.generateCardId();
    const card: KanbanCard = { id, label, listId };
    this.cards.set(id, card);
    list.cardIds.push(id);
    this.notifyChange();
    return { ...card };
  }

  updateCard(cardId: string, newLabel: string): void {
    const card = this.cards.get(cardId);
    if (!card) return;
    card.label = newLabel;
    this.notifyChange();
  }

  deleteCard(cardId: string): void {
    const card = this.cards.get(cardId);
    if (!card) return;
    const list = this.lists.find((l) => l.id === card.listId);
    if (list) {
      list.cardIds = list.cardIds.filter((id) => id !== cardId);
    }
    this.cards.delete(cardId);
    this.notifyChange();
  }

  getCard(cardId: string): KanbanCard | undefined {
    const card = this.cards.get(cardId);
    if (!card) return undefined;
    return { ...card };
  }

  getCardsForList(listId: string): KanbanCard[] {
    const list = this.lists.find((l) => l.id === listId);
    if (!list) return [];
    return list.cardIds
      .map((id) => this.cards.get(id))
      .filter((c): c is KanbanCard => c !== undefined)
      .map((c) => ({ ...c }));
  }

  // ========== Move ==========

  moveCard(cardId: string, toListId: string, position?: number): void {
    const card = this.cards.get(cardId);
    if (!card) return;
    const toList = this.lists.find((l) => l.id === toListId);
    if (!toList) return;

    const fromListId = card.listId;

    // Remove from source list
    const fromList = this.lists.find((l) => l.id === fromListId);
    if (fromList) {
      fromList.cardIds = fromList.cardIds.filter((id) => id !== cardId);
    }

    // Insert into target list
    const insertAt = position !== undefined
      ? Math.max(0, Math.min(position, toList.cardIds.length))
      : toList.cardIds.length;
    toList.cardIds.splice(insertAt, 0, cardId);

    // Update card's listId
    card.listId = toListId;

    this.notifyChange();
  }

  // ========== Analytics ==========

  getListCount(): number {
    return this.lists.length;
  }

  getCardCount(): number {
    return this.cards.size;
  }

  // ========== Clear ==========

  clear(): void {
    this.lists = [];
    this.cards.clear();
    this.nextListId = 1;
    this.nextCardId = 1;
    this.notifyChange();
  }
}
