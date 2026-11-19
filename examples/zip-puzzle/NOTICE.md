# Notice

`examples/zip-puzzle` is a port of `ported-apps/zip-puzzle` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2026 Paul Hammant. The source files carry no header of their own; Tsyne's README says "Portions copyright Paul Hammant 2026", MIT.

What was adapted: the page is rewritten onto sae's page API (a vg scene for the board); the rules and the five puzzles are Tsyne's, in lib/zip-puzzle.ts, minus its UI callbacks; the board is rebuilt when the level changes size. Tsyne's logic tests (zip-puzzle.logic.test.ts) are carried into lower/tests/mod/ex_zip_puzzle.ts.

The licence the app carried in Tsyne, kept whole:

    MIT License
    
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
