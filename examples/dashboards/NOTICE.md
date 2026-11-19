# Notice

`examples/dashboards` is a port of `phone-apps/gauge-dashboard and dial-dashboard` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the two apps' own sources carry no header of their own).

What was adapted: two dashboards become two views of one app. The gauge metrics and their section layout, and the twelve dials' settings and layout, are Tsyne's (lib/dashboards.ts). Tsyne draws gauges and dials with Cosyne primitives (c.gauge, c.dial), which are framework code and are not taken: the arcs, ticks, knobs, four style palettes and the pointer-to-value mapping here are written for sae from the settings alone, with these conventions chosen: gauge angles count counter-clockwise from the right and run from start to end that way (225 to 315 is the arc across the bottom), dial angles count clockwise on screen (135 to 405 is a 270 degree knob with its gap at the bottom). Each metric is a function of a held time t, and the network gauge's random jitter a fixed wobble of t, so Pause and Restart can hold a known dashboard. The geometry and the metrics are tested headless in lower/tests/mod/ex_dashboards.ts.

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
