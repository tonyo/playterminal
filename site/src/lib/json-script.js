// JSON for a <script type="application/json"> element, with <, > and & escaped, so a
// value can't close the script element.
const ESCAPES = { '<': '\\u003C', '>': '\\u003E', '&': '\\u0026' };

export function jsonScript(value) {
  return JSON.stringify(value).replace(/[<>&]/g, (c) => ESCAPES[c]);
}
