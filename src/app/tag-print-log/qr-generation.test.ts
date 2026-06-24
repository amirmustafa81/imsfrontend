import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

describe("tag QR generation", () => {
  it("generates a QR image that decodes back to the asset detail URL", async () => {
    const expected = "http://localhost:3000/assets/2";
    const dataUrl = await QRCode.toDataURL(expected, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#20242a",
        light: "#ffffff",
      },
    });

    const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1], "base64"));
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

    expect(result?.data).toBe(expected);
  });
});
