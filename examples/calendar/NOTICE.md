# Notice

`examples/calendar` is a port of `phone-apps/calendar` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant, under the licence at the top of calendar.ts and calendar-service.ts, whose two conditions and disclaimer are those of the BSD 2-Clause licence (the files do not name it; the text below is theirs, kept whole). Both files carry it, and so do the ported ones here.

What was adapted: the page is rewritten onto sae's page API; lib/calendar-service.ts is Tsyne's service with three changes: an event's startTime and endTime are optional and an all-day event sorts before the timed ones on its day (Tsyne's types required times its own seed all-day events lack, and its sort threw on them); it takes the clock it reads today from, so tests can hold the date, and its dateToString uses the local date where Tsyne's toISOString gave the previous day for a local midnight east of Greenwich. The page adds a title field for a new event (Tsyne made one called New Event) and a Go to date field (the service's goToDate), and formats dates itself, there being no Intl. Tsyne's service tests (calendar.test.ts) are carried into lower/tests/mod/ex_calendar.ts with the date held at 19 November 2026, and its app tests into spec_calendar.

The licence text the files carried (a header comment), kept whole:

    Copyright (c) 2025 Paul Hammant
    All rights reserved.
    
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:
    1. Redistributions of source code must retain the above copyright
       notice, this list of conditions and the following disclaimer.
    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in the
       documentation and/or other materials provided with the distribution.
    
    THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
    ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
    ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
    FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
    DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
    OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
    HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
    OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.
    
