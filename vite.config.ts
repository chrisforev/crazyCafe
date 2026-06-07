import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';

// stamped into the bundle AND written to dist/version.json — the running
// game compares the two to discover that a newer deploy exists
const buildId = Date.now().toString();

export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    {
      name: 'emit-version-json',
      apply: 'build',
      closeBundle() {
        writeFileSync('dist/version.json', JSON.stringify({ buildId }));
      },
    },
  ],
});
