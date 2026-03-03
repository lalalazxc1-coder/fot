import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        watch: {
            usePolling: true
        },
        proxy: {
            '/api': {
                target: process.env.BACKEND_URL || 'http://localhost:8000',
                changeOrigin: true,
                // FIX: Ensure redirects don't point to internal Docker hostnames
                configure: (proxy, options) => {
                    proxy.on('proxyRes', (proxyRes, req, res) => {
                        if (proxyRes.headers.location) {
                            proxyRes.headers.location = proxyRes.headers.location.replace('http://backend:8000', '');
                        }
                    });
                }
            },
            '/uploads': {
                target: process.env.BACKEND_URL || 'http://localhost:8000',
                changeOrigin: true,
            },
            '/docs': {
                target: process.env.BACKEND_URL || 'http://localhost:8000',
                changeOrigin: true,
            },
            '/openapi.json': {
                target: process.env.BACKEND_URL || 'http://localhost:8000',
                changeOrigin: true,
            }
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const normalizedId = id.replace(/\\/g, '/');

                    if (!normalizedId.includes('node_modules')) {
                        return undefined;
                    }

                    if (
                        normalizedId.includes('/react/') ||
                        normalizedId.includes('/react-dom/') ||
                        normalizedId.includes('/scheduler/') ||
                        normalizedId.includes('use-sync-external-store')
                    ) {
                        return 'vendor-react';
                    }
                    if (normalizedId.includes('react-router-dom') || normalizedId.includes('react-router')) {
                        return 'vendor-router';
                    }
                    if (normalizedId.includes('/framer-motion/') || normalizedId.includes('/motion-dom/') || normalizedId.includes('/motion-utils/') || normalizedId.includes('/gsap/')) {
                        return 'vendor-motion';
                    }
                    if (normalizedId.includes('@tanstack/react-query') || normalizedId.includes('@tanstack/react-table')) {
                        return 'vendor-tanstack';
                    }
                    if (normalizedId.includes('recharts') || normalizedId.includes('chart.js') || normalizedId.includes('react-chartjs-2') || normalizedId.includes('/@kurkle/')) {
                        return 'vendor-charts';
                    }
                    if (normalizedId.includes('/d3-') || normalizedId.includes('/d3/')) {
                        return 'vendor-d3';
                    }
                    if (normalizedId.includes('jspdf')) {
                        return 'vendor-jspdf';
                    }
                    if (normalizedId.includes('html2canvas')) {
                        return 'vendor-html2canvas';
                    }
                    if (normalizedId.includes('/canvg/') || normalizedId.includes('/svg-pathdata/') || normalizedId.includes('/rgbcolor/') || normalizedId.includes('/stackblur-canvas/') || normalizedId.includes('/performance-now/')) {
                        return 'vendor-render';
                    }
                    if (normalizedId.includes('/pako/') || normalizedId.includes('/fflate/') || normalizedId.includes('/fast-png/') || normalizedId.includes('/iobuffer/')) {
                        return 'vendor-binary';
                    }
                    if (normalizedId.includes('reactflow') || normalizedId.includes('dagre')) {
                        return 'vendor-flow';
                    }
                    if (normalizedId.includes('/graphlib/')) {
                        return 'vendor-flow';
                    }
                    if (normalizedId.includes('lucide-react')) {
                        return 'vendor-icons';
                    }
                    if (normalizedId.includes('axios')) {
                        return 'vendor-axios';
                    }
                    if (normalizedId.includes('sonner') || normalizedId.includes('react-hot-toast')) {
                        return 'vendor-toast';
                    }
                    if (normalizedId.includes('fuse.js')) {
                        return 'vendor-fuse';
                    }
                    if (normalizedId.includes('papaparse')) {
                        return 'vendor-data';
                    }
                    if (normalizedId.includes('/core-js/')) {
                        return 'vendor-polyfills';
                    }
                    if (normalizedId.includes('/lodash/')) {
                        return 'vendor-lodash';
                    }
                    if (normalizedId.includes('tailwind-merge') || normalizedId.includes('usehooks-ts') || normalizedId.includes('/clsx/') || normalizedId.includes('/classcat/')) {
                        return 'vendor-utils';
                    }

                    return undefined;
                },
            },
        },
    }
})
