/**
 * Probability distribution functions for REXX interpreter
 * Inspired by R-lang functions (dnorm, pnorm, qnorm, rnorm, etc.)
 * 
 * Copyright (c) 2025 Paul Hammant
 * Licensed under the MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Helper functions for statistical calculations
const helpers = {
  // Box-Muller transformation for generating normal random variables
  generateNormal: (function() {
    let hasSpare = false;
    let spare;
    
    return function(mean = 0, sd = 1) {
      if (hasSpare) {
        hasSpare = false;
        return spare * sd + mean;
      }
      
      hasSpare = true;
      const u = Math.random();
      const v = Math.random();
      const mag = sd * Math.sqrt(-2.0 * Math.log(u));
      spare = mag * Math.cos(2.0 * Math.PI * v);
      return mag * Math.sin(2.0 * Math.PI * v) + mean;
    };
  })(),
  
  // Error function approximation (Abramowitz and Stegun)
  erf: function(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  },
  
  // Complementary error function
  erfc: function(x) {
    return 1 - this.erf(x);
  },
  
  // Gamma function approximation (Lanczos approximation)
  gamma: function(z) {
    const g = 7;
    const C = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
               771.32342877765313, -176.61502916214059, 12.507343278686905,
               -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * this.gamma(1 - z));
    }
    
    z -= 1;
    let x = C[0];
    for (let i = 1; i < g + 2; i++) {
      x += C[i] / (z + i);
    }
    
    const t = z + g + 0.5;
    const sqrt2pi = Math.sqrt(2 * Math.PI);
    return sqrt2pi * Math.pow(t, (z + 0.5)) * Math.exp(-t) * x;
  },
  
  // Log gamma function
  lgamma: function(x) {
    return Math.log(Math.abs(this.gamma(x)));
  },
  
  // Beta function
  beta: function(a, b) {
    return this.gamma(a) * this.gamma(b) / this.gamma(a + b);
  },
  
  // Incomplete beta function (approximation)
  betaInc: function(x, a, b) {
    if (x === 0 || x === 1) return x;
    if (a === 1 && b === 1) return x;
    
    // Simple approximation - for production use, implement continued fraction
    const bt = Math.exp(this.lgamma(a + b) - this.lgamma(a) - this.lgamma(b) + 
                       a * Math.log(x) + b * Math.log(1 - x));
    
    if (x < (a + 1) / (a + b + 2)) {
      return bt * this.betaCF(x, a, b) / a;
    } else {
      return 1 - bt * this.betaCF(1 - x, b, a) / b;
    }
  },
  
  // Beta continued fraction (simplified)
  betaCF: function(x, a, b) {
    const maxIter = 100;
    const eps = 3e-7;
    
    let am = 1;
    let bm = 1;
    let az = 1;
    let qab = a + b;
    let qap = a + 1;
    let qam = a - 1;
    let bz = 1 - qab * x / qap;
    
    for (let m = 1; m <= maxIter; m++) {
      let em = m;
      let tem = em + em;
      let d = em * (b - m) * x / ((qam + tem) * (a + tem));
      let ap = az + d * am;
      let bp = bz + d * bm;
      d = -(a + em) * (qab + em) * x / ((a + tem) * (qap + tem));
      let app = ap + d * az;
      let bpp = bp + d * bz;
      let aold = az;
      am = ap / bpp;
      bm = bp / bpp;
      az = app / bpp;
      bz = 1;
      if (Math.abs(az - aold) < eps * Math.abs(az)) break;
    }
    return az;
  }
};

const probabilityFunctions = {
  // Normal distribution functions
  'DNORM': (x, mean = 0, sd = 1, log = false) => {
    try {
      const xNum = parseFloat(x);
      const mu = parseFloat(mean) || 0;
      const sigma = parseFloat(sd) || 1;
      const useLog = String(log).toLowerCase() === 'true';
      
      if (sigma <= 0) throw new Error('Standard deviation must be positive');
      
      const z = (xNum - mu) / sigma;
      const logDensity = -0.5 * Math.log(2 * Math.PI) - Math.log(sigma) - 0.5 * z * z;
      
      return useLog ? logDensity : Math.exp(logDensity);
    } catch (e) {
      return NaN;
    }
  },
  
  'PNORM': (q, mean = 0, sd = 1, lowerTail = true) => {
    try {
      const qNum = parseFloat(q);
      const mu = parseFloat(mean) || 0;
      const sigma = parseFloat(sd) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (sigma <= 0) throw new Error('Standard deviation must be positive');
      
      const z = (qNum - mu) / sigma;
      let p = 0.5 * (1 + helpers.erf(z / Math.sqrt(2)));
      
      return lower ? p : 1 - p;
    } catch (e) {
      return NaN;
    }
  },
  
  'QNORM': (p, mean = 0, sd = 1, lowerTail = true) => {
    try {
      const prob = parseFloat(p);
      const mu = parseFloat(mean) || 0;
      const sigma = parseFloat(sd) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (prob < 0 || prob > 1) throw new Error('Probability must be between 0 and 1');
      if (sigma <= 0) throw new Error('Standard deviation must be positive');
      
      let adjustedP = lower ? prob : 1 - prob;
      
      // Rational approximation for inverse normal CDF
      if (adjustedP === 0.5) return mu;
      if (adjustedP === 0) return -Infinity;
      if (adjustedP === 1) return Infinity;
      
      // Using a simpler but accurate approximation (Acklam's algorithm)
      let z;
      if (adjustedP > 0.5) {
        // Upper half
        z = Math.sqrt(-2 * Math.log(1 - adjustedP));
        z = z - (2.30753 + z * 0.27061) / (1 + z * (0.99229 + z * 0.04481));
      } else {
        // Lower half  
        z = Math.sqrt(-2 * Math.log(adjustedP));
        z = -(z - (2.30753 + z * 0.27061) / (1 + z * (0.99229 + z * 0.04481)));
      }
      
      return z * sigma + mu;
    } catch (e) {
      return NaN;
    }
  },
  
  'RNORM': (n = 1, mean = 0, sd = 1) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const mu = parseFloat(mean) || 0;
      const sigma = parseFloat(sd) || 1;
      
      if (sigma <= 0) throw new Error('Standard deviation must be positive');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(helpers.generateNormal(mu, sigma));
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  },
  
  // Uniform distribution functions
  'DUNIF': (x, min = 0, max = 1, log = false) => {
    try {
      const xNum = parseFloat(x);
      const a = parseFloat(min) || 0;
      const b = parseFloat(max) || 1;
      const useLog = String(log).toLowerCase() === 'true';
      
      if (a >= b) throw new Error('max must be greater than min');
      
      const density = (xNum >= a && xNum <= b) ? 1 / (b - a) : 0;
      return useLog ? Math.log(density) : density;
    } catch (e) {
      return NaN;
    }
  },
  
  'PUNIF': (q, min = 0, max = 1, lowerTail = true) => {
    try {
      const qNum = parseFloat(q);
      const a = parseFloat(min) || 0;
      const b = parseFloat(max) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (a >= b) throw new Error('max must be greater than min');
      
      let p;
      if (qNum <= a) p = 0;
      else if (qNum >= b) p = 1;
      else p = (qNum - a) / (b - a);
      
      return lower ? p : 1 - p;
    } catch (e) {
      return NaN;
    }
  },
  
  'QUNIF': (p, min = 0, max = 1, lowerTail = true) => {
    try {
      const prob = parseFloat(p);
      const a = parseFloat(min) || 0;
      const b = parseFloat(max) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (prob < 0 || prob > 1) throw new Error('Probability must be between 0 and 1');
      if (a >= b) throw new Error('max must be greater than min');
      
      const adjustedP = lower ? prob : 1 - prob;
      return a + adjustedP * (b - a);
    } catch (e) {
      return NaN;
    }
  },
  
  'RUNIF': (n = 1, min = 0, max = 1) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const a = parseFloat(min) || 0;
      const b = parseFloat(max) || 1;
      
      if (a >= b) throw new Error('max must be greater than min');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(a + Math.random() * (b - a));
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  },
  
  // Exponential distribution functions
  'DEXP': (x, rate = 1, log = false) => {
    try {
      const xNum = parseFloat(x);
      const lambda = parseFloat(rate) || 1;
      const useLog = String(log).toLowerCase() === 'true';
      
      if (lambda <= 0) throw new Error('Rate must be positive');
      
      const density = xNum >= 0 ? lambda * Math.exp(-lambda * xNum) : 0;
      return useLog ? Math.log(density) : density;
    } catch (e) {
      return NaN;
    }
  },
  
  'PEXP': (q, rate = 1, lowerTail = true) => {
    try {
      const qNum = parseFloat(q);
      const lambda = parseFloat(rate) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (lambda <= 0) throw new Error('Rate must be positive');
      
      const p = qNum >= 0 ? 1 - Math.exp(-lambda * qNum) : 0;
      return lower ? p : 1 - p;
    } catch (e) {
      return NaN;
    }
  },
  
  'QEXP': (p, rate = 1, lowerTail = true) => {
    try {
      const prob = parseFloat(p);
      const lambda = parseFloat(rate) || 1;
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (prob < 0 || prob > 1) throw new Error('Probability must be between 0 and 1');
      if (lambda <= 0) throw new Error('Rate must be positive');
      
      const adjustedP = lower ? prob : 1 - prob;
      if (adjustedP === 0) return 0;
      if (adjustedP === 1) return Infinity;
      
      return -Math.log(1 - adjustedP) / lambda;
    } catch (e) {
      return NaN;
    }
  },
  
  'REXP': (n = 1, rate = 1) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const lambda = parseFloat(rate) || 1;
      
      if (lambda <= 0) throw new Error('Rate must be positive');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(-Math.log(1 - Math.random()) / lambda);
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  },
  
  // Chi-square distribution functions
  'DCHISQ': (x, df, log = false) => {
    try {
      const xNum = parseFloat(x);
      const degrees = parseFloat(df);
      const useLog = String(log).toLowerCase() === 'true';
      
      if (degrees <= 0) throw new Error('Degrees of freedom must be positive');
      
      if (xNum <= 0) return useLog ? -Infinity : 0;
      
      const logDensity = (degrees / 2 - 1) * Math.log(xNum) - xNum / 2 - 
                        helpers.lgamma(degrees / 2) - (degrees / 2) * Math.log(2);
      
      return useLog ? logDensity : Math.exp(logDensity);
    } catch (e) {
      return NaN;
    }
  },
  
  'PCHISQ': (q, df, lowerTail = true) => {
    try {
      const qNum = parseFloat(q);
      const degrees = parseFloat(df);
      const lower = String(lowerTail).toLowerCase() !== 'false';
      
      if (degrees <= 0) throw new Error('Degrees of freedom must be positive');
      
      if (qNum <= 0) return lower ? 0 : 1;
      
      // Incomplete gamma function approximation
      const a = degrees / 2;
      const x = qNum / 2;
      
      // Simple approximation - for production use, implement proper incomplete gamma
      let p;
      if (x === 0) p = 0;
      else if (a === 1) p = 1 - Math.exp(-x);
      else {
        // Rough approximation using gamma function ratio
        p = Math.min(1, Math.pow(x / a, a) * Math.exp(-x + a) / helpers.gamma(a));
      }
      
      return lower ? p : 1 - p;
    } catch (e) {
      return NaN;
    }
  },
  
  'RCHISQ': (n = 1, df) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const degrees = parseFloat(df);
      
      if (degrees <= 0) throw new Error('Degrees of freedom must be positive');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        // Sum of squares of independent standard normals
        let sum = 0;
        for (let j = 0; j < degrees; j++) {
          const norm = helpers.generateNormal(0, 1);
          sum += norm * norm;
        }
        results.push(sum);
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  },
  
  // Binomial distribution functions
  'DBINOM': (x, size, prob, log = false) => {
    try {
      const k = parseInt(x);
      const n = parseInt(size);
      const p = parseFloat(prob);
      const useLog = String(log).toLowerCase() === 'true';
      
      if (n < 0 || k < 0 || k > n) return useLog ? -Infinity : 0;
      if (p < 0 || p > 1) throw new Error('Probability must be between 0 and 1');
      
      // Handle edge cases for p=0 or p=1
      if (p === 0) {
        const result = k === 0 ? 1 : 0;
        return useLog ? Math.log(result) : result;
      }
      if (p === 1) {
        const result = k === n ? 1 : 0;
        return useLog ? Math.log(result) : result;
      }
      
      // Binomial coefficient: choose(n, k) = n! / (k! * (n-k)!)
      const logBinom = helpers.lgamma(n + 1) - helpers.lgamma(k + 1) - helpers.lgamma(n - k + 1);
      const logDensity = logBinom + k * Math.log(p) + (n - k) * Math.log(1 - p);
      
      return useLog ? logDensity : Math.exp(logDensity);
    } catch (e) {
      return NaN;
    }
  },
  
  'RBINOM': (n = 1, size, prob) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const trials = parseInt(size);
      const p = parseFloat(prob);
      
      if (trials < 0) throw new Error('Size must be non-negative');
      if (p < 0 || p > 1) throw new Error('Probability must be between 0 and 1');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        let successes = 0;
        for (let j = 0; j < trials; j++) {
          if (Math.random() < p) successes++;
        }
        results.push(successes);
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  },
  
  // Poisson distribution functions
  'DPOIS': (x, lambda, log = false) => {
    try {
      const k = parseInt(x);
      const rate = parseFloat(lambda);
      const useLog = String(log).toLowerCase() === 'true';
      
      if (k < 0) return useLog ? -Infinity : 0;
      if (rate <= 0) throw new Error('Lambda must be positive');
      
      const logDensity = k * Math.log(rate) - rate - helpers.lgamma(k + 1);
      return useLog ? logDensity : Math.exp(logDensity);
    } catch (e) {
      return NaN;
    }
  },
  
  'RPOIS': (n = 1, lambda) => {
    try {
      const count = Math.max(1, parseInt(n) || 1);
      const rate = parseFloat(lambda);
      
      if (rate <= 0) throw new Error('Lambda must be positive');
      
      const results = [];
      for (let i = 0; i < count; i++) {
        // Knuth algorithm for Poisson random variables
        const L = Math.exp(-rate);
        let k = 0;
        let p = 1;
        
        do {
          k++;
          p *= Math.random();
        } while (p > L);
        
        results.push(k - 1);
      }
      
      return count === 1 ? results[0] : results;
    } catch (e) {
      return NaN;
    }
  }

  //TODO insert more probability distributions here (t, F, gamma, beta, etc.)

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { probabilityFunctions };
} else if (typeof window !== 'undefined') {
  window.probabilityFunctions = probabilityFunctions;
}