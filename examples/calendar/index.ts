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
// Calendar, as a sae app. Ported from Tsyne's phone-apps/calendar/calendar.ts
// (Copyright (c) 2025 Paul Hammant; see NOTICE.md): a month grid with a dot on
// days that have events, Prev, Next and Today, a New Event button, and the
// events of today and the next seven days with a delete button each. The
// service is Tsyne's (lib/calendar-service.ts). Additions: a title field for a
// new event (Tsyne made one called "New Event"), and a "Go to" field, which is
// the service's goToDate, so a month can be reached by date.
import { MockCalendarService } from "./lib/calendar-service.ts";
import type { CalendarEvent } from "./lib/calendar-service.ts";

const { vstack, hstack, text, btn, divider, spacer, scroll, textfield, get_text, set_text, clear, into, state, bind } = ui;

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const calendar = new MockCalendarService();
let currentMonth = calendar.getCurrentMonth();
const monthText = state("");
const message = state("");
let grid = 0;
let eventsList = 0;
let titleField = 0;
let gotoField = 0;

const renderCalendar = (): void => {
  monthText.set(`${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`);
  clear(grid);
  into(grid, () => {
    hstack(2, () => { for (const d of WEEKDAY_NAMES) text(d); });
    for (const week of currentMonth.weeks) {
      hstack(2, () => {
        for (const day of week) {
          const hasEvents = day.events.length > 0;
          text(day.isCurrentMonth ? `${day.date.getDate()}${hasEvents ? " •" : ""}` : "");
        }
      });
    }
  });
};

const eventRow = (e: CalendarEvent, when: string): void => {
  hstack(4, () => {
    vstack(2, () => { text(e.title); text(when); });
    spacer();
    btn("Delete", () => { calendar.deleteEvent(e.id); refresh(); });
  });
};

const renderEvents = (): void => {
  clear(eventsList);
  into(eventsList, () => {
    const todayEvents = calendar.getTodayEvents();
    const upcoming = calendar.getUpcomingEvents(7).filter((e) => !todayEvents.find((te) => te.id === e.id)).slice(0, 5);
    if (todayEvents.length > 0) {
      text("Today");
      for (const e of todayEvents) eventRow(e, e.allDay ? "All Day" : `${e.startTime} - ${e.endTime}`);
    }
    if (upcoming.length > 0) {
      text("Upcoming (7 days)");
      for (const e of upcoming) eventRow(e, `${SHORT_MONTHS[e.date.getMonth()]} ${e.date.getDate()} - ${e.allDay ? "All Day" : e.startTime}`);
    }
    if (todayEvents.length === 0 && upcoming.length === 0) text("No events scheduled");
  });
};

const refresh = (): void => { renderCalendar(); renderEvents(); };

text("Calendar");
divider();
hstack(4, () => {
  btn("< Prev", () => { currentMonth = calendar.previousMonth(); refresh(); });
  bind(text(""), monthText);
  btn("Next >", () => { currentMonth = calendar.nextMonth(); refresh(); });
});
btn("Today", () => { currentMonth = calendar.goToDate(calendar.getToday()); message.set(""); refresh(); });
hstack(4, () => {
  gotoField = textfield("YYYY-MM-DD");
  btn("Go to", () => {
    const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(get_text(gotoField));
    if (!m) { message.set("Give a date as YYYY-MM-DD"); return; }
    message.set("");
    currentMonth = calendar.goToDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    refresh();
  });
});
bind(text(""), message);
divider();
grid = vstack(2);
divider();
hstack(4, () => {
  titleField = textfield("Event title");
  btn("+ New Event", () => {
    const title = get_text(titleField).trim() || "New Event";
    calendar.addEvent({ title, date: calendar.getToday(), startTime: "10:00", endTime: "11:00", allDay: false, color: "#95E1D3" });
    set_text(titleField, "");
    refresh();
  });
});
divider();
text("Events");
scroll(() => { eventsList = vstack(4); });

refresh();
