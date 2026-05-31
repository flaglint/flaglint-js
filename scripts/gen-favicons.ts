import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('./www/favicon.svg');

const sizes = [
  { file: './www/favicon-96.png', size: 96 },
  { file: './www/favicon-32.png', size: 32 },
  { file: './www/favicon-16.png', size: 16 },
  { file: './www/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`Created ${file}`);
}

const icoBuffer = await pngToIco(['./www/favicon-32.png', './www/favicon-16.png']);
writeFileSync('./www/favicon.ico', icoBuffer);
console.log('Created www/favicon.ico');
