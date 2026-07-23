import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function gylamApiPlugin() {
  return {
    name: 'gylam-api',
    configureServer(server) {
      const { createApiServer } = require('./server/api.cjs');
      server.middlewares.use(createApiServer());
    },
    configurePreviewServer(server) {
      const { createApiServer } = require('./server/api.cjs');
      server.middlewares.use(createApiServer());
    },
  };
}

export default defineConfig({
  plugins: [react(), gylamApiPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { host: '0.0.0.0', port: 8080 },
});
