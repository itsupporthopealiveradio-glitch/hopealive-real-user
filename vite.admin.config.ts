import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'redirect-to-admin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/admin.html' });
            res.end();
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  cacheDir: 'node_modules/.vite-admin',
  root: '.',
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'admin.html'),
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 3,
        dead_code: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: false,
  },
  server: {
    port: 5174,
    strictPort: true,
    open: '/admin.html',
    hmr: {
      port: 5174,
    }
  },
})
