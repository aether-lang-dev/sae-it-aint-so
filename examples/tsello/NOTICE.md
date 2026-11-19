# Notice

`examples/tsello` is a port of `ported-apps/tsello` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Tsello is itself a port, of cl-trello-clone (https://github.com/rajasegar/cl-trello-clone, Common Lisp, Caveman2 and HTMX) by Rajasegar Chandran. Tsyne's sources say "Portions copyright(c) 2021 Rajasegar Chandran, portions copyright(c) 2026 Paul Hammant, License: MIT", and its LICENSE file names both: Copyright (c) 2021 Rajasegar Chandran and Copyright (c) 2026 Paul Hammant.

What was adapted: the page is rewritten onto sae's page API; lib/store.ts is Tsyne's store with PouchDB removed (the board persists as a snapshot in app storage); cards move with < and > buttons and are dragged within their list, where Tsyne drags a card across lists and shows a ghost under the cursor (sae has no drop targets across containers); Edit, Rename and the add fields are inline, where Tsyne opened forms. Tsyne's store tests (store.test.ts) are carried into lower/tests/mod/ex_tsello.ts and its app tests (tsello.test.ts) into spec_tsello.

The licence the app carried in Tsyne, kept whole:

    MIT License
    
    Copyright (c) 2021 Rajasegar Chandran
    Copyright (c) 2026 Paul Hammant
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
