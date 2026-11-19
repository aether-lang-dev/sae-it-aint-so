// examples/everyday's rules, headless: the arithmetic, categories, sets and
// questions of Tsyne's tutorial examples 15, 16, 18, 19, 20 and 21 (Paul
// Hammant, MIT), and the draws made with a generator the test chooses.
import { tipResult, bmiResult, heightImperial, weightLbs, generatePassword, UPPERCASE, LOWERCASE, NUMBERS, SYMBOLS, rollDice, judge, CHOICES, QUESTIONS, finalMessage } from "./examples/everyday/lib/everyday.ts";
import { eq } from "./lib/check.ts";

eq("tip: $50 at 15% is $7.50, total $57.50", tipResult(50, 15, 1), { tip: 7.5, total: 57.5, perPerson: 57.5 });
eq("split between three: $90 at 20% is $36 each", tipResult(90, 20, 3).perPerson, 36);
eq("tip at 10 and 25 percent of 80", [tipResult(80, 10, 1).tip, tipResult(80, 25, 1).tip], [8, 20]);

const r = (h: number, w: number) => { const b = bmiResult(h, w); return [Math.round(b.bmi * 10) / 10, b.category, b.emoji, b.range]; };
eq("BMI at the default 170 cm and 70 kg: 24.2, normal", r(170, 70), [24.2, "Normal weight", "✅", "18.5 ≤ BMI < 25"]);
eq("underweight", r(180, 50), [15.4, "Underweight", "⚠️", "BMI < 18.5"]);
eq("overweight", r(170, 80), [27.7, "Overweight", "⚠️", "25 ≤ BMI < 30"]);
eq("obese", r(160, 100), [39.1, "Obese", "❗", "BMI ≥ 30"]);
eq("the boundaries: 18.5 is normal, 25 is overweight, 30 is obese", [bmiResult(100, 18.5).category, bmiResult(100, 25).category, bmiResult(100, 30).category], ["Normal weight", "Overweight", "Obese"]);
eq("imperial: 170 cm is 5' 7\", 180 is 5' 11\", 70 kg is 154 lbs", [heightImperial(170), heightImperial(180), weightLbs(70)], ["5' 7\"", "5' 11\"", 154]);

const seq = (...vs: number[]) => { let i = 0; return () => vs[i++ % vs.length]; };
eq("a password draws from the sets chosen: lower and numbers, rand 0 then 0.99", generatePassword({ upper: false, lower: true, numbers: true, symbols: false }, 4, seq(0, 0.99, 0, 0.99)), "a9a9");
eq("none chosen: null", generatePassword({ upper: false, lower: false, numbers: false, symbols: false }, 8), null);
eq("sets are Tsyne's", [UPPERCASE.length, LOWERCASE.length, NUMBERS, SYMBOLS], [26, 26, "0123456789", "!@#$%^&*()_+-=[]{}|;:,.<>?"]);
const all = generatePassword({ upper: true, lower: true, numbers: true, symbols: true }, 500)!;
eq("length is as asked, and every character is from a chosen set", [all.length, [...all].every((c) => (UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS).includes(c))], [500, true]);
eq("only numbers: only digits", /^[0-9]{20}$/.test(generatePassword({ upper: false, lower: false, numbers: true, symbols: false }, 20)!), true);

eq("dice: 2d6 with the generator at 0 and 0.99", rollDice(2, 6, seq(0, 0.99)), { results: [1, 6], total: 7, line: "2d6: [1, 6] = 7" });
eq("10d100 stay between 1 and 100", rollDice(10, 100).results.every((n) => n >= 1 && n <= 100), true);
eq("a roll has as many dice as asked", rollDice(8, 20).results.length, 8);

eq("rock paper scissors: every pairing", CHOICES.map((p) => CHOICES.map((c) => judge(p, c))), [["tie", "lose", "win"], ["win", "tie", "lose"], ["lose", "win", "tie"]]);

eq("five questions, each with the right answer in its options", [QUESTIONS.length, QUESTIONS.every((q) => q.correct >= 0 && q.correct < q.options.length)], [5, true]);
eq("the first: HTML", [QUESTIONS[0].question, QUESTIONS[0].options[QUESTIONS[0].correct]], ["What does HTML stand for?", "Hyper Text Markup Language"]);
eq("the right answers", QUESTIONS.map((q) => q.options[q.correct]), ["Hyper Text Markup Language", "JavaScript", "2012", "Central Processing Unit", "Google"]);
eq("final messages by percentage", [5, 4, 3, 2, 1].map((s) => finalMessage(s, 5).message), ["Perfect score!", "Excellent work!", "Good job!", "Not bad, keep practicing!", "Keep learning!"]);
eq("and the percentage", finalMessage(3, 5).percentage, 60);
// expect: ok tip: $50 at 15% is $7.50, total $57.50
// expect: ok split between three: $90 at 20% is $36 each
// expect: ok tip at 10 and 25 percent of 80
// expect: ok BMI at the default 170 cm and 70 kg: 24.2, normal
// expect: ok underweight
// expect: ok overweight
// expect: ok obese
// expect: ok the boundaries: 18.5 is normal, 25 is overweight, 30 is obese
// expect: ok imperial: 170 cm is 5' 7", 180 is 5' 11", 70 kg is 154 lbs
// expect: ok a password draws from the sets chosen: lower and numbers, rand 0 then 0.99
// expect: ok none chosen: null
// expect: ok sets are Tsyne's
// expect: ok length is as asked, and every character is from a chosen set
// expect: ok only numbers: only digits
// expect: ok dice: 2d6 with the generator at 0 and 0.99
// expect: ok 10d100 stay between 1 and 100
// expect: ok a roll has as many dice as asked
// expect: ok rock paper scissors: every pairing
// expect: ok five questions, each with the right answer in its options
// expect: ok the first: HTML
// expect: ok the right answers
// expect: ok final messages by percentage
// expect: ok and the percentage
