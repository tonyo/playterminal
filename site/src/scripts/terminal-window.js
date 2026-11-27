/**
 * TerminalWindow: the window a Game plays in.
 *
 * It restores a v86 emulator from the Snapshot and shows the guest's serial
 * port (ttyS0) in an xterm.js terminal, which v86's own xterm.js adapter
 * connects: output bytes go to the terminal, keystrokes go to the guest.
 *
 * The Snapshot sits at the guest's launcher on ttyS0
 * (vm/image/playterminal-launcher). It reads one line,
 * "<rows> <cols> <command>", runs the Command, prints END when it exits, then
 * READY when it waits for the next line. Both markers are OSC sequences,
 * which xterm.js does not display. The window sends the launch line when it
 * opens, and again a second after READY follows END, so a finished Game
 * restarts in the same window. Only ✖ closes the window and destroys the emulator.
 *
 * The terminal is always 80x24: Games draw for that size, and some (Robots)
 * break when the size changes under them. Making the window bigger means
 * bigger letters, never more cells: − and + step the font size, and □ (or a
 * double-click on the bar) maximizes the window, picking the largest font at
 * which 80x24 fits the browser's viewport, centered. ❐ puts it back. Not the
 * Fullscreen API: there Esc leaves fullscreen, and many Games need Esc.
 *
 * The terminal draws with WebGL when the browser can (xterm.js's WebGL addon),
 * which keeps up with full-screen redraws better than the default DOM renderer.
 *
 * Each emulator runs in its own hidden iframe, removed on close. With several
 * V86 instances created one after another in one page (v86 0.5.473), each
 * new guest stalls for a while after the Snapshot is restored, and the stall
 * doubles with every instance (1 s, 2 s, 5 s, 10 s, 20 s). A fresh iframe
 * per emulator gives v86 a fresh JS realm and the stall goes away.
 */
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import '../styles/terminal-styles.css';

// The terminal's size, fixed: the size terminal games are written for.
const ROWS = 24;
const COLS = 80;

// The pause before a finished Game starts again.
const RESTART_DELAY_MS = 1000;

// The site's own font (base-styles.css), so the window has the same size on every system.
// Glyphs it lacks come from the fallbacks.
const FONT = 'Droid Sans Mono';

// Added to the options v86 creates its xterm.js terminal with.
const TERMINAL_OPTIONS = {
  rows: ROWS,
  cols: COLS,
  convertEol: false, // the guest's tty already sends \r\n
  fontFamily: `"${FONT}", "DejaVu Sans Mono", "Liberation Mono", monospace`,
  fontSize: 14,
  theme: { background: '#000000', foreground: '#f0f0f0' },
};

// A monochrome phosphor palette: every ANSI color is a shade of one hue.
function phosphor(bg, dark, dim, fg, bright) {
  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: dim,
    black: dark,
    red: dim,
    green: fg,
    yellow: fg,
    blue: dim,
    magenta: dim,
    cyan: fg,
    white: fg,
    brightBlack: dim,
    brightRed: fg,
    brightGreen: bright,
    brightYellow: bright,
    brightBlue: fg,
    brightMagenta: fg,
    brightCyan: bright,
    brightWhite: bright,
  };
}

// The themes the bar's ◐ cycles through. crt adds scanlines and glow.
const THEMES = [
  { name: 'classic', title: 'Classic', crt: false, colors: TERMINAL_OPTIONS.theme },
  {
    name: 'green',
    title: 'Green phosphor',
    crt: true,
    colors: phosphor('#031006', '#0c3315', '#1f9940', '#33ff66', '#99ffbb'),
  },
  {
    name: 'amber',
    title: 'Amber phosphor',
    crt: true,
    colors: phosphor('#120a00', '#3d2600', '#b37a00', '#ffb000', '#ffd780'),
  },
];

// The font sizes the bar's − and + step through; the default is TERMINAL_OPTIONS'.
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];
// A maximized window on a small screen may go below FONT_SIZES, but not below this.
const MIN_FONT_SIZE = 6;

const THEME_KEY = 'playterminal.theme';
const FONT_SIZE_KEY = 'playterminal.fontSize';

// localStorage may be unavailable (privacy settings): then nothing is remembered.
function load(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {}
}

