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

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // silent — user can still Ctrl+P
      }
      setTimeout(cleanup, 5000);
    }, 1000);
  };

  iframe.src = url;
}
