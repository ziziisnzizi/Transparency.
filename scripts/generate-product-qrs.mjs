import QRCode from 'qrcode';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseUrl = 'https://transparency-web-five.vercel.app/';
const products = ['serum-s1', 'toner-t1', 'cream-c1'];
const outputDirectory = new URL('../public/images/qr/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

for (const slug of products) {
  const url = new URL(baseUrl);
  url.searchParams.set('product', slug);
  await QRCode.toFile(fileURLToPath(new URL(`${slug}.svg`, outputDirectory)), url.href, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  await QRCode.toFile(fileURLToPath(new URL(`${slug}.png`, outputDirectory)), url.href, {
    type: 'png',
    width: 1200,
    errorCorrectionLevel: 'H',
    margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  console.log(`${slug}: ${url.href}`);
}
