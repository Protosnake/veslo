import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'backend-debugger-observability',
      configureServer(server) {
        const debugFlagPath = path.resolve(process.cwd(), '.debug_enabled');
        const debugLogPath = path.resolve(process.cwd(), 'debug.log');

        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/debug/status' && req.method === 'GET') {
            const isEnabled = fs.existsSync(debugFlagPath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ enabled: isEnabled }));
            return;
          }

          if (req.url === '/api/debug/toggle' && req.method === 'POST') {
            const isEnabled = fs.existsSync(debugFlagPath);
            if (isEnabled) {
              try { fs.unlinkSync(debugFlagPath); } catch (e) {}
            } else {
              fs.writeFileSync(debugFlagPath, 'true\n');
            }
            const newState = !isEnabled;
            console.log(`[BACKEND DEBUGGER] Toggled -> ${newState ? 'ENABLED' : 'DISABLED'}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ enabled: newState }));
            return;
          }

          if (req.url === '/api/debug/log' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const logLine = `[${new Date().toISOString()}] [${data.type || 'LOG'}] ${data.message} ${data.data ? JSON.stringify(data.data) : ''}\n`;
                fs.appendFileSync(debugLogPath, logLine);
                // Also print to server console for task output visibility
                console.log(`[GAME TELEMETRY] ${logLine.trim()}`);
              } catch (e) {}
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            });
            return;
          }

          next();
        });
      }
    }
  ]
});
