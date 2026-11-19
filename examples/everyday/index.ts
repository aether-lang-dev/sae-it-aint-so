// SPDX-License-Identifier: MIT
// Everyday, as a sae app: six of Tsyne's tutorial examples (15 tip calculator,
// 16 password generator, 18 dice roller, 19 BMI calculator, 20 rock paper
// scissors, 21 quiz; MIT, Copyright (c) 2025 Paul Hammant; see NOTICE.md)
// as six views of one app. Each example's rules are in lib/everyday.ts;
// Tsyne's radio groups are rows of buttons here (the chosen one marked).
import {
  tipResult, TIP_PERCENTS, bmiResult, heightImperial, weightLbs, generatePassword,
  DICE_COUNTS, DICE_SIDES, rollDice, CHOICES, EMOJIS, judge, RESULT_TEXT, QUESTIONS, finalMessage,
} from "./lib/everyday.ts";

const { vstack, hstack, text, btn, divider, scroll, textfield, toggle, slider, picker, picker_add, state, bind, set_toggle } = ui;

let holder = 0;
const TABS = ["Tip", "BMI", "Password", "Dice", "RPS", "Quiz"];

// ---------- tip calculator ----------
let bill = 0, tipPercent = 15, people = 1;
const tipLine = state("Tip Amount: $0.00"), totalLine = state("Total: $0.00"), perLine = state("Per Person: $0.00");
const peopleLine = state("1 person");
const calcTip = (): void => {
  const r = tipResult(bill, tipPercent, people);
  tipLine.set(`Tip Amount: $${r.tip.toFixed(2)}`);
  totalLine.set(`Total: $${r.total.toFixed(2)}`);
  perLine.set(`Per Person: $${r.perPerson.toFixed(2)}`);
  peopleLine.set(`${people} ${people === 1 ? "person" : "people"}`);
};
const tipView = (): void => {
  text("Tip Calculator");
  divider();
  text("Bill Amount:");
  textfield("Enter amount", (v: string) => { const n = parseFloat(v); if (!isNaN(n) && n >= 0) { bill = n; calcTip(); } });
  text("Tip Percentage:");
  hstack(4, () => { for (const p of TIP_PERCENTS) btn(`${p}%`, () => { tipPercent = p; calcTip(); }); });
  text("Split Between:");
  hstack(4, () => {
    btn("-", () => { if (people > 1) { people--; calcTip(); } });
    bind(text(""), peopleLine);
    btn("+", () => { people++; calcTip(); });
  });
  divider();
  bind(text(""), tipLine); bind(text(""), totalLine); bind(text(""), perLine);
  btn("Clear", () => { bill = 0; tipPercent = 15; people = 1; calcTip(); });
  calcTip();
};

// ---------- BMI calculator ----------
let heightCm = 170, weightKg = 70, metric = true;
const heightLine = state(""), weightLine = state(""), bmiLine = state("BMI: --"), categoryLine = state("--"), rangeLine = state("");
const calcBmi = (): void => {
  const r = bmiResult(heightCm, weightKg);
  bmiLine.set(`BMI: ${r.bmi.toFixed(1)}`);
  categoryLine.set(`${r.emoji} ${r.category}`);
  rangeLine.set(`(${r.range})`);
  heightLine.set(metric ? `Height: ${heightCm} cm` : `Height: ${heightImperial(heightCm)}`);
  weightLine.set(metric ? `Weight: ${weightKg} kg` : `Weight: ${weightLbs(weightKg)} lbs`);
};
const bmiView = (): void => {
  text("BMI Calculator");
  divider();
  hstack(4, () => {
    btn("Metric", () => { metric = true; calcBmi(); });
    btn("Imperial", () => { metric = false; calcBmi(); });
  });
  bind(text(""), heightLine);
  slider(100, 250, heightCm, (v: number) => { heightCm = Math.round(v); calcBmi(); });
  bind(text(""), weightLine);
  slider(30, 200, weightKg, (v: number) => { weightKg = Math.round(v); calcBmi(); });
  divider();
  bind(text(""), bmiLine); bind(text(""), categoryLine); bind(text(""), rangeLine);
  divider();
  text("BMI Categories:");
  text("• Underweight: < 18.5"); text("• Normal: 18.5 - 24.9"); text("• Overweight: 25 - 29.9"); text("• Obese: ≥ 30");
  text("This is for informational purposes only");
  calcBmi();
};

// ---------- password generator ----------
let pwLength = 12;
const pwOpts = { upper: true, lower: true, numbers: true, symbols: false };
const pwLine = state("Click Generate to create password"), pwLenLine = state("Length: 12 characters");
const passwordView = (): void => {
  text("Password Generator");
  divider();
  text("Generated Password:");
  bind(text(""), pwLine);
  bind(text(""), pwLenLine);
  slider(4, 32, pwLength, (v: number) => { pwLength = Math.round(v); pwLenLine.set(`Length: ${pwLength} characters`); });
  text("Include:");
  const t1 = toggle("Uppercase (A-Z)", (on: number) => { pwOpts.upper = on === 1; });
  const t2 = toggle("Lowercase (a-z)", (on: number) => { pwOpts.lower = on === 1; });
  const t3 = toggle("Numbers (0-9)", (on: number) => { pwOpts.numbers = on === 1; });
  toggle("Symbols (!@#$...)", (on: number) => { pwOpts.symbols = on === 1; });
  set_toggle(t1, pwOpts.upper); set_toggle(t2, pwOpts.lower); set_toggle(t3, pwOpts.numbers);
  btn("Generate Password", () => { pwLine.set(generatePassword(pwOpts, pwLength) ?? "Select at least one character type"); });
  divider();
  text("Password Strength Tips:");
  text("• 8-11 chars: Weak"); text("• 12-15 chars: Good"); text("• 16+ chars: Strong"); text("• Use all character types for best security");
};

