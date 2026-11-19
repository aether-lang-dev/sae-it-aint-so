# Notice

`examples/timer` is a port of `phone-apps/timer` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the app's own sources carry no header of their own).

What was adapted: the page is rewritten onto sae's page API; the formatting, geometry and rules are Tsyne's (clock-shared.ts and timer.ts), in lib/timer.ts, gathered into a class that keeps instants, not a per-tick count; Tsyne's notification service becomes a line of output. The headless test (lower/tests/mod/ex_timer.ts) and the spec cover what Tsyne's timer.test.ts does against a mocked clock, using sae's SAE_TIME_SCALE.

The licence the app carried in Tsyne, kept whole:

    MIT License
    
    Copyright (c) 2025 Paul Hammant
    
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
