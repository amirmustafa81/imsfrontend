const LABEL_WIDTH_PX = 144;
const LABEL_HEIGHT_PX = 96;
const PRINT_FRAME_TTL_MS = 5 * 60 * 1000;

type PrintHtmlOptions = {
  title: string;
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

export const printLabelHtml = (html: string, options: PrintHtmlOptions) => {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", options.title);
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = `${LABEL_WIDTH_PX}px`;
  frame.style.height = `${LABEL_HEIGHT_PX}px`;
  frame.style.border = "0";
  frame.style.background = "#fff";
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    options.onError?.();
    return;
  }

  let cleanedUp = false;
  let fallbackTimer = 0;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    frame.remove();
    options.onComplete?.();
  };

  frameWindow.onafterprint = cleanup;
  fallbackTimer = window.setTimeout(cleanup, PRINT_FRAME_TTL_MS);

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  void waitForFrameContent(frameDocument)
    .then(() => new Promise<void>((resolve) => {
      frameWindow.requestAnimationFrame(() => frameWindow.requestAnimationFrame(() => resolve()));
    }))
    .then(() => {
      frameWindow.focus();
      frameWindow.print();
    })
    .catch(() => {
      cleanup();
      options.onError?.();
    });
};
