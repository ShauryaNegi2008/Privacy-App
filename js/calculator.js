// ============================================================
// HUSH — CALCULATOR (the disguise)
// A real, working calculator. Separately, it tracks the exact
// raw keystrokes typed since the last clear. If that raw string
// is ever an exact match for CONFIG.UNLOCK_PIN at the moment "="
// is pressed, it unlocks instead of computing — otherwise it
// just calculates normally. A real calculation that happens to
// land on the same number can't trigger it, because the match
// is on what you TYPED, not on the result.
// ============================================================

function initCalculator(onUnlock) {
  const display = document.getElementById("calc-display");
  const keys = document.getElementById("calc-keys");

  let display_value = "0";
  let stored_value = null;
  let pending_op = null;
  let raw_since_clear = "";
  let just_evaluated = false;

  function render() {
    display.textContent = display_value;
  }

  function pressDigit(d) {
    if (just_evaluated) {
      display_value = "0";
      just_evaluated = false;
    }
    raw_since_clear += d;
    display_value = display_value === "0" ? d : display_value + d;
    render();
  }

  function pressDecimal() {
    raw_since_clear += ".";
    if (!display_value.includes(".")) display_value += ".";
    render();
  }

  function pressClear() {
    display_value = "0";
    stored_value = null;
    pending_op = null;
    raw_since_clear = "";
    just_evaluated = false;
    render();
  }

  function pressOperator(op) {
    raw_since_clear += op;
    just_evaluated = false;
    if (stored_value === null) {
      stored_value = parseFloat(display_value);
    } else if (pending_op) {
      stored_value = applyOp(stored_value, parseFloat(display_value), pending_op);
    }
    pending_op = op;
    display_value = "0";
    render();
  }

  function applyOp(a, b, op) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? 0 : a / b;
      default: return b;
    }
  }

  function pressEquals() {
    // --- Secret unlock check happens here, BEFORE any math ---
    if (raw_since_clear === CONFIG.UNLOCK_PIN) {
      pressClear();
      onUnlock();
      return;
    }

    if (pending_op !== null && stored_value !== null) {
      const result = applyOp(stored_value, parseFloat(display_value), pending_op);
      display_value = String(result);
      stored_value = null;
      pending_op = null;
    }
    just_evaluated = true;
    raw_since_clear = "";
    render();
  }

  keys.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const digit = btn.dataset.digit;

    if (digit !== undefined) pressDigit(digit);
    else if (action === "decimal") pressDecimal();
    else if (action === "clear") pressClear();
    else if (action === "equals") pressEquals();
    else if (["+", "-", "*", "/"].includes(action)) pressOperator(action);
  });

  render();
}
