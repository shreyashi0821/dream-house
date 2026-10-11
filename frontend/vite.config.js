import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const SERVER = process.env.VITE_DEV_SERVER || 'http://localhost:5050';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, 'src'),
            '@shared': path.resolve(import.meta.dirname, '../shared'),
        },
    },
    server: {
        host: true,
        port: 5173,
        fs: { allow: ['..'] },
        /* Same origin in dev and prod: the page always talks to whoever served it. */
        proxy: {
            '/rooms': SERVER,
            '/health': SERVER,
            '/socket.io': { target: SERVER, ws: true },
        },
    },
    build: { chunkSizeWarningLimit: 1500 },
});
