import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration from environment variables - use VITE_ prefixed for browser access
// and non-prefixed for server-side configuration like proxy
const FLINK_HOST = process.env.VITE_FLINK_HOST || process.env.FLINK_HOST || 'http://localhost:8083'
const FLINK_USERNAME = process.env.VITE_FLINK_USERNAME || process.env.FLINK_USERNAME
const FLINK_PASSWORD = process.env.VITE_FLINK_PASSWORD || process.env.FLINK_PASSWORD
const FLINK_API_TOKEN = process.env.VITE_FLINK_API_TOKEN || process.env.FLINK_API_TOKEN
const FLINK_SSL_VERIFY = (process.env.VITE_FLINK_SSL_VERIFY || process.env.FLINK_SSL_VERIFY || 'true') !== 'false'

console.log('🔧 Vite proxy configuration:')
console.log(`   Target: ${FLINK_HOST}`)
console.log(`   SSL Verify: ${FLINK_SSL_VERIFY}`)
console.log(`   Username: ${FLINK_USERNAME ? '***' : 'not set'}`)
console.log(`   Password: ${FLINK_PASSWORD ? '***' : 'not set'}`)
console.log(`   API Token: ${FLINK_API_TOKEN ? '***' : 'not set'}`)

// Build proxy configuration
const proxyConfig = {
  target: FLINK_HOST,
  changeOrigin: true,
  secure: FLINK_SSL_VERIFY,
  rewrite: (path) => path.replace(/^\/api\/flink/, ''),
  configure: (proxy, options) => {
    proxy.on('error', (err, req, res) => {
      console.log('Proxy error:', err);
    });
    proxy.on('proxyReq', (proxyReq, req, res) => {
      // Add authentication headers if configured
      if (FLINK_API_TOKEN) {
        proxyReq.setHeader('Authorization', `Bearer ${FLINK_API_TOKEN}`);
      } else if (FLINK_USERNAME && FLINK_PASSWORD) {
        const auth = Buffer.from(`${FLINK_USERNAME}:${FLINK_PASSWORD}`).toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
      }
      
      console.log('Proxying request:', req.method, req.url, '-> ' + FLINK_HOST + req.url.replace('/api/flink', ''));
      if (FLINK_USERNAME || FLINK_API_TOKEN) {
        console.log('Authentication: Enabled');
      }
    });
    proxy.on('proxyRes', (proxyRes, req, res) => {
      console.log('Proxy response:', proxyRes.statusCode, req.url);
    });
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow all hostnames for dev server
    port: 3000,
    allowedHosts: true,
    open: false, // Disable automatic browser opening (useful for Docker/containers)
    strictPort: true, // Exit if port is already in use
    proxy: {
      // Proxy all /api/flink requests to the Flink SQL Gateway
      '/api/flink': proxyConfig
    }
  },
  preview: {
    host: '0.0.0.0', // Allow all hostnames for preview mode
    port: 4173
  }
})
