import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const apiUrl = (process.env.API_URL || 'https://gsnbackend.onrender.com').trim();
const targetPath = resolve('src/environments/environment.prod.ts');

mkdirSync(dirname(targetPath), { recursive: true });

writeFileSync(
  targetPath,
  `export const environment = {
  production: true,
  apiUrl: ${JSON.stringify(apiUrl)}
};
`,
  'utf8'
);

console.log(`Generated ${targetPath} with API_URL=${apiUrl}`);
