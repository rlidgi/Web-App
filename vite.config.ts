import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    base: '/static/react/',  // Set base path for asset URLs
    root: 'frontend',  // Set frontend as the root directory
    build: {
        outDir: '../static/react',  // Output to static/react folder
        emptyOutDir: true,  // Clear the output directory before building
        assetsDir: 'assets',  // Put assets in assets subfolder
        sourcemap: false,  // Disable source maps for production
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './frontend/src'),  // Optional: for @/ imports
        },
    },
});