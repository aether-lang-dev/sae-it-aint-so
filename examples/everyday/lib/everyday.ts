// SPDX-License-Identifier: MIT
// The rules of six of Tsyne's tutorial examples (examples/15-tip-calculator,
// 16-password-generator, 18-dice-roller, 19-bmi-calculator,
// 20-rock-paper-scissors, 21-quiz-app, at ae3b8d44), MIT, Copyright (c) 2025
// Paul Hammant (Tsyne's top-level licence; the examples carry no header of
// their own; see ../NOTICE.md). Each rule is lifted out of the example's
// widget code into a function of its inputs, with the same arithmetic,
// categories, character sets, questions and wording; the random ones take the
// generator they draw from (default: Math.random), so a test can choose.

export type Rand = () => number;

// ---------- tip calculator ----------

export function tipResult(bill: number, tipPercent: number, people: number): { tip: number; total: number; perPerson: number } {
  const tip = bill * (tipPercent / 100);
  const total = bill + tip;
  return { tip, total, perPerson: total / people };
}
export const TIP_PERCENTS = [10, 15, 18, 20, 25];

// ---------- BMI calculator ----------

export function bmiResult(heightCm: number, weightKg: number): { bmi: number; category: string; emoji: string; range: string } {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  if (bmi < 18.5) return { bmi, category: 'Underweight', emoji: '⚠️', range: 'BMI < 18.5' };
  if (bmi < 25) return { bmi, category: 'Normal weight', emoji: '✅', range: '18.5 ≤ BMI < 25' };
  if (bmi < 30) return { bmi, category: 'Overweight', emoji: '⚠️', range: '25 ≤ BMI < 30' };
  return { bmi, category: 'Obese', emoji: '❗', range: 'BMI ≥ 30' };
}
export function heightImperial(heightCm: number): string {
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}' ${inches}"`;
}
export const weightLbs = (weightKg: number): number => Math.round(weightKg * 2.20462);

// ---------- password generator ----------

export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const NUMBERS = '0123456789';
export const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/** A password of `length` from the sets chosen, or null when none is. */
export function generatePassword(o: { upper: boolean; lower: boolean; numbers: boolean; symbols: boolean }, length: number, rand: Rand = Math.random): string | null {
  let chars = '';
  if (o.upper) chars += UPPERCASE;
  if (o.lower) chars += LOWERCASE;
  if (o.numbers) chars += NUMBERS;
  if (o.symbols) chars += SYMBOLS;
  if (chars.length === 0) return null;
  let password = '';
  for (let i = 0; i < length; i++) password += chars[Math.floor(rand() * chars.length)];
  return password;
}

// ---------- dice roller ----------

export const DICE_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10];
export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

export function rollDice(numDice: number, numSides: number, rand: Rand = Math.random): { results: number[]; total: number; line: string } {
  const results: number[] = [];
  for (let i = 0; i < numDice; i++) results.push(Math.floor(rand() * numSides) + 1);
  const total = results.reduce((a, b) => a + b, 0);
  return { results, total, line: `${numDice}d${numSides}: [${results.join(', ')}] = ${total}` };
}

// ---------- rock paper scissors ----------

export const CHOICES = ['Rock', 'Paper', 'Scissors'];
export const EMOJIS: { [k: string]: string } = { 'Rock': '✊', 'Paper': '✋', 'Scissors': '✌️' };

/** 'tie', 'win' (the player's) or 'lose'. */
export function judge(player: string, computer: string): 'tie' | 'win' | 'lose' {
  if (player === computer) return 'tie';
  if ((player === 'Rock' && computer === 'Scissors') || (player === 'Paper' && computer === 'Rock') || (player === 'Scissors' && computer === 'Paper')) return 'win';
  return 'lose';
}
export const RESULT_TEXT = { tie: "🤝 It's a tie!", win: '🎉 You win!', lose: '😞 Computer wins!' };

// ---------- quiz ----------

export interface Question { question: string; options: string[]; correct: number; explanation: string }
export const QUESTIONS: Question[] = [
  {
    question: "What does HTML stand for?",
    options: [
      "Hyper Text Markup Language",
      "High Tech Modern Language",
      "Home Tool Markup Language",
      "Hyperlinks and Text Markup Language"
    ],
    correct: 0,
    explanation: "HTML stands for Hyper Text Markup Language, the standard markup language for web pages."
  },
  {
    question: "Which programming language is known as the 'language of the web'?",
    options: ["Python", "JavaScript", "Java", "C++"],
    correct: 1,
    explanation: "JavaScript is known as the 'language of the web' because it runs in all web browsers."
  },
  {
    question: "What year was TypeScript first released?",
    options: ["2010", "2012", "2014", "2016"],
    correct: 1,
    explanation: "TypeScript was first released by Microsoft in 2012."
  },
  {
    question: "What does CPU stand for?",
    options: [
      "Central Processing Unit",
      "Computer Personal Unit",
      "Central Program Utility",
      "Central Processor Utility"
    ],
    correct: 0,
    explanation: "CPU stands for Central Processing Unit, the main processor in a computer."
  },
  {
    question: "Which company created the Go programming language?",
    options: ["Microsoft", "Apple", "Google", "Amazon"],
    correct: 2,
    explanation: "Go was created at Google by Robert Griesemer, Rob Pike, and Ken Thompson."
  },
];

export function finalMessage(score: number, total: number): { percentage: number; message: string; emoji: string } {
  const percentage = Math.round((score / total) * 100);
  if (percentage === 100) return { percentage, message: 'Perfect score!', emoji: '🏆' };
  if (percentage >= 80) return { percentage, message: 'Excellent work!', emoji: '🌟' };
  if (percentage >= 60) return { percentage, message: 'Good job!', emoji: '👍' };
  if (percentage >= 40) return { percentage, message: 'Not bad, keep practicing!', emoji: '📚' };
  return { percentage, message: 'Keep learning!', emoji: '💪' };
}
