# Notice

`examples/everyday` is a port of `examples/15-tip-calculator, 16-password-generator, 18-dice-roller, 19-bmi-calculator, 20-rock-paper-scissors and 21-quiz-app` in Tsyne (https://github.com/tsyne/tsyne,
commit ae3b8d44), Paul Hammant's TypeScript UI toolkit, to a sae app.

Copyright (c) 2025 Paul Hammant (Tsyne's top-level MIT licence; the examples' own sources carry no header of their own).

What was adapted: six tutorial examples become six views of one app. Each example's rules (the tip arithmetic, the BMI categories and unit conversions, the password character sets, the dice, the choice that beats which, the five questions with their explanations and the final messages) are lifted into lib/everyday.ts as functions of their inputs, with the same wording; the random ones take the generator they draw from. Tsyne's radio groups and select boxes are rows of buttons and pickers. Tsyne's own tests of these examples drive its widgets against the real random generator; here the rules are tested headless with a generator the test chooses (lower/tests/mod/ex_everyday.ts) and spec_everyday drives the views.

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
