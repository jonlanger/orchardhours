import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // dist/ works from any static host, subpath included
  server: { host: '127.0.0.1', port: Number(process.env.PORT ?? 5321), strictPort: false },
  build: { target: 'es2022', sourcemap: true },
});
