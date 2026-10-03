(function initializeCurrencyInput(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CurrencyInput = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function getDigits(value) {
    return String(value ?? "")
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "");
  }

  function formatRupiahInput(value) {
    const digits = getDigits(value);
    return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
  }

  function parseRupiahInput(value) {
    const digits = getDigits(value);
    if (!digits) return 0;
    const amount = Number(digits);
    return Number.isSafeInteger(amount) ? amount : 0;
  }

  function formatElement(input) {
    if (!input) return "";

    const originalValue = String(input.value ?? "");
    const originalCaret = Number.isInteger(input.selectionStart)
      ? input.selectionStart
      : originalValue.length;
    const digitsBeforeCaret = getDigits(originalValue.slice(0, originalCaret)).length;
    const formattedValue = formatRupiahInput(originalValue);
    input.value = formattedValue;

    if (typeof input.setSelectionRange === "function") {
      const nextCaret = findCaretPosition(formattedValue, digitsBeforeCaret);
      input.setSelectionRange(nextCaret, nextCaret);
    }

    return formattedValue;
  }

  function findCaretPosition(value, digitCount) {
    if (digitCount <= 0) return 0;
    let seenDigits = 0;
    for (let index = 0; index < value.length; index += 1) {
      if (/\d/.test(value[index])) seenDigits += 1;
      if (seenDigits === digitCount) return index + 1;
    }
    return value.length;
  }

  return {
    formatElement,
    formatRupiahInput,
    parseRupiahInput,
  };
}));
