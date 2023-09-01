import { defineConfig } from 'cypress';

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:9000',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
});
