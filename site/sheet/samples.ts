// The example app's sample sheets (RexxJS/example-app-spreadsheet, test-sheet.json,
// sample-budget.json and example-formatted.json), as a module: the page server serves pages and modules,
// not .json.
export const TEST_SHEET = {
  "name": "Test Sheet",
  "version": "1.0",
  "setupScript": "-- Simple test spreadsheet for development\n-- No special setup needed",
  "cells": {
    "A1": {
      "value": "10",
      "expression": null,
      "format": null,
      "comment": "Plain number"
    },
    "A2": {
      "value": "20",
      "expression": null,
      "format": null,
      "comment": "Another number"
    },
    "A3": {
      "value": "30",
      "expression": null,
      "format": null,
      "comment": "Yet another number"
    },
    "A4": {
      "value": "30",
      "expression": "A1 + A2",
      "format": null,
      "comment": "Sum of A1 and A2"
    },
    "A5": {
      "value": "60",
      "expression": "SUM_RANGE(\"A1:A3\")",
      "format": null,
      "comment": "Sum of range A1 to A3"
    },
    "B1": {
      "value": "Hello",
      "expression": null,
      "format": null,
      "comment": "Text value"
    },
    "B2": {
      "value": "HELLO",
      "expression": "UPPER(B1)",
      "format": null,
      "comment": "Uppercase conversion"
    },
    "C1": {
      "value": "5",
      "expression": null,
      "format": null,
      "comment": null
    },
    "C2": {
      "value": "3",
      "expression": null,
      "format": null,
      "comment": null
    },
    "C3": {
      "value": "15",
      "expression": "C1 * C2",
      "format": null,
      "comment": "Multiplication"
    }
  },
  "metadata": {
    "rows": 100,
    "cols": 26,
    "created": "2025-11-05T18:00:00.000Z",
    "modified": "2025-11-05T18:00:00.000Z"
  }
};
export const SAMPLE_BUDGET = {
  "name": "Sample Budget",
  "version": "1.0",
  "setupScript": "-- Budget spreadsheet setup\nLET TAX_RATE = 0.08",
  "cells": {
    "A1": {
      "value": "Item",
      "expression": null,
      "format": null,
      "comment": "Item name"
    },
    "B1": {
      "value": "Price",
      "expression": null,
      "format": null,
      "comment": "Price before tax"
    },
    "C1": {
      "value": "Tax",
      "expression": null,
      "format": null,
      "comment": "Calculated tax"
    },
    "D1": {
      "value": "Total",
      "expression": null,
      "format": null,
      "comment": "Total with tax"
    },
    "A2": {
      "value": "Laptop",
      "expression": null,
      "format": null,
      "comment": null
    },
    "B2": {
      "value": "1200",
      "expression": null,
      "format": null,
      "comment": null
    },
    "C2": {
      "value": "96",
      "expression": "B2 * TAX_RATE",
      "format": null,
      "comment": null
    },
    "D2": {
      "value": "1296",
      "expression": "B2 + C2",
      "format": null,
      "comment": null
    },
    "A3": {
      "value": "Mouse",
      "expression": null,
      "format": null,
      "comment": null
    },
    "B3": {
      "value": "25",
      "expression": null,
      "format": null,
      "comment": null
    },
    "C3": {
      "value": "2",
      "expression": "B3 * TAX_RATE",
      "format": null,
      "comment": null
    },
    "D3": {
      "value": "27",
      "expression": "B3 + C3",
      "format": null,
      "comment": null
    },
    "A4": {
      "value": "Keyboard",
      "expression": null,
      "format": null,
      "comment": null
    },
    "B4": {
      "value": "75",
      "expression": null,
      "format": null,
      "comment": null
    },
    "C4": {
      "value": "6",
      "expression": "B4 * TAX_RATE",
      "format": null,
      "comment": null
    },
    "D4": {
      "value": "81",
      "expression": "B4 + C4",
      "format": null,
      "comment": null
    },
    "A6": {
      "value": "TOTAL",
      "expression": null,
      "format": null,
      "comment": null
    },
    "B6": {
      "value": "1300",
      "expression": "SUM_RANGE(\"B2:B4\")",
      "format": null,
      "comment": null
    },
    "C6": {
      "value": "104",
      "expression": "SUM_RANGE(\"C2:C4\")",
      "format": null,
      "comment": null
    },
    "D6": {
      "value": "1404",
      "expression": "SUM_RANGE(\"D2:D4\")",
      "format": null,
      "comment": null
    }
  },
  "metadata": {
    "rows": 100,
    "cols": 26,
    "created": "2025-11-05T18:00:00.000Z",
    "modified": "2025-11-05T18:00:00.000Z"
  }
};
export const FORMATTED = {
  "name": "Formatted Spreadsheet Example",
  "setupScript": "",
  "cells": {
    "A1": {
      "content": "Account Ledger",
      "style": {
        "fontWeight": "bold",
        "fontSize": "16px",
        "backgroundColor": "#2196F3",
        "color": "white",
        "textAlign": "center"
      }
    },
    "A3": {
      "content": "Date",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#f5f5f5"
      }
    },
    "B3": {
      "content": "Description",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#f5f5f5"
      }
    },
    "C3": {
      "content": "Amount",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#f5f5f5",
        "textAlign": "right"
      }
    },
    "D3": {
      "content": "Balance",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#f5f5f5",
        "textAlign": "right"
      }
    },
    "A4": "2025-01-15",
    "B4": "Opening Balance",
    "C4": {
      "content": "1000",
      "format": "$#,##0.00"
    },
    "D4": {
      "content": "=C4",
      "format": "$#,##0.00"
    },
    "A5": "2025-01-16",
    "B5": "Office Supplies",
    "C5": {
      "content": "-150.50",
      "format": "$#,##0.00",
      "styleExpression": "STYLE_IF(C5 < 0, RED_TEXT(), GREEN_TEXT())"
    },
    "D5": {
      "content": "=D4 + C5",
      "format": "$#,##0.00"
    },
    "A6": "2025-01-17",
    "B6": "Client Payment",
    "C6": {
      "content": "2500",
      "format": "$#,##0.00",
      "styleExpression": "STYLE_IF(C6 < 0, RED_TEXT(), GREEN_TEXT())"
    },
    "D6": {
      "content": "=D5 + C6",
      "format": "$#,##0.00"
    },
    "A7": "2025-01-18",
    "B7": "Rent Payment",
    "C7": {
      "content": "-800",
      "format": "$#,##0.00",
      "styleExpression": "STYLE_IF(C7 < 0, RED_TEXT(), GREEN_TEXT())"
    },
    "D7": {
      "content": "=D6 + C7",
      "format": "$#,##0.00"
    },
    "A8": "2025-01-19",
    "B8": "Equipment Purchase",
    "C8": {
      "content": "-350.75",
      "format": "$#,##0.00",
      "styleExpression": "STYLE_IF(C8 < 0, RED_TEXT(), GREEN_TEXT())"
    },
    "D8": {
      "content": "=D7 + C8",
      "format": "$#,##0.00"
    },
    "A9": "2025-01-20",
    "B9": "Consulting Revenue",
    "C9": {
      "content": "1800",
      "format": "$#,##0.00",
      "styleExpression": "STYLE_IF(C9 < 0, RED_TEXT(), GREEN_TEXT())"
    },
    "D9": {
      "content": "=D8 + C9",
      "format": "$#,##0.00"
    },
    "B11": {
      "content": "Total Credits",
      "style": {
        "fontWeight": "bold"
      }
    },
    "C11": {
      "content": "=SUM_RANGE(\"C4:C9\")",
      "format": "$#,##0.00",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#e8f5e9"
      }
    },
    "B12": {
      "content": "Final Balance",
      "style": {
        "fontWeight": "bold"
      }
    },
    "D12": {
      "content": "=D9",
      "format": "$#,##0.00",
      "style": {
        "fontWeight": "bold",
        "fontSize": "16px",
        "backgroundColor": "#e3f2fd"
      }
    },
    "F3": {
      "content": "Sales Performance",
      "style": {
        "fontWeight": "bold",
        "backgroundColor": "#f5f5f5"
      }
    },
    "F4": "Product A",
    "G4": {
      "content": "0.85",
      "format": "0.00%",
      "styleExpression": "STYLE_IF(G4 >= 0.8, GREEN_BG(), STYLE_IF(G4 >= 0.5, YELLOW_BG(), RED_BG()))"
    },
    "F5": "Product B",
    "G5": {
      "content": "0.45",
      "format": "0.00%",
      "styleExpression": "STYLE_IF(G5 >= 0.8, GREEN_BG(), STYLE_IF(G5 >= 0.5, YELLOW_BG(), RED_BG()))"
    },
    "F6": "Product C",
    "G6": {
      "content": "0.92",
      "format": "0.00%",
      "styleExpression": "STYLE_IF(G6 >= 0.8, GREEN_BG(), STYLE_IF(G6 >= 0.5, YELLOW_BG(), RED_BG()))"
    },
    "F7": "Product D",
    "G7": {
      "content": "0.67",
      "format": "0.00%",
      "styleExpression": "STYLE_IF(G7 >= 0.8, GREEN_BG(), STYLE_IF(G7 >= 0.5, YELLOW_BG(), RED_BG()))"
    },
    "F9": {
      "content": "Temperature (°F)",
      "style": {
        "fontWeight": "bold"
      }
    },
    "G9": {
      "content": "Status",
      "style": {
        "fontWeight": "bold"
      }
    },
    "F10": "32",
    "G10": {
      "content": "Freezing",
      "styleExpression": "STYLE(\"backgroundColor\", \"#bbdefb\", \"color\", \"#0d47a1\")"
    },
    "F11": "75",
    "G11": {
      "content": "Comfortable",
      "styleExpression": "STYLE(\"backgroundColor\", \"#c8e6c9\", \"color\", \"#1b5e20\")"
    },
    "F12": "95",
    "G12": {
      "content": "Hot",
      "styleExpression": "STYLE(\"backgroundColor\", \"#ffccbc\", \"color\", \"#bf360c\")"
    }
  },
  "columnWidths": {
    "1": 120,
    "2": 180,
    "3": 120,
    "4": 120,
    "6": 140,
    "7": 140
  }
};

// The Excel example the page pastes at A1, as tab-separated rows.
export const EXAMPLE = [
  "Item\tQty\tPrice\tTotal",
  "Apples\t6\t0.45\t=B2*C2",
  "Bread\t1\t2.2\t=B3*C3",
  "Milk\t2\t1.15\t=B4*C4",
  "Total\t=SUM(B2:B4)\t\t=SUM(D2:D4)",
  "Average\t\t=AVERAGE(C2:C4)\t=ROUND(D5/B5, 2)",
].join("\n");
