import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'never',
  vite: {
    plugins: [
      {
        name: 'fix-malformed-uri-guard',
        enforce: 'pre',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url) {
              try {
                decodeURI(req.url);
              } catch (e) {
                req.url = req.url.replace(/%(?![0-9a-fA-F]{2})/g, '%25');
                try {
                  decodeURI(req.url);
                } catch (e2) {
                  req.url = encodeURI(req.url);
                }
              }
            }
            next();
          });
        }
      }
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false
        }
      },
      watch: {
        ignored: ['**/public/images/**', '**/public/product_images/**']
      }
    }
  }
});
