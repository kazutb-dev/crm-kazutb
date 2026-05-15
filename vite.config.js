import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

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
        hmr: {
            host: '10.0.1.47',
        },
        watch: {
            ignored: ['**/vendor/**', '**/storage/**', '**/bootstrap/cache/**'],
        },
    },
});
