/**
 * Statistical analysis functions for REXX interpreter
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

const statisticsFunctions = {
  'AVERAGE': (...values) => {
    try {
      const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n));
      return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    } catch (e) {
      return 0;
    }
  },
  
  'MEDIAN': (...values) => {
    try {
      const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return 0;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
    } catch (e) {
      return 0;
    }
  },
  
  'MODE': (...values) => {
    try {
      const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n));
      const counts = {};
      let maxCount = 0;
      let mode = 0;
      
      nums.forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
        if (counts[num] > maxCount) {
          maxCount = counts[num];
          mode = num;
        }
      });
      
      return mode;
    } catch (e) {
      return 0;
    }
  },
  
  'STDEV': (...values) => {
    try {
      const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (nums.length < 2) return 0;
      
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / (nums.length - 1);
      return Math.sqrt(variance);
    } catch (e) {
      return 0;
    }
  },
  
  'VAR': (...values) => {
    try {
      const nums = values.flat().map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (nums.length < 2) return 0;
      
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return nums.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / (nums.length - 1);
    } catch (e) {
      return 0;
    }
  },
  
  'PERCENTILE': (array, percentile) => {
    try {
      const nums = (Array.isArray(array) ? array : [array]).map(v => parseFloat(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length === 0) return 0;
      
      const p = parseFloat(percentile);
      if (p < 0 || p > 1) return 0;
      
      const index = p * (nums.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      
      if (lower === upper) return nums[lower];
      return nums[lower] + (nums[upper] - nums[lower]) * (index - lower);
    } catch (e) {
      return 0;
    }
  },

  // Dictionary Return Functions for Enhanced Analytics

  'SUMMARY': (data) => {
    try {
      let nums;
      
      // Handle various input formats
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          nums = Array.isArray(parsed) ? parsed.map(v => parseFloat(v)).filter(n => !isNaN(n)) : [parseFloat(parsed)].filter(n => !isNaN(n));
        } catch (e) {
          nums = [parseFloat(data)].filter(n => !isNaN(n));
        }
      } else if (Array.isArray(data)) {
        nums = data.map(v => parseFloat(v)).filter(n => !isNaN(n));
      } else {
        nums = [parseFloat(data)].filter(n => !isNaN(n));
      }
      
      if (nums.length === 0) {
        return {
          count: 0,
          sum: 0,
          mean: 0,
          median: 0,
          mode: 0,
          min: 0,
          max: 0,
          range: 0,
          variance: 0,
          standardDeviation: 0,
          q1: 0,
          q3: 0,
          iqr: 0
        };
      }
      
      const sorted = [...nums].sort((a, b) => a - b);
      const count = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / count;
      
      // Median
      const mid = Math.floor(count / 2);
      const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      
      // Mode
      const counts = {};
      let maxCount = 0;
      let mode = sorted[0];
      nums.forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
        if (counts[num] > maxCount) {
          maxCount = counts[num];
          mode = num;
        }
      });
      
      // Min, Max, Range
      const min = sorted[0];
      const max = sorted[count - 1];
      const range = max - min;
      
      // Variance and Standard Deviation
      const variance = count > 1 ? nums.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / (count - 1) : 0;
      const standardDeviation = Math.sqrt(variance);
      
      // Quartiles
      const q1Index = Math.floor(count * 0.25);
      const q3Index = Math.floor(count * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      
      return {
        count,
        sum,
        mean,
        median,
        mode,
        min,
        max,
        range,
        variance,
        standardDeviation,
        q1,
        q3,
        iqr
      };
    } catch (e) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        mode: 0,
        min: 0,
        max: 0,
        range: 0,
        variance: 0,
        standardDeviation: 0,
        q1: 0,
        q3: 0,
        iqr: 0
      };
    }
  },

  'CORRELATION_MATRIX': (dataArrays) => {
    try {
      let arrays;
      
      // Handle input format - expect array of arrays or JSON string
      if (typeof dataArrays === 'string') {
        arrays = JSON.parse(dataArrays);
      } else {
        arrays = dataArrays;
      }
      
      if (!Array.isArray(arrays) || arrays.length === 0) {
        return {};
      }
      
      // Convert all arrays to numeric
      const numericArrays = arrays.map(arr => 
        Array.isArray(arr) ? arr.map(v => parseFloat(v)).filter(n => !isNaN(n)) : []
      ).filter(arr => arr.length > 0);
      
      if (numericArrays.length < 2) {
        return {};
      }
      
      const correlations = {};
      
      // Calculate pairwise correlations
      for (let i = 0; i < numericArrays.length; i++) {
        for (let j = 0; j < numericArrays.length; j++) {
          const key = `${i}_${j}`;
          
          if (i === j) {
            correlations[key] = 1.0; // Perfect correlation with self
            continue;
          }
          
          const arr1 = numericArrays[i];
          const arr2 = numericArrays[j];
          const minLength = Math.min(arr1.length, arr2.length);
          
          if (minLength < 2) {
            correlations[key] = 0;
            continue;
          }
          
          // Take equal length samples
          const x = arr1.slice(0, minLength);
          const y = arr2.slice(0, minLength);
          
          // Calculate Pearson correlation coefficient
          const meanX = x.reduce((a, b) => a + b, 0) / minLength;
          const meanY = y.reduce((a, b) => a + b, 0) / minLength;
          
          let numerator = 0;
          let sumXSquared = 0;
          let sumYSquared = 0;
          
          for (let k = 0; k < minLength; k++) {
            const dx = x[k] - meanX;
            const dy = y[k] - meanY;
            numerator += dx * dy;
            sumXSquared += dx * dx;
            sumYSquared += dy * dy;
          }
          
          const denominator = Math.sqrt(sumXSquared * sumYSquared);
          correlations[key] = denominator === 0 ? 0 : numerator / denominator;
        }
      }
      
      return correlations;
    } catch (e) {
      return {};
    }
  },

  'REGRESSION': (xValues, yValues, type = 'linear') => {
    try {
      let xArr, yArr;
      
      // Handle input formats
      if (typeof xValues === 'string') {
        try {
          xArr = JSON.parse(xValues).map(v => parseFloat(v)).filter(n => !isNaN(n));
        } catch (e) {
          xArr = [parseFloat(xValues)].filter(n => !isNaN(n));
        }
      } else if (Array.isArray(xValues)) {
        xArr = xValues.map(v => parseFloat(v)).filter(n => !isNaN(n));
      } else {
        xArr = [parseFloat(xValues)].filter(n => !isNaN(n));
      }
      
      if (typeof yValues === 'string') {
        try {
          yArr = JSON.parse(yValues).map(v => parseFloat(v)).filter(n => !isNaN(n));
        } catch (e) {
          yArr = [parseFloat(yValues)].filter(n => !isNaN(n));
        }
      } else if (Array.isArray(yValues)) {
        yArr = yValues.map(v => parseFloat(v)).filter(n => !isNaN(n));
      } else {
        yArr = [parseFloat(yValues)].filter(n => !isNaN(n));
      }
      
      const n = Math.min(xArr.length, yArr.length);
      if (n < 2) {
        return {
          type: 'linear',
          slope: 0,
          intercept: 0,
          correlation: 0,
          rSquared: 0,
          equation: 'y = 0',
          predictions: []
        };
      }
      
      // Take equal length samples
      const x = xArr.slice(0, n);
      const y = yArr.slice(0, n);
      
      if (type === 'linear' || !type) {
        // Linear regression y = mx + b
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const meanX = sumX / n;
        const meanY = sumY / n;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = meanY - slope * meanX;
        
        // Calculate correlation coefficient and R-squared
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        const correlation = denominator === 0 ? 0 : numerator / denominator;
        const rSquared = correlation * correlation;
        
        // Generate predictions for the input x values
        const predictions = x.map(xi => slope * xi + intercept);
        
        const equation = `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`;
        
        return {
          type: 'linear',
          slope,
          intercept,
          correlation,
          rSquared,
          equation,
          predictions
        };
      } else if (type === 'polynomial') {
        // Simple quadratic regression y = ax² + bx + c (degree 2)
        // Using least squares method for quadratic fit
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumX3 = x.reduce((sum, xi) => sum + xi * xi * xi, 0);
        const sumX4 = x.reduce((sum, xi) => sum + xi * xi * xi * xi, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2Y = x.reduce((sum, xi, i) => sum + xi * xi * y[i], 0);
        
        // Solve the system of equations for quadratic fit
        try {
          // Matrix form: [X][coeffs] = [Y]
          const matrix = [
            [n, sumX, sumX2],
            [sumX, sumX2, sumX3],
            [sumX2, sumX3, sumX4]
          ];
          const vector = [sumY, sumXY, sumX2Y];
          
          // Simple 3x3 matrix inversion and solution
          const det = matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                      matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                      matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
          
          if (Math.abs(det) < 1e-10) {
            // Fall back to linear if matrix is singular
            return statisticsFunctions['REGRESSION'](xValues, yValues, 'linear');
          }
          
          // Coefficients for y = c + bx + ax²
          const c = (vector[0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
                     matrix[0][1] * (vector[1] * matrix[2][2] - matrix[1][2] * vector[2]) +
                     matrix[0][2] * (vector[1] * matrix[2][1] - matrix[1][1] * vector[2])) / det;
          
          const b = (matrix[0][0] * (vector[1] * matrix[2][2] - matrix[1][2] * vector[2]) -
                     vector[0] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
                     matrix[0][2] * (matrix[1][0] * vector[2] - vector[1] * matrix[2][0])) / det;
          
          const a = (matrix[0][0] * (matrix[1][1] * vector[2] - vector[1] * matrix[2][1]) -
                     matrix[0][1] * (matrix[1][0] * vector[2] - vector[1] * matrix[2][0]) +
                     vector[0] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])) / det;
          
          const predictions = x.map(xi => a * xi * xi + b * xi + c);
          
          // Calculate R-squared for polynomial
          const meanY = sumY / n;
          const totalSumSquares = y.reduce((sum, yi) => sum + (yi - meanY) * (yi - meanY), 0);
          const residualSumSquares = y.reduce((sum, yi, i) => {
            const predicted = predictions[i];
            return sum + (yi - predicted) * (yi - predicted);
          }, 0);
          const rSquared = totalSumSquares === 0 ? 0 : 1 - (residualSumSquares / totalSumSquares);
          
          const equation = `y = ${a.toFixed(4)}x² + ${b.toFixed(4)}x + ${c.toFixed(4)}`;
          
          return {
            type: 'polynomial',
            coefficients: [c, b, a], // [constant, linear, quadratic]
            rSquared,
            equation,
            predictions
          };
        } catch (e) {
          // Fall back to linear if polynomial regression fails
          return statisticsFunctions['REGRESSION'](xValues, yValues, 'linear');
        }
      }
    } catch (e) {
      return {
        type: 'linear',
        slope: 0,
        intercept: 0,
        correlation: 0,
        rSquared: 0,
        equation: 'y = 0',
        predictions: []
      };
    }
  },

  'FORECAST': (historicalData, periods = 1, method = 'linear') => {
    try {
      let data;
      
      // Handle input format
      if (typeof historicalData === 'string') {
        try {
          data = JSON.parse(historicalData).map(v => parseFloat(v)).filter(n => !isNaN(n));
        } catch (e) {
          data = [parseFloat(historicalData)].filter(n => !isNaN(n));
        }
      } else if (Array.isArray(historicalData)) {
        data = historicalData.map(v => parseFloat(v)).filter(n => !isNaN(n));
      } else {
        data = [parseFloat(historicalData)].filter(n => !isNaN(n));
      }
      
      if (data.length === 0) {
        return {
          method: method,
          forecasts: [],
          confidence: 0,
          trend: 'none'
        };
      }
      
      const periodsToForecast = parseInt(periods) || 1;
      
      if (method === 'mean' || data.length < 3) {
        // Simple mean-based forecast
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const forecasts = Array(periodsToForecast).fill(mean);
        
        return {
          method: 'mean',
          forecasts,
          confidence: 0.5,
          trend: 'none'
        };
      } else if (method === 'linear' || method === 'trend') {
        // Linear trend forecast using regression
        const xValues = data.map((_, i) => i + 1); // 1, 2, 3, ...
        const regression = statisticsFunctions['REGRESSION'](xValues, data, 'linear');
        
        const forecasts = [];
        const lastX = data.length;
        for (let i = 1; i <= periodsToForecast; i++) {
          const nextX = lastX + i;
          const forecast = regression.slope * nextX + regression.intercept;
          forecasts.push(forecast);
        }
        
        // Determine trend direction
        let trend = 'none';
        if (regression.slope > 0.01) trend = 'increasing';
        else if (regression.slope < -0.01) trend = 'decreasing';
        
        return {
          method: 'linear',
          forecasts,
          confidence: regression.rSquared,
          trend,
          slope: regression.slope,
          intercept: regression.intercept
        };
      } else if (method === 'exponential') {
        // Simple exponential smoothing
        const alpha = 0.3; // smoothing parameter
        let smoothed = data[0];
        
        // Calculate exponentially smoothed values
        for (let i = 1; i < data.length; i++) {
          smoothed = alpha * data[i] + (1 - alpha) * smoothed;
        }
        
        // Forecast using last smoothed value
        const forecasts = Array(periodsToForecast).fill(smoothed);
        
        return {
          method: 'exponential',
          forecasts,
          confidence: 0.6,
          trend: 'smoothed'
        };
      } else if (method === 'moving_average') {
        // Moving average forecast
        const windowSize = Math.min(3, data.length);
        const lastValues = data.slice(-windowSize);
        const movingAverage = lastValues.reduce((a, b) => a + b, 0) / lastValues.length;
        
        const forecasts = Array(periodsToForecast).fill(movingAverage);
        
        return {
          method: 'moving_average',
          forecasts,
          confidence: 0.5,
          trend: 'averaged',
          windowSize
        };
      }
      
      // Default to linear if method not recognized
      return statisticsFunctions['FORECAST'](historicalData, periods, 'linear');
    } catch (e) {
      return {
        method: method,
        forecasts: [],
        confidence: 0,
        trend: 'none'
      };
    }
  },

  //TODO insert more statistical functions here

};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { statisticsFunctions };
} else if (typeof window !== 'undefined') {
  window.statisticsFunctions = statisticsFunctions;
}