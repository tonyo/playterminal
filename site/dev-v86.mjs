// `astro dev` only: serve the VM files from ../vm/out (built by `mise run build` in vm/) at
// /v86/, as nginx does in the image. The build never copies them into dist/.
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../vm/out/', import.meta.url));
const TYPES = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export default function devV86() {
  return {
    name: 'dev-v86',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/v86/', (req, res, next) => {
          const file = path.join(OUT, decodeURIComponent(req.url.split('?')[0]));
          if (!file.startsWith(OUT)) return next();
          let stat;
          try {
            stat = statSync(file);
          } catch {
            return next();
          }
          if (!stat.isFile()) return next();
          res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
          res.setHeader('Content-Length', stat.size);
          createReadStream(file).pipe(res);
        });
      },
    },
  };
}