function savedTheme() {
  const name = load(THEME_KEY);
  return THEMES.find((theme) => theme.name === name) ?? THEMES[0];
}

function savedFontSize() {
  const size = Number(load(FONT_SIZE_KEY));
  return FONT_SIZES.includes(size) ? size : TERMINAL_OPTIONS.fontSize;
}

// The CRT themes' glow on the WebGL renderer's canvas, where CSS text-shadow
// does not reach: the picture with two blurred copies of itself screened on top.
function addGlowFilter() {
  if (document.getElementById('crt-glow')) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
      '<filter id="crt-glow" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="near"/>' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="far"/>' +
      '<feBlend in="near" in2="far" mode="screen" result="glow"/>' +
      '<feBlend in="SourceGraphic" in2="glow" mode="screen"/>' +
      '</filter></svg>',
  );
}

// A hidden iframe with the emulator script (libv86.js) at `src` loaded; resolves to the
// iframe.
function createFrame(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.setAttribute('aria-hidden', 'true');
    frame.srcdoc = `<!DOCTYPE html><script src="${src}"></script>`;
    frame.onload = () => {
      if (frame.contentWindow?.V86) {
        resolve(frame);
      } else {
        frame.remove();
        reject(new Error(`could not load ${src}`));
      }
    };
    document.body.appendChild(frame);
  });
}

// A <div> with this class, and children: elements or text.
function div(className, children) {
  const el = document.createElement('div');
  el.className = className;
  if (typeof children === 'string') el.textContent = children;
  else if (children) el.append(...children);
  return el;
}

// A button on the window's bar.
function tab(text, title, onClick) {
  const el = div('tab', text);
  if (title) el.title = title;
  el.addEventListener('click', onClick);
  return el;
}

export class TerminalWindow {
  /**
   * options:
   *   base         URL prefix of the VM files, ends in '/'
   *   name         the Game's name, shown on the bar
   *   command      the Game's Command
   *   refreshCode  a key code sent after each launch, or null
   *   onProgress   download-progress events while the Snapshot loads
   *   onOpen       the window is shown and the Game launched
   *   onError      the emulator could not start (the window then closes)
   *   onClose      the window is closed
   */
  constructor(options) {
    this.options = options;
    this.frame = null;
    this.emulator = null;
    this.element = null;
    this.term = null;
    this.theme = null;
    this.unmaximized = null; // the position and font size to go back to, while maximized
    // While maximized, refit on viewport resizes, at most once per frame: each new font
    // size makes xterm.js measure and the WebGL renderer redraw its glyphs.
    this.refitFrame = 0;
    this.onViewportResize = () => {
      this.refitFrame ||= requestAnimationFrame(() => {
        this.refitFrame = 0;
        if (this.unmaximized && !this.closed) this.fitViewport();
      });
    };
    this.closed = false;
    this.launched = false; // a Command is running
    this.tail = ''; // the last bytes from ttyS0, to spot END and READY
    this.markers = null; // END and READY, from config.mjs
    this.restartTimer = null;
    this.tracking = null;
    this.start().catch((err) => this.fail(err));
  }

  async start() {
    const base = this.options.base;
    // config.mjs names the emulator files: they are named by content hash.
    const config = await import(/* @vite-ignore */ `${base}config.mjs`);
    // xterm.js measures the font when the terminal opens: have it loaded by then.
    const [frame] = await Promise.all([
      createFrame(config.libv86Url(base)),
      document.fonts.load(`${TERMINAL_OPTIONS.fontSize}px "${FONT}"`),
    ]);
    if (this.closed) {
      frame.remove();
      return;
    }
    this.frame = frame;
    this.markers = { end: config.END, ready: config.READY };
    const emulator = new frame.contentWindow.V86({
      ...config.v86Options(base),
      initial_state: { url: config.snapshotUrl(base) },
      disable_keyboard: true,
      disable_mouse: true,
    });
    this.emulator = emulator;
    if (this.options.onProgress)
      emulator.add_listener('download-progress', this.options.onProgress);
    emulator.add_listener('serial0-output-byte', (byte) => this.output(String.fromCharCode(byte)));
    // Open outside v86's callback: an error in the page's code must not abort the
    // emulator's start (autostart runs after this event).
    emulator.add_listener('emulator-ready', () => setTimeout(() => this.open(), 0));
  }

