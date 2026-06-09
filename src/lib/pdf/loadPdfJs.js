const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;

let pdfJsLoader;

export function loadPdfJs() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF.js is only available in the browser."));
  }

  if (window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }

  if (!pdfJsLoader) {
    pdfJsLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_SCRIPT;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js failed to load."));
          return;
        }
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("PDF.js failed to load."));
      document.head.appendChild(script);
    });
  }

  return pdfJsLoader;
}
