import fs from 'node:fs';

const file = 'dist/index.html';
let html = fs.readFileSync(file, 'utf8');
html = html.replace(
  /\s*<script data-pages-branch-fallback>[\s\S]*?<\/script>/,
  '',
);
fs.writeFileSync(file, html);