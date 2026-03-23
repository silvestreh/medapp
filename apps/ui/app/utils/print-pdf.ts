export function pdfDataToBlob(result: { pdf: any }): Blob {
  const pdfData = result.pdf.data || result.pdf;

  if (Array.isArray(pdfData)) {
    return new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
  }

  if (typeof pdfData === 'string') {
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }

  return new Blob([pdfData], { type: 'application/pdf' });
}

export function printPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);

  // PDF plugin content inside an iframe is invisible to the browser's print engine,
  // so we open the PDF in a new tab where it's a first-class document.
  const printWindow = window.open(url);

  if (printWindow) {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } else {
    // Popup blocked — fall back to download.
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

export function printHtmlContent(html: string): void {
  const iframe = document.createElement('iframe');

  iframe.style.cssText = `
    position: fixed;
    top: 5rem;
    left: 10rem;
    max-width: 100vw;
    min-width: 80%;
    height: calc(100vh - 10rem);
    aspect-ratio: 1/3;
    border: none;
    background: white;
    opacity: 0;
    pointer-events: none;
  `;

  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  iframe.srcdoc = html;

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(cleanup, 5000);
    }, 500);
  };
}
