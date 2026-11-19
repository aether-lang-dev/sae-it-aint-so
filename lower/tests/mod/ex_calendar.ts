// examples/calendar's service, headless, with the clock held at Thursday
// 19 November 2026: the cases of Tsyne's phone-apps/calendar/calendar.test.ts
// (Paul Hammant, BSD-2-Clause terms), which ran against the real date.
import { MockCalendarService } from "./examples/calendar/lib/calendar-service.ts";
import { eq } from "./lib/check.ts";

const NOW = () => new Date(2026, 10, 19, 13, 0, 0);
const titles = (es: { title: string }[]) => es.map((e) => e.title);
const s = new MockCalendarService(NOW);

eq("today is the held day, at midnight", [s.getToday().getTime() === new Date(2026, 10, 19).getTime(), s.getViewMode()], [true, "month"]);
eq("the sample events of today, by time", titles(s.getTodayEvents()), ["Team Standup", "Lunch Break"]);
eq("upcoming over seven days: today's, tomorrow's and the one a week on", titles(s.getUpcomingEvents(7)), ["Team Standup", "Lunch Break", "Project Review", "Conference"]);
eq("the week's Wednesday was yesterday (Tsyne's offset counts from Sunday), so it is not upcoming", [titles(s.getEventsForDate(new Date(2026, 10, 18))), titles(s.getUpcomingEvents(7)).includes("Client Meeting")], [["Client Meeting"], false]);
eq("November has five of the six sample events (the sixth, the fortnight on, is in December)", titles(s.getEventsByMonth(2026, 10)), ["Client Meeting", "Team Standup", "Lunch Break", "Project Review", "Conference"]);
eq("search is case-insensitive over title, description and location", [titles(s.searchEvents("MEETING")), titles(s.searchEvents("week off")), titles(s.searchEvents("conference room"))], [["Client Meeting"], ["Vacation"], ["Team Standup"]]);

const m = s.getCurrentMonth();
eq("November 2026 is five weeks starting on Sunday 1st, and Monday 30th is in the last", [m.year, m.month, m.weeks.length, m.weeks[0][0].date.getDate(), m.weeks[0][0].isCurrentMonth, m.weeks[4][1].date.getDate()], [2026, 10, 5, 1, true, 30]);
eq("the grid knows today and its events", (() => { const d = m.weeks[2][4]; return [d.date.getDate(), d.isToday, d.events.length]; })(), [19, true, 2]);
const next = s.nextMonth();
eq("next month is December, whose first week starts in November's last days", [next.month, next.year, next.weeks[0][0].date.getDate(), next.weeks[0][0].isCurrentMonth], [11, 2026, 29, false]);
const jan = (() => { s.nextMonth(); return s.getCurrentMonth(); })();
eq("December on, January of the next year", [jan.month, jan.year], [0, 2027]);
eq("previous goes back over the year", [s.previousMonth().month, s.previousMonth().month], [11, 10]);
const june = s.goToDate(new Date(2024, 5, 15));
eq("goToDate", [june.month, june.year], [5, 2024]);
eq("today's button's call returns to the held month", s.goToDate(s.getToday()).month, 10);
s.setViewMode("week");
eq("view mode", s.getViewMode(), "week");

const t = new MockCalendarService(NOW);
const added: string[] = [], updated: string[] = [], deleted: string[] = [];
t.onEventAdded((e) => added.push(e.title)); t.onEventUpdated((e) => updated.push(e.title)); t.onEventDeleted((id) => deleted.push(id));
const ev = t.addEvent({ title: "Test Event", date: t.getToday(), startTime: "15:00", endTime: "16:00", allDay: false, color: "#FF0000" });
eq("an added event is found, today, and announced", [ev.id, titles(t.getTodayEvents()).includes("Test Event"), added], ["event-7", true, ["Test Event"]]);
eq("update changes it and announces; an unknown id is null", [t.updateEvent(ev.id, { title: "Changed" })!.title, updated, t.updateEvent("nope", {})], ["Changed", ["Changed"], null]);
eq("getEvent", [t.getEvent(ev.id)!.title, t.getEvent("nope")], ["Changed", null]);
eq("delete, once, and announces", [t.deleteEvent(ev.id), t.deleteEvent(ev.id), deleted, t.getEvent(ev.id)], [true, false, ["event-7"], null]);
const allday = t.addEvent({ title: "All Day Event", date: t.getToday(), allDay: true, color: "#00FF00" });
eq("all-day events", allday.allDay, true);
const sorted = new MockCalendarService(NOW);
for (const id of ["event-1", "event-2"]) sorted.deleteEvent(id);
sorted.addEvent({ title: "Event 1", date: sorted.getToday(), startTime: "14:00", endTime: "15:00", allDay: false, color: "#FF0000" });
sorted.addEvent({ title: "Event 2", date: sorted.getToday(), startTime: "09:00", endTime: "10:00", allDay: false, color: "#FF0000" });
eq("a day's events are sorted by start time", titles(sorted.getEventsForDate(sorted.getToday())), ["Event 2", "Event 1"]);
const east = new MockCalendarService(() => new Date(2026, 0, 1, 0, 30, 0));
eq("the first of January at half past midnight: today's events are today's (the UTC-date bug is gone)", titles(east.getTodayEvents()), ["Team Standup", "Lunch Break"]);
// expect: ok today is the held day, at midnight
// expect: ok the sample events of today, by time
// expect: ok upcoming over seven days: today's, tomorrow's and the one a week on
// expect: ok the week's Wednesday was yesterday (Tsyne's offset counts from Sunday), so it is not upcoming
// expect: ok November has five of the six sample events (the sixth, the fortnight on, is in December)
// expect: ok search is case-insensitive over title, description and location
// expect: ok November 2026 is five weeks starting on Sunday 1st, and Monday 30th is in the last
// expect: ok the grid knows today and its events
// expect: ok next month is December, whose first week starts in November's last days
// expect: ok December on, January of the next year
// expect: ok previous goes back over the year
// expect: ok goToDate
// expect: ok today's button's call returns to the held month
// expect: ok view mode
// expect: ok an added event is found, today, and announced
// expect: ok update changes it and announces; an unknown id is null
// expect: ok getEvent
// expect: ok delete, once, and announces
// expect: ok all-day events
// expect: ok a day's events are sorted by start time
// expect: ok the first of January at half past midnight: today's events are today's (the UTC-date bug is gone)
