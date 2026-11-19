# Notice

`examples/clock` is a port of `phone-apps/clock` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the app's own sources carry no header of their own).

What was adapted: the page is rewritten onto sae's page API (a vg scene whose hands are bound to a time state); the dial's size, the hand lengths and the marker geometry are Tsyne's (clock.ts and clock-shared.ts), in lib/clock.ts; Tsyne's mockable clock service becomes a Set time row (and Live), since a page has only Date; times are formatted by hand, sae's engine having no Intl. Tsyne's own clock tests drive its app with a mocked clock; here the arithmetic is tested headless in lower/tests/mod/ex_clock.ts and the dial through the driver.

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
