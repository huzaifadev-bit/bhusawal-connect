import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    server: {
      watch: {
        ignored: ['**/public/images/**']
      }
    }
  }
});