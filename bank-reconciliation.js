(function initializeBankReconciliation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BankReconciliation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeReference(value) {
    const reference = String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return reference.length >= 4 ? reference : "";
  }

  function createFingerprint(transaction) {
    return [
      String(transaction?.date || ""),
      transaction?.type === "income" ? "income" : "expense",
      Math.abs(Math.round(Number(transaction?.amount) || 0)),
      normalizeText(transaction?.description),
    ].join("|");
  }

  function createDescriptionKey(transaction) {
    return [
      String(transaction?.date || ""),
      transaction?.type === "income" ? "income" : "expense",
      normalizeText(transaction?.description),
    ].join("|");
  }

  function describeChanges(incoming, existing) {
    const changes = [];
    if (incoming.date !== existing.date) changes.push("tanggal");
    if (incoming.type !== existing.type) changes.push("jenis");
    if (Math.round(Number(incoming.amount)) !== Math.round(Number(existing.amount))) changes.push("nominal");
    if (normalizeText(incoming.description) !== normalizeText(existing.description)) changes.push("keterangan");
    return changes;
  }

  function reconcileBankTransactions(incomingTransactions, existingTransactions) {
    const comparisonPool = (Array.isArray(existingTransactions) ? existingTransactions : []).map((item) => ({
      ...item,
      reference: item.bankReference || item.reference || "",
      _fromDocument: false,
    }));

    return (Array.isArray(incomingTransactions) ? incomingTransactions : []).map((transaction, index) => {
      const incoming = {
        ...transaction,
        reference: String(transaction?.reference || transaction?.bankReference || "").trim(),
      };
      const normalizedReference = normalizeReference(incoming.reference);
      const exactReferenceMatch = normalizedReference
        ? comparisonPool.find((item) => normalizeReference(item.reference) === normalizedReference)
        : null;
      const exactFingerprintMatch = comparisonPool.find((item) => createFingerprint(item) === createFingerprint(incoming));
      const exactMatch = exactReferenceMatch || exactFingerprintMatch;

      if (exactMatch) {
        const changes = exactReferenceMatch ? describeChanges(incoming, exactMatch) : [];
        if (changes.length) {
          return {
            ...incoming,
            selected: false,
            reconciliationStatus: "changed",
            reconciliationNote: `Berbeda pada ${changes.join(", ")}. Centang untuk memperbarui data lama.`,
            existingTransactionId: exactMatch.id || "",
            duplicateWithinDocument: Boolean(exactMatch._fromDocument),
          };
        }

        return {
          ...incoming,
          selected: false,
          reconciliationStatus: "duplicate",
          reconciliationNote: exactMatch._fromDocument
            ? "Transaksi yang sama muncul lebih dari sekali di dokumen ini."
            : "Transaksi ini sudah tersimpan dan tidak akan diinput ulang.",
          existingTransactionId: exactMatch.id || "",
          duplicateWithinDocument: Boolean(exactMatch._fromDocument),
        };
      }

      const descriptionMatches = comparisonPool.filter((item) => (
        createDescriptionKey(item) === createDescriptionKey(incoming)
      ));
      if (descriptionMatches.length === 1 && descriptionMatches[0].id) {
        const existing = descriptionMatches[0];
        const changes = describeChanges(incoming, existing);
        return {
          ...incoming,
          selected: false,
          reconciliationStatus: "changed",
          reconciliationNote: `Kemungkinan pembaruan data lama pada ${changes.join(", ") || "detail transaksi"}. Centang untuk menerapkan.`,
          existingTransactionId: existing.id,
          duplicateWithinDocument: false,
        };
      }

      const draft = {
        ...incoming,
        selected: true,
        reconciliationStatus: "new",
        reconciliationNote: "Transaksi baru dan siap disimpan.",
        existingTransactionId: "",
        duplicateWithinDocument: false,
      };
      comparisonPool.push({
        ...draft,
        id: `draft-${index}`,
        _fromDocument: true,
      });
      return draft;
    });
  }

  return {
    createFingerprint,
    normalizeReference,
    reconcileBankTransactions,
  };
}));
