# Notice

`examples/contacts` is a port of `phone-apps/contacts` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant, under the licence at the top of contacts.ts and contacts-service.ts, whose two conditions and disclaimer are those of the BSD 2-Clause licence (the files do not name it; the text below is theirs, kept whole, and the ported sources carry it too).

What was adapted: the page is rewritten onto sae's page API; lib/contacts-service.ts is Tsyne's service without its log lines, with the sample contacts' creation dates a fixed five days apart (they were random) and a snapshot the page keeps in app storage, which Tsyne's mock did not. Tsyne asks for each field with a prompt in turn; one form (name, phone, email, address, notes) serves Add and Edit. Tsyne's service tests (contacts.test.ts) are carried into lower/tests/mod/ex_contacts.ts and its app tests into spec_contacts.

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
    
