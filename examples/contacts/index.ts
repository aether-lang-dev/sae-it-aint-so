/*
 * Copyright (c) 2025 Paul Hammant
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 */

// SPDX-License-Identifier: BSD-2-Clause
// Contacts, as a sae app. Ported from Tsyne's phone-apps/contacts/contacts.ts
// (Copyright (c) 2025 Paul Hammant; see NOTICE.md): a searchable list with
// favourites first, a star to toggle each, edit and delete. The service is
// Tsyne's (lib/contacts-service.ts). Tsyne asks for each field with a prompt
// in turn; here one form (name, phone, email, address, notes) serves Add and
// Edit, and the contacts are kept in app storage.
import { MockContactsService } from "./lib/contacts-service.ts";
import type { Contact } from "./lib/contacts-service.ts";

const { vstack, hstack, text, btn, divider, spacer, scroll, textfield, get_text, set_text, clear, into, state, bind, set_visible } = ui;

const load = () => {
  const s = storage.get("contacts");
  if (s === null) return null;
  try { return JSON.parse(s); } catch { return null; }
};
const contacts = new MockContactsService(load());
const save = (): void => storage.set("contacts", JSON.stringify(contacts.snapshot()));
for (const on of [contacts.onContactAdded, contacts.onContactUpdated, contacts.onContactDeleted]) on.call(contacts, () => { save(); update(); });

let searchQuery = "";
let editingId: string | null = null;
let listBox = 0;
const status = state("");
const formTitle = state("");
let fName = 0, fPhone = 0, fEmail = 0, fAddress = 0, fNotes = 0, form = 0;

const row = (c: Contact): void => {
  hstack(4, () => {
    vstack(2, () => {
      hstack(4, () => {
        text(c.name);
        spacer();
        btn(c.isFavorite ? "Unstar" : "Star", () => contacts.updateContact(c.id, { isFavorite: !c.isFavorite }));
      });
      text(c.phone);
      if (c.email) text(c.email);
      if (c.address) text(c.address);
      if (c.notes) text(`Note: ${c.notes}`);
    });
    spacer();
    btn("Edit", () => openForm(c));
    btn("Delete", () => contacts.deleteContact(c.id));
  });
};

function update(): void {
  status.set(`${contacts.getContactCount()} contacts`);
  clear(listBox);
  into(listBox, () => {
    const shown = searchQuery.trim() ? contacts.searchContacts(searchQuery) : contacts.getContacts();
    if (shown.length === 0) { text(searchQuery ? "No contacts found" : "No contacts yet"); return; }
    if (!searchQuery) {
      const favorites = contacts.getFavorites();
      if (favorites.length > 0) {
        text("Favorites");
        for (const c of favorites) row(c);
        divider();
      }
    }
    text(searchQuery ? `Search Results (${shown.length})` : `All Contacts (${shown.length})`);
    for (const c of shown) row(c);
  });
}

function openForm(c: Contact | null): void {
  editingId = c ? c.id : null;
  formTitle.set(c ? "Edit contact" : "New contact");
  set_text(fName, c ? c.name : ""); set_text(fPhone, c ? c.phone : ""); set_text(fEmail, c?.email ?? "");
  set_text(fAddress, c?.address ?? ""); set_text(fNotes, c?.notes ?? "");
  set_visible(form, true);
}

const saveForm = (): void => {
  const name = get_text(fName).trim(), phone = get_text(fPhone).trim();
  if (!name || !phone) { formTitle.set("A name and a phone number are needed"); return; }
  const email = get_text(fEmail).trim() || undefined, address = get_text(fAddress).trim() || undefined, notes = get_text(fNotes).trim() || undefined;
  set_visible(form, false);
  if (editingId) contacts.updateContact(editingId, { name, phone, email, address, notes });
  else contacts.addContact({ name, phone, email, address, notes, isFavorite: false });
  editingId = null;
};

text("Contacts");
divider();
hstack(4, () => {
  textfield("Search contacts...") { ui.onchange((v: string) => { searchQuery = v; update(); }) }
  spacer();
  btn("Add", () => openForm(null));
});
divider();
bind(text(""), status);
form = vstack(4, () => {
  bind(text(""), formTitle);
  fName = textfield("Name");
  fPhone = textfield("Phone");
  fEmail = textfield("Email (optional)");
  fAddress = textfield("Address (optional)");
  fNotes = textfield("Notes (optional)");
  hstack(4, () => {
    btn("Save", saveForm);
    btn("Cancel", () => { editingId = null; set_visible(form, false); });
  });
  divider();
});
set_visible(form, false);
divider();
scroll(() => { listBox = vstack(6); });

update();
