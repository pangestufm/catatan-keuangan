(function initializeBankDocument(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BankDocument = api;
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const MAX_PDF_PAGES = 6;
  const MAX_TOTAL_BASE64_LENGTH = 6 * 1024 * 1024;
  const TARGET_PAGE_WIDTH = 1200;
  const JPEG_QUALITY = 0.76;

  async function extractPdfText(file, pdfjs) {
    if (!file?.arrayBuffer || !pdfjs?.getDocument) {
      throw new Error("Parser PDF tidak tersedia. Muat ulang halaman lalu coba lagi.");
    }

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;

    try {
      assertPageLimit(pdf.numPages);
      const pages = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = groupTextItemsIntoRows(textContent.items);
        if (pageText) pages.push(`=== Halaman ${pageNumber} ===\n${pageText}`);
        page.cleanup?.();
      }

      return pages.join("\n\n").slice(0, 250000);
    } finally {
      pdf.cleanup?.();
      await pdf.destroy?.();
    }
  }

  async function renderPdfToImages(file, pdfjs, options = {}) {
    if (!file?.arrayBuffer || !pdfjs?.getDocument) {
      throw new Error("Parser PDF tidak tersedia. Muat ulang halaman lalu coba lagi.");
    }

    const canvasFactory = options.canvasFactory || (() => document.createElement("canvas"));
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await loadingTask.promise;

    try {
      assertPageLimit(pdf.numPages);

      const images = [];
      let totalBase64Length = 0;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2, TARGET_PAGE_WIDTH / Math.max(1, baseViewport.width));
        const viewport = page.getViewport({ scale });
        const canvas = canvasFactory();
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvasContext: canvas.getContext("2d", { alpha: false }),
          viewport,
          background: "#ffffff",
        }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const data = String(dataUrl).split(",")[1] || "";
        if (!data) throw new Error(`Halaman ${pageNumber} gagal dikonversi menjadi gambar.`);

        totalBase64Length += data.length;
        if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
          throw new Error("Hasil konversi PDF terlalu besar. Bagi dokumen menjadi beberapa bagian lalu coba lagi.");
        }

        images.push({ mimeType: "image/jpeg", data });
        page.cleanup?.();
        canvas.width = 1;
        canvas.height = 1;
      }

      return images;
    } finally {
      pdf.cleanup?.();
      await pdf.destroy?.();
    }
  }

  function assertPageLimit(pageCount) {
    if (pageCount > MAX_PDF_PAGES) {
      throw new Error(`PDF maksimal ${MAX_PDF_PAGES} halaman per unggahan. Bagi dokumen menjadi beberapa bagian agar tidak ada transaksi terlewat.`);
    }
  }

  function groupTextItemsIntoRows(items) {
    const rows = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const text = String(item?.str || "").trim();
      if (!text) return;

      const x = Number(item?.transform?.[4]) || 0;
      const y = Number(item?.transform?.[5]) || 0;
      let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
      if (!row) {
        row = { y, cells: [] };
        rows.push(row);
      }
      row.cells.push({ x, text });
    });

    return rows
      .sort((a, b) => b.y - a.y)
      .map((row) => row.cells.sort((a, b) => a.x - b.x).map((cell) => cell.text).join("\t"))
      .join("\n");
  }

  return {
    MAX_PDF_PAGES,
    extractPdfText,
    renderPdfToImages,
  };
}));
