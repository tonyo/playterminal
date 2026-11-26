// The license files the licenses page links to, served as /licenses/<name>.txt.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import droidSansMono from '../assets/droid-sans-mono/LICENSE?raw';

const require = createRequire(import.meta.url);
const npmLicense = (pkg) => () => readFile(require.resolve(`${pkg}/LICENSE`), 'utf8');

export const LICENSE_FILES = {
  xterm: npmLicense('@xterm/xterm'),
  'xterm-addon-webgl': npmLicense('@xterm/addon-webgl'),
  'droid-sans-mono': async () => droidSansMono,
};

export async function licenseText(name) {
  return LICENSE_FILES[name]();
}
