const PRINT_WINDOW_TTL_MS = 5 * 60 * 1000;

type PrintHtmlOptions = {
  title: string;
  printWindow?: Window | null;
  onComplete?: () => void;
  onError?: () => void;
};

const waitForFrameContent = async (frameDocument: Document) => {
  const images = Array.from(frameDocument.images);

  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }

    if (typeof image.decode === "function") {
      await image.decode().catch(() => undefined);
    }
  }));

  await frameDocument.fonts?.ready;
};

export const openLabelPrintWindow = (title: string) => {
  const printWindow = window.open(
    "",
    `ims-label-print-${Date.now()}`,
    "popup=yes,width=480,height=320,left=100,top=100",
  );

  if (!printWindow) return null;

  printWindow.document.open();
  printWindow.document.write("<!doctype html><html><head><title>IMS label print</title></head><body>Preparing label...</body></html>");
  printWindow.document.close();
  printWindow.document.title = title;
  return printWindow;
};

export const printLabelHtml = (html: string, options: PrintHtmlOptions) => {
  const printWindow = options.printWindow ?? openLabelPrintWindow(options.title);
  if (!printWindow || printWindow.closed) {
    options.onError?.();
    return false;
  }

  let cleanedUp = false;
  let fallbackTimer = 0;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    if (!printWindow.closed) printWindow.close();
    options.onComplete?.();
  };

  printWindow.onafterprint = cleanup;
  fallbackTimer = window.setTimeout(cleanup, PRINT_WINDOW_TTL_MS);

  const printDocument = printWindow.document;
  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  void waitForFrameContent(printDocument)
    .then(() => new Promise<void>((resolve) => {
      printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(() => resolve()));
    }))
    .then(() => {
      printWindow.focus();
      printWindow.print();
    })
    .catch(() => {
      cleanup();
      options.onError?.();
    });

  return true;
};
