import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const targetArg = String(process.argv[2] || "").trim();
const targetPath = path.resolve(targetArg || "public/hero/sunglasses2.jpg");

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressImage(filePath) {
  const before = (await fs.stat(filePath)).size;
  const inputBuffer = await fs.readFile(filePath);

  let output = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({
      quality: 70,
      mozjpeg: true,
      progressive: true
    })
    .toBuffer();

  if (output.length > 350_000) {
    output = await sharp(output)
      .jpeg({
        quality: 62,
        mozjpeg: true,
        progressive: true
      })
      .toBuffer();
  }

  await fs.writeFile(filePath, output);
  const after = (await fs.stat(filePath)).size;

  console.log(
    `${path.basename(filePath)}: ${formatBytes(before)} -> ${formatBytes(after)} (saved ${formatBytes(
      before - after
    )})`
  );
}

compressImage(targetPath).catch((error) => {
  console.error("Could not compress image:", error?.message || error);
  process.exit(1);
});
