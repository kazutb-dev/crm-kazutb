import fs from 'node:fs';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

const sslCertPath = new URL('./ssl/fullchain.pem', import.meta.url);
const sslKeyPath = new URL('./ssl/private.key', import.meta.url);

const httpsConfig = fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)
    ? {
        cert: fs.readFileSync(sslCertPath),
        key: fs.readFileSync(sslKeyPath),
    }
    : undefined;

export default defineConfig({
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
    server: {
        host: '0.0.0.0',
        cors: true,
        https: httpsConfig,
        hmr: {
            host: '10.0.1.47',
        },
        watch: {
            ignored: ['**/vendor/**', '**/storage/**', '**/bootstrap/cache/**'],
        },
    },
});
