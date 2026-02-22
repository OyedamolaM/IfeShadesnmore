import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const HERO_DIR = path.resolve("public", "hero");
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const MAX_WIDTH = 1400;
const JPG_QUALITY_PRIMARY = 74;
const JPG_QUALITY_SECONDARY = 64;
const PNG_QUALITY = 70;
const LARGE_FILE_THRESHOLD_BYTES = 1_000_000;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const beforeStat = await fs.stat(filePath);
  const originalBytes = beforeStat.size;
  const inputBuffer = await fs.readFile(filePath);

  let processor = sharp(inputBuffer, { failOn: "none" });
  const metadata = await processor.metadata();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    processor = processor.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }

  let buffer;
  if (ext === ".png") {
    buffer = await processor
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        quality: PNG_QUALITY
      })
      .toBuffer();
  } else {
    buffer = await processor
      .jpeg({
        quality: JPG_QUALITY_PRIMARY,
        mozjpeg: true,
        progressive: true
      })
      .toBuffer();

    if (buffer.length > LARGE_FILE_THRESHOLD_BYTES) {
      buffer = await sharp(buffer)
        .jpeg({
          quality: JPG_QUALITY_SECONDARY,
          mozjpeg: true,
          progressive: true
        })
        .toBuffer();
    }
  }

  if (buffer.length < originalBytes) {
    await fs.writeFile(filePath, buffer);
  }

  const afterStat = await fs.stat(filePath);
  const saved = originalBytes - afterStat.size;
  return {
    fileName: path.basename(filePath),
    before: originalBytes,
    after: afterStat.size,
    saved
  };
}

async function main() {
  const entries = await fs.readdir(HERO_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(HERO_DIR, entry.name))
    .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  if (files.length === 0) {
    console.log("No hero images found.");
    return;
  }

  const results = [];
  for (const file of files) {
    // Process serially to keep memory use low on small machines.
    // eslint-disable-next-line no-await-in-loop
    results.push(await optimizeImage(file));
  }

  const totalBefore = results.reduce((sum, item) => sum + item.before, 0);
  const totalAfter = results.reduce((sum, item) => sum + item.after, 0);
  const totalSaved = totalBefore - totalAfter;

  console.log("Optimized hero images:");
  for (const item of results) {
    const direction = item.saved >= 0 ? "-" : "+";
    console.log(
      `${item.fileName}: ${formatBytes(item.before)} -> ${formatBytes(item.after)} (${direction}${formatBytes(
        Math.abs(item.saved)
      )})`
    );
  }
  console.log(
    `Total: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} (saved ${formatBytes(totalSaved)})`
  );
}

main().catch((error) => {
  console.error("Failed to optimize hero images:", error?.message || error);
  process.exit(1);
});
