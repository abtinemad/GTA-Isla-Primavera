import { defineConfig } from 'vitest/config';

// Config dédiée aux tests : environnement Node, pas de plugins app (les modules
// testés — posterGeometry, storage parse — sont du TS pur sans DOM ni CSS).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