  open() {
    if (this.closed) return;
    this.zoomOutTab = tab('−', 'Smaller text', () => this.zoom(-1, this.zoomOutTab));
    this.zoomInTab = tab('+', 'Larger text', () => this.zoom(1, this.zoomInTab));
    this.themeTab = tab('◐', '', () => this.nextTheme());
    this.maximizeTab = tab('□', 'Maximize', () => this.toggleMaximize());
    const bar = div('bar', [
      tab('✖', 'Close terminal', () => this.close()),
      div('title', this.options.name),
      this.zoomOutTab,
      this.zoomInTab,
      this.themeTab,
      this.maximizeTab,
    ]);
    bar.addEventListener('dblclick', (ev) => {
      if (!ev.target.classList.contains('tab')) this.toggleMaximize();
    });
    const screen = div('screen');
    this.element = document.body.appendChild(div('window', [bar, screen]));
    this.draggable(bar);

    // v86 creates the terminal (`new` on the class it is given) with its own options: add
    // ours, keep the instance.
    const self = this;
    this.emulator.set_serial_container_xtermjs(
      screen,
      class extends Terminal {
        constructor(options) {
          super({ ...options, ...TERMINAL_OPTIONS });
          self.term = this;
        }
      },
    );
    this.useWebgl();
    this.setTheme(savedTheme());
    this.setFontSize(savedFontSize());
    this.term.focus();

    this.launch();
    this.options.onOpen?.();
  }

  // Draw with WebGL if the browser can; if not, or if the GPU later drops the
  // context, xterm.js keeps or goes back to its DOM renderer.
  useWebgl() {
    try {
      const addon = new WebglAddon();
      addon.onContextLoss(() => {
        console.log('TerminalWindow: lost the WebGL context, using the DOM renderer');
        addon.dispose();
      });
      this.term.loadAddon(addon);
      addGlowFilter();
      console.log('TerminalWindow: using the WebGL renderer');
    } catch (err) {
      console.log('TerminalWindow: no WebGL, using the DOM renderer', err);
    }
  }

  setTheme(theme) {
    this.theme = theme;
    this.term.options.theme = theme.colors;
    const classes = this.element.classList;
    for (const t of THEMES) classes.remove(`theme-${t.name}`);
    classes.add(`theme-${theme.name}`);
    classes.toggle('crt', theme.crt);
    this.themeTab.title = `Theme: ${theme.title} (click to change)`;
  }

