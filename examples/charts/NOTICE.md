# Notice

`examples/charts` is a port of `phone-apps/bar-chart, line-chart-demo and heatmap-demo` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the three apps' own sources carry no header of their own).

What was adapted: three demos become three views of one app. The bar values, the heat map's sine field and colour ramp, the line chart's data and its controls (four interpolations, multiple series, Reset Zoom, zoom 50% to 500%) are Tsyne's. Tsyne draws the line chart with its Cosyne library (LinearScale, Axis, GridLines, LineChart, ZoomPan), which is framework code and is not taken: the interpolations here (linear, step, Catmull-Rom, monotone) are written from the standard constructions, the axes use sae:scales, and Zoom In and Zoom Out buttons stand beside the wheel and drag. Tsyne animates from Date.now; here one time state advances in fixed 50 ms steps, so Pause and Restart can hold t=0. The Randomize button, which Tsyne's next frame overwrote, shifts the phases. The formulas are tested headless in lower/tests/mod/ex_charts.ts.

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
