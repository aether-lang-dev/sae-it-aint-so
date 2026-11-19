# Notice

`examples/playground` is a port of `phone-apps/bouncing-ball and interactive-shapes` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the two demos' own sources carry no header of their own).

What was adapted: two demos become two views of one app. The three balls and their constants (gravity 0.3, damping 0.95, bounce 0.8, walls 10 px in, a small flick on release), and the three shapes with their places, sizes and five-colour picker, are Tsyne's, in lib/playground.ts as functions with the random numbers as arguments. Tsyne's Cosyne bindings and event handlers are vg shapes with on_click, on_hover, on_drag and on_drag_end; the hover highlight is a ring under the circle (Tsyne's was a passthrough layer over it) and the rectangle has none. Pause, Step and Reset are additions so the physics can be held. The physics is tested headless in lower/tests/mod/ex_playground.ts.

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
