// /licenses/xterm.txt and the other third-party license files (see lib/license-files.js).
import { LICENSE_FILES, licenseText } from '../../lib/license-files.js';

export function getStaticPaths() {
  return Object.keys(LICENSE_FILES).map((name) => ({ params: { name } }));
}

export async function GET({ params }) {
  return new Response(await licenseText(params.name), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