  nextTheme() {
    const theme = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length];
    this.setTheme(theme);
    save(THEME_KEY, theme.name);
    this.term.focus();
  }

  // − and + are disabled at the ends of FONT_SIZES, and while maximized.
  setFontSize(size) {
    this.term.options.fontSize = size;
    const i = FONT_SIZES.indexOf(size);
    const maximized = !!this.unmaximized;
    this.zoomOutTab.classList.toggle('disabled', maximized || i === 0);
    this.zoomInTab.classList.toggle('disabled', maximized || i === FONT_SIZES.length - 1);
  }

  // Step the font size. The window grows or shrinks, so move it to keep the clicked
  // button under the pointer for the next click.
  zoom(step, button) {
    const size = FONT_SIZES[FONT_SIZES.indexOf(this.term.options.fontSize) + step];
    // Maximized, it is already as big as fits.
    if (size && !this.unmaximized) {
      const before = button.getBoundingClientRect().left;
      this.setFontSize(size);
      save(FONT_SIZE_KEY, size);
      const left = this.element.offsetLeft + before - button.getBoundingClientRect().left;
      this.element.style.left = `${Math.max(0, left)}px`; // but keep the window on the page
    }
    this.term.focus();
  }

  // Drag the window by its bar.
  draggable(bar) {
    const el = this.element;
    bar.addEventListener('mousedown', (ev) => {
      if (ev.target.classList.contains('tab') || this.unmaximized) return;
      ev.preventDefault();
      const left = el.offsetLeft - ev.pageX;
      const top = el.offsetTop - ev.pageY;
      this.track((ev) => {
        el.style.left = `${left + ev.pageX}px`;
        // Not above the top of the page, where the bar could not be grabbed again.
        el.style.top = `${Math.max(0, top + ev.pageY)}px`;
      });
    });
  }

  // Call onMove on every mouse move until the button is released, then give the
  // terminal back the focus.
  track(onMove) {
    this.stopTracking();
    this.tracking = new AbortController();
    const options = { signal: this.tracking.signal };
    document.addEventListener('mousemove', onMove, options);
    document.addEventListener(
      'mouseup',
      () => {
        this.stopTracking();
        this.term.focus();
      },
      options,
    );
  }

  stopTracking() {
    this.tracking?.abort();
    this.tracking = null;
  }

  // The window's box, the cells' box, and the room the frame takes around the cells.
  metrics() {
    const cells = this.element.querySelector('.xterm-screen').getBoundingClientRect();
    const frame = this.element.getBoundingClientRect();
    return {
      frame,
      cells,
      spare: { x: frame.width - cells.width, y: frame.height - cells.height },
    };
  }

  toggleMaximize() {
    const el = this.element;
    const back = this.unmaximized;
    if (back) {
      this.unmaximized = null;
      window.removeEventListener('resize', this.onViewportResize);
      el.classList.remove('maximized');
      el.style.left = back.left;
      el.style.top = back.top;
      this.setFontSize(back.fontSize);
    } else {
      this.unmaximized = {
        left: el.style.left,
        top: el.style.top,
        fontSize: this.term.options.fontSize,
      };
      window.addEventListener('resize', this.onViewportResize);
      el.classList.add('maximized');
      this.fitViewport();
    }
    this.maximizeTab.textContent = back ? '□' : '❐';
    this.maximizeTab.title = back ? 'Maximize' : 'Restore';
    this.term.focus();
  }

  // The largest font size at which the 80x24 cells fit the viewport, and the window
  // centered in it. On a small screen that may be smaller than FONT_SIZES allows.
  fitViewport() {
    const el = this.element;
    const { clientWidth: width, clientHeight: height } = document.documentElement;
    let m = this.metrics();
    // Cells grow in proportion to the font size, give or take rounding.
    const scale = Math.min(
      (width - m.spare.x) / m.cells.width,
      (height - m.spare.y) / m.cells.height,
    );
    this.setFontSize(Math.max(MIN_FONT_SIZE, Math.floor(this.term.options.fontSize * scale)));
    m = this.metrics();
    // The rounding may leave it a little too big.
    while (
      (m.frame.width > width || m.frame.height > height) &&
      this.term.options.fontSize > MIN_FONT_SIZE
    ) {
      this.setFontSize(this.term.options.fontSize - 1);
      m = this.metrics();
    }
    el.style.left = `${Math.max(0, Math.floor((width - m.frame.width) / 2))}px`;
    el.style.top = `${Math.max(0, Math.floor((height - m.frame.height) / 2))}px`;
  }

  launch() {
    this.launched = true;
    // Ctrl-U first: it drops anything typed while no Game was running, so the
    // launcher reads just this line.
    this.emulator.serial0_send(`\x15${ROWS} ${COLS} ${this.options.command}\n`);
    if (this.options.refreshCode) {
      this.emulator.serial0_send(String.fromCharCode(this.options.refreshCode));
    }
  }

  output(chr) {
    if (this.closed) return;
    const { end, ready } = this.markers;
    this.tail = (this.tail + chr).slice(-Math.max(end.length, ready.length));
    if (this.launched) {
      if (this.tail.endsWith(end)) {
        this.launched = false;
        this.tail = '';
      }
    } else if (this.tail.endsWith(ready)) {
      // The Game ended and the launcher waits for a line: start the next one.
      this.tail = '';
      this.launched = true; // ignore output until the launch
      this.restartTimer = setTimeout(() => this.launch(), RESTART_DELAY_MS);
    }
  }

  fail(err) {
    console.log('TerminalWindow: the emulator could not start', err);
    this.options.onError?.(err);
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.restartTimer);
    cancelAnimationFrame(this.refitFrame);
    window.removeEventListener('resize', this.onViewportResize);
    this.stopTracking();
    this.element?.remove();
    const frame = this.frame;
    if (this.emulator) {
      // destroy() also disposes of the terminal.
      this.emulator
        .destroy()
        .catch((err) => console.log('TerminalWindow: destroy failed', err))
        .then(() => frame.remove());
    } else {
      frame?.remove();
    }
    this.options.onClose?.();
  }
}
