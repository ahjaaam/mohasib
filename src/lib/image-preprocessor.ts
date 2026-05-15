import sharp from "sharp";

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;

  return sharp(buffer)
    .resize(width < 1500 ? 1500 : undefined, null, {
      withoutEnlargement: false,
      fit: "inside",
    })
    .grayscale()
    .normalise()
    .sharpen({ sigma: 0.5 })
    .png({ quality: 95 })
    .toBuffer();
}
