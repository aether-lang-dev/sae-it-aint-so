# Notice

`examples/fractals` is a port of `phone-apps/mandelbrot, julia-set, newton-fractal, tricorn, burning-ship and fractal-utils.ts` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Licence: SPDX-License-Identifier: BSD-3-Clause, Copyright (c) 2025 Paul Hammant, as each of those files' headers state. They carry no licence file of their own, so the text below is the BSD 3-Clause licence file of Paul Hammant's literate-programming app in Tsyne's larger-apps (same author, same year, same licence).

What was adapted: five apps become one with a picker; the escape-time functions and palettes are Tsyne's fractal-utils.ts unchanged (lib/fractal-utils.ts); the start views, iteration limits, Julia presets and view arithmetic (zoom, tap, pan, scroll) are Tsyne's, gathered in lib/views.ts; the image is a vg.raster drawn ten rows a frame so the window answers. The scroll wheel zooms about the centre, since sae reports no pointer position for a scroll. Tsyne's algorithm tests are carried into lower/tests/mod/ex_fractals.ts, its zoom, palette, reset and pan window tests into spec_fractals.

The licence the app carried in Tsyne, kept whole:

    BSD 3-Clause License
    
    Copyright (c) 2025, Paul Hammant
    All rights reserved.
    
    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
    
    1. Redistributions of source code must retain the above copyright notice, this
       list of conditions and the following disclaimer.
    
    2. Redistributions in binary form must reproduce the above copyright notice,
       this list of conditions and the following disclaimer in the documentation
       and/or other materials provided with the distribution.
    
    3. Neither the name of the copyright holder nor the names of its
       contributors may be used to endorse or promote products derived from
       this software without specific prior written permission.
    
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
    AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
    DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
    FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
    DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
    SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
    OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
