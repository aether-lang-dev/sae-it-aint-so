// examples/contacts' service, headless: the cases of Tsyne's
// phone-apps/contacts/contacts.test.ts (Paul Hammant, BSD-2-Clause terms),
// and the snapshot the page keeps its contacts in.
import { MockContactsService } from "./examples/contacts/lib/contacts-service.ts";
import { eq } from "./lib/check.ts";

const names = (cs: { name: string }[]) => cs.map((c) => c.name);
const s = new MockContactsService();
eq("six sample contacts", [s.getContactCount(), s.getContact("contact-1")!.name, s.getContact("nope")], [6, "Alice Smith", null]);
eq("favourites first, then alphabetical within each group", names(s.getContacts()), ["Alice Smith", "Charlie Brown", "Frank Miller", "Bob Johnson", "Diana Prince", "Eve Wilson"]);
eq("favourites", names(s.getFavorites()), ["Alice Smith", "Charlie Brown", "Frank Miller"]);
eq("search by name, phone and email, in any case", [names(s.searchContacts("ALICE")), names(s.searchContacts("234-5678")), names(s.searchContacts("work.com"))], [["Alice Smith"], ["Bob Johnson"], ["Frank Miller", "Bob Johnson", "Diana Prince"]]);
eq("an empty search gives everyone, a miss nobody", [s.searchContacts("  ").length, s.searchContacts("zzz")], [6, []]);

const t = new MockContactsService();
const added: string[] = [], updated: string[] = [], deleted: string[] = [];
const offAdded = t.onContactAdded((c) => added.push(c.name));
t.onContactUpdated((c) => updated.push(c.name));
t.onContactDeleted((id) => deleted.push(id));
const c = t.addContact({ name: "Grace Hopper", phone: "+1 555", isFavorite: false });
eq("add: an id, dates, the count and a notice", [c.id, c.createdAt.getTime() === c.lastModified.getTime(), t.getContactCount(), added], ["contact-7", true, 7, ["Grace Hopper"]]);
eq("update changes fields and keeps id and creation; an unknown id is false", [t.updateContact(c.id, { phone: "+1 777", email: "g@navy.mil" }), t.getContact(c.id)!.phone, t.getContact(c.id)!.id, t.updateContact("nope", {}), updated], [true, "+1 777", "contact-7", false, ["Grace Hopper"]]);
eq("toggling a favourite", [t.updateContact(c.id, { isFavorite: true }), t.getFavorites().length], [true, 4]);
eq("delete once, with a notice; an unknown id is false", [t.deleteContact(c.id), t.deleteContact(c.id), deleted, t.getContactCount()], [true, false, ["contact-7"], 6]);
offAdded();
t.addContact({ name: "Quiet", phone: "1", isFavorite: false });
eq("an unsubscribed listener hears nothing more", added, ["Grace Hopper"]);

eq("sample creation dates are five days apart, the first five days back", [1, 2, 3].map((i) => Math.round((s.getContact("contact-1")!.lastModified.getTime() - s.getContact(`contact-${i}`)!.createdAt.getTime()) / 86400000)), [5, 10, 15]);

const kept = JSON.parse(JSON.stringify(t.snapshot()));
const again = new MockContactsService(kept);
eq("a service comes back from its snapshot, dates and next id included", [names(again.getContacts()), again.getContact("contact-1")!.createdAt instanceof Date, again.addContact({ name: "Next", phone: "2", isFavorite: false }).id], [names(t.getContacts()), true, "contact-9"]);
// expect: ok six sample contacts
// expect: ok favourites first, then alphabetical within each group
// expect: ok favourites
// expect: ok search by name, phone and email, in any case
// expect: ok an empty search gives everyone, a miss nobody
// expect: ok add: an id, dates, the count and a notice
// expect: ok update changes fields and keeps id and creation; an unknown id is false
// expect: ok toggling a favourite
// expect: ok delete once, with a notice; an unknown id is false
// expect: ok an unsubscribed listener hears nothing more
// expect: ok sample creation dates are five days apart, the first five days back
// expect: ok a service comes back from its snapshot, dates and next id included
