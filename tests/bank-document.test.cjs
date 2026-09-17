const test = require("node:test");
const assert = require("node:assert/strict");

const { extractPdfText, renderPdfToImages } = require("../bank-document.js");

function createPdfJs(pageCount) {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pageCount,
        getPage: async () => ({
          getViewport: ({ scale }) => ({ width: 500 * scale, height: 700 * scale }),
          render: () => ({ promise: Promise.resolve() }),
          cleanup: () => {},
        }),
        cleanup: () => {},
        destroy: () => Promise.resolve(),
      }),
    }),
  };
}

test("merender setiap halaman PDF menjadi JPEG yang dikirim ke agent", async () => {
  let canvasIndex = 0;
  const canvasFactory = () => {
    canvasIndex += 1;
    return {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toDataURL: () => `data:image/jpeg;base64,page-${canvasIndex}`,
    };
  };

  const result = await renderPdfToImages(
    { arrayBuffer: async () => new ArrayBuffer(8) },
    createPdfJs(2),
    { canvasFactory },
  );

  assert.deepEqual(result, [
    { mimeType: "image/jpeg", data: "page-1" },
    { mimeType: "image/jpeg", data: "page-2" },
  ]);
});

test("menolak PDF lebih dari enam halaman agar transaksi tidak terpotong diam-diam", async () => {
  await assert.rejects(
    renderPdfToImages(
      { arrayBuffer: async () => new ArrayBuffer(8) },
      createPdfJs(7),
      { canvasFactory: () => ({}) },
    ),
    /maksimal 6 halaman/i,
  );
});

test("mengekstrak baris PDF teks sebelum memakai jalur gambar", async () => {
  const pdfjs = {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [
              { str: "Tanggal", transform: [1, 0, 0, 1, 10, 700] },
              { str: "Debit", transform: [1, 0, 0, 1, 300, 700] },
              { str: "17/09/2026", transform: [1, 0, 0, 1, 10, 680] },
              { str: "85.000", transform: [1, 0, 0, 1, 300, 680] },
            ],
          }),
          cleanup: () => {},
        }),
        cleanup: () => {},
        destroy: () => Promise.resolve(),
      }),
    }),
  };

  const text = await extractPdfText(
    { arrayBuffer: async () => new ArrayBuffer(8) },
    pdfjs,
  );

  assert.equal(text, "=== Halaman 1 ===\nTanggal\tDebit\n17/09/2026\t85.000");
});
