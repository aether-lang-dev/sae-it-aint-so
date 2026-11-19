# Notice

`examples/animations` is a port of `phone-apps/spinner, fractal-tree and particles` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the three apps' own sources carry no header of their own).

What was adapted: three demos become three views of one app. The spinner's segment alpha, the tree's recursion (five levels, 0.7 and 0.8 scaling, 0.4 radian branching, leaves at the tips, three seconds of growth, a slow sway), and the particles' physics and spawn rate are Tsyne's, in lib/animations.ts. Time is an argument, not Date.now(), and steps in fixed 16 ms ticks so Pause, Step and Restart can hold a moment; the particles draw from a seeded generator where Tsyne used Math.random; Tsyne's wedge primitive becomes a path, and 'Click to burst', which Tsyne's demo promised but did not do, adds thirty particles at the click. The logic is tested headless in lower/tests/mod/ex_animations.ts.

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