// ---------- dice roller ----------
let numDice = 2, numSides = 6;
const diceResult = state("Click Roll to start!"), diceTotal = state("");
let history: string[] = [];
let historyBox = 0;
const diceView = (): void => {
  text("Dice Roller");
  divider();
  text("Number of Dice:");
  const nd = picker((i: number) => { numDice = DICE_COUNTS[i]; });
  for (const n of DICE_COUNTS) picker_add(nd, String(n));
  text("Dice Type:");
  const ns = picker((i: number) => { numSides = DICE_SIDES[i]; });
  for (const s of DICE_SIDES) picker_add(ns, `d${s} (${s}-sided)`);
  btn("ROLL DICE", () => {
    const r = rollDice(numDice, numSides);
    history.unshift(r.line);
    if (history.length > 10) history.pop();
    diceResult.set(`Results: ${r.results.join("  ")}`);
    diceTotal.set(`Total: ${r.total}`);
    ui.clear(historyBox);
    ui.into(historyBox, () => { for (const l of history) text(l); });
  });
  bind(text(""), diceResult); bind(text(""), diceTotal);
  text("Recent Rolls:");
  scroll(() => { historyBox = vstack(2, () => { for (const l of history) text(l); }); });
};

// ---------- rock paper scissors ----------
let playerScore = 0, computerScore = 0, ties = 0;
const youChose = state("Make your choice!"), theyChose = state(""), outcome = state(""), score = state("You: 0 | Computer: 0 | Ties: 0");
const rpsView = (): void => {
  text("Rock Paper Scissors");
  divider();
  text("Choose your weapon:");
  hstack(4, () => {
    for (const c of CHOICES) btn(`${EMOJIS[c]} ${c}`, () => {
      const mine = CHOICES[Math.floor(Math.random() * 3)];
      const r = judge(c, mine);
      if (r === "tie") ties++; else if (r === "win") playerScore++; else computerScore++;
      youChose.set(`You chose: ${EMOJIS[c]} ${c}`);
      theyChose.set(`Computer chose: ${EMOJIS[mine]} ${mine}`);
      outcome.set(RESULT_TEXT[r]);
      score.set(`You: ${playerScore} | Computer: ${computerScore} | Ties: ${ties}`);
    });
  });
  bind(text(""), youChose); bind(text(""), theyChose); bind(text(""), outcome);
  divider();
  bind(text(""), score);
  divider();
  text("Rules:"); text("• Rock beats Scissors"); text("• Scissors beats Paper"); text("• Paper beats Rock");
  btn("Reset Score", () => {
    playerScore = computerScore = ties = 0;
    youChose.set("Make your choice!"); theyChose.set(""); outcome.set("");
    score.set("You: 0 | Computer: 0 | Ties: 0");
  });
};

// ---------- quiz ----------
let qi = 0, qScore = 0, selected = -1;
const chosen = state("");
const quizBody = (): void => {
  ui.clear(holder);
  ui.into(holder, () => {
    const q = QUESTIONS[qi];
    text("Programming Quiz");
    divider();
    text(`Question ${qi + 1} of ${QUESTIONS.length}`);
    text(`Score: ${qScore}/${qi}`);
    divider();
    text(q.question);
    q.options.forEach((o, i) => btn(o, () => { selected = i; chosen.set(`Selected: ${o}`); }));
    bind(text(""), chosen);
    btn("Submit Answer", () => {
      if (selected === -1) return;
      if (selected === q.correct) qScore++;
      quizResult();
    });
  });
};
const quizResult = (): void => {
  const q = QUESTIONS[qi];
  const ok = selected === q.correct;
  ui.clear(holder);
  ui.into(holder, () => {
    text("Programming Quiz");
    divider();
    text(`Question ${qi + 1} of ${QUESTIONS.length}`);
    text(`Score: ${qScore}/${qi + 1}`);
    divider();
    text(q.question);
    if (ok) text("✅ Correct!");
    else { text("❌ Incorrect"); text(`The correct answer was: ${q.options[q.correct]}`); }
    text("Explanation:");
    text(q.explanation);
    if (qi < QUESTIONS.length - 1) btn("Next Question", () => { qi++; selected = -1; chosen.set(""); quizBody(); });
    else btn("See Final Score", quizFinal);
  });
};
const quizFinal = (): void => {
  const f = finalMessage(qScore, QUESTIONS.length);
  ui.clear(holder);
  ui.into(holder, () => {
    text("Quiz Complete!");
    divider();
    text(`${f.emoji} ${f.message}`);
    text(`Final Score: ${qScore}/${QUESTIONS.length}`);
    text(`Percentage: ${f.percentage}%`);
    text(`Correct: ${qScore}`);
    text(`Incorrect: ${QUESTIONS.length - qScore}`);
    btn("Play Again", () => { qi = 0; qScore = 0; selected = -1; chosen.set(""); quizBody(); });
  });
};

const show = (name: string): void => {
  if (name === "Quiz") { qi = 0; qScore = 0; selected = -1; chosen.set(""); quizBody(); return; }
  ui.clear(holder);
  ui.into(holder, () => {
    if (name === "Tip") tipView();
    else if (name === "BMI") bmiView();
    else if (name === "Password") passwordView();
    else if (name === "Dice") diceView();
    else rpsView();
  });
};

hstack(4, () => { for (const name of TABS) btn(name, () => show(name)); });
divider();
holder = vstack(6);
show("Tip");
