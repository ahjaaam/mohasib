import sharp from "sharp";

const MAX_WIDTH_PX = 180;
const MAX_HEIGHT_PX = 80;

export type LoadedInvoiceLogo = {
  logoBase64: string | null;
  logoMimeType: string | null;
  logoWidthPx: number | null;
  logoHeightPx: number | null;
};

const NO_LOGO: LoadedInvoiceLogo = {
  logoBase64: null,
  logoMimeType: null,
  logoWidthPx: null,
  logoHeightPx: null,
};

/** Fetch and normalize uploaded invoice logos into a jsPDF-supported PNG. */
export async function loadInvoiceLogo(url?: string | null): Promise<LoadedInvoiceLogo> {
  if (!url) return NO_LOGO;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[PDF] Logo fetch failed:", response.status);
      return NO_LOGO;
    }

    const source = Buffer.from(await response.arrayBuffer());
    const png = await sharp(source, { failOn: "none" })
      .resize({ width: MAX_WIDTH_PX, height: MAX_HEIGHT_PX, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const { width, height } = await sharp(png).metadata();
    if (!width || !height) return NO_LOGO;

    return {
      logoBase64: png.toString("base64"),
      logoMimeType: "image/png",
      logoWidthPx: width,
      logoHeightPx: height,
    };
  } catch (error) {
    console.warn("[PDF] Logo conversion failed:", error);
    return NO_LOGO;
  }
}
