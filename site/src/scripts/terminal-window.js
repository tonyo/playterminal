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
 * Fullscreen API: there Esc leaves fullscreen, and many Games need Esc. (The
 * guest can still resize ttyS0 from "<rows> <cols>" on serial1,
 * vm/image/playterminal-resize, for a Game that handles resizing well; the
 * window doesn't use it.)
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
(function (window) {
  // The terminal's size, fixed: the size terminal games are written for.
  var ROWS = 24;
  var COLS = 80;

  // Printed by the launcher.
  var END = '\x1b]777;playterminal;exit\x07';
  var READY = '\x1b]777;playterminal;ready\x07';
  // The pause before a finished Game starts again.
  var RESTART_DELAY_MS = 1000;

  // Added to the options v86 creates its xterm.js terminal with.
  var TERMINAL_OPTIONS = {
    rows: ROWS,
    cols: COLS,
    convertEol: false, // the guest's tty already sends \r\n
    fontFamily: '"DejaVu Sans Mono", "Liberation Mono", monospace',
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
  var THEMES = [
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

  var THEME_KEY = 'playterminal.theme';

  function savedTheme() {
    var name, i;
    try {
      name = window.localStorage.getItem(THEME_KEY);
    } catch {}
    for (i = 0; i < THEMES.length; i++) {
      if (THEMES[i].name === name) return THEMES[i];
    }
    return THEMES[0];
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(THEME_KEY, theme.name);
    } catch {}
  }

  // The font sizes the bar's − and + step through; the default is TERMINAL_OPTIONS'.
  var FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];
  var FONT_SIZE_KEY = 'playterminal.fontSize';
  // A maximized window on a small screen may go below FONT_SIZES, but not below this.
  var MIN_FONT_SIZE = 6;

  function savedFontSize() {
    var size;
    try {
      size = parseInt(window.localStorage.getItem(FONT_SIZE_KEY), 10);
    } catch {}
    return FONT_SIZES.indexOf(size) >= 0 ? size : TERMINAL_OPTIONS.fontSize;
  }

  function saveFontSize(size) {
    try {
      window.localStorage.setItem(FONT_SIZE_KEY, String(size));
    } catch {}
  }

  // The CRT themes' glow on the WebGL renderer's canvas, where CSS text-shadow
  // does not reach: the picture with two blurred copies of itself screened on top.
  function addGlowFilter() {
    if (document.getElementById('crt-glow')) return;
    var holder = document.createElement('div');
    holder.innerHTML =
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
      '<filter id="crt-glow" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="near"/>' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="far"/>' +
      '<feBlend in="near" in2="far" mode="screen" result="glow"/>' +
      '<feBlend in="SourceGraphic" in2="glow" mode="screen"/>' +
      '</filter></svg>';
    document.body.appendChild(holder.firstChild);
  }

  // A hidden iframe with the emulator script (libv86.js) at `src` loaded; resolves to the
  // iframe.
  function createFrame(src) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.setAttribute('aria-hidden', 'true');
      frame.srcdoc = '<!DOCTYPE html><script src="' + src + '"></script>';
      frame.onload = function () {
        if (frame.contentWindow?.V86) {
          resolve(frame);
        } else {
          frame.remove();
          reject(new Error('could not load ' + src));
        }
      };
      document.body.appendChild(frame);
    });
  }

  function noop() {}

  // A <div> with this class, and children: elements or text.
  function div(className, children) {
    var el = document.createElement('div');
    el.className = className;
    if (typeof children === 'string') el.textContent = children;
    else if (children) el.append.apply(el, children);
    return el;
  }

  // A button on the window's bar.
  function tab(text, title, onClick) {
    var el = div('tab', text);
    if (title) el.title = title;
    el.addEventListener('click', onClick);
    return el;
  }

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
  function TerminalWindow(options) {
    this.options = options;
    this.frame = null;
    this.emulator = null;
    this.element = null;
    this.term = null;
    this.theme = null;
    this.themeTab = this.zoomInTab = this.zoomOutTab = this.maximizeTab = null;
    this.unmaximized = null; // the position and font size to go back to, while maximized
    this.onViewportResize = this.fitViewport.bind(this);
    this.closed = false;
    this.launched = false; // a Command is running
    this.tail = ''; // the last bytes from ttyS0, to spot END and READY
    this.restartTimer = null;
    this.start();
  }

  TerminalWindow.prototype.start = function () {
    var self = this,
      base = this.options.base;
    // config.mjs names the emulator files: they are named by content hash.
    import(base + 'config.mjs')
      .then(function (config) {
        return createFrame(config.libv86Url(base)).then(function (frame) {
          return { frame: frame, config: config };
        });
      })
      .then(function (loaded) {
        var frame = loaded.frame,
          config = loaded.config;
        if (self.closed) {
          frame.remove();
          return;
        }
        self.frame = frame;
        var options = config.v86Options(base);
        options.initial_state = { url: config.snapshotUrl(base) };
        options.disable_keyboard = true;
        options.disable_mouse = true;

        var emulator = new frame.contentWindow.V86(options);
        self.emulator = emulator;
        emulator.add_listener('download-progress', self.options.onProgress || noop);
        emulator.add_listener('serial0-output-byte', function (byte) {
          self.output(String.fromCharCode(byte));
        });
        emulator.add_listener('emulator-ready', function () {
          // Open outside v86's callback: an error in the page's code must not
          // abort the emulator's start (autostart runs after this event).
          setTimeout(function () {
            self.open();
          }, 0);
        });
      })
      .catch(function (err) {
        self.fail(err);
      });
  };

  TerminalWindow.prototype.open = function () {
    if (this.closed) return;
    var self = this;

    var close = tab('✖', 'Close terminal', function () {
      self.close();
    });
    this.zoomOutTab = tab('−', 'Smaller text', function () {
      self.zoom(-1, this);
    });
    this.zoomInTab = tab('+', 'Larger text', function () {
      self.zoom(1, this);
    });
    this.themeTab = tab('◐', '', function () {
      self.nextTheme();
    });
    this.maximizeTab = tab('□', 'Maximize', function () {
      self.toggleMaximize();
    });
    var bar = div('bar', [
      close,
      div('title', this.options.name),
      this.zoomOutTab,
      this.zoomInTab,
      this.themeTab,
      this.maximizeTab,
    ]);
    bar.addEventListener('dblclick', function (ev) {
      if (!ev.target.classList.contains('tab')) self.toggleMaximize();
    });
    var screen = div('screen');
    this.element = document.body.appendChild(div('window', [bar, screen]));
    this.draggable(bar);

    // v86 creates the terminal with its own options: add ours, keep the instance.
    function Terminal(options) {
      self.term = new window.Terminal(Object.assign({}, options, TERMINAL_OPTIONS));
      return self.term;
    }
    this.emulator.set_serial_container_xtermjs(screen, Terminal);
    this.useWebgl();
    this.setTheme(savedTheme());
    this.setFontSize(savedFontSize());
    this.term.focus();

    this.launch();
    (this.options.onOpen || noop)();
  };

  // Draw with WebGL if the browser can; if not, or if the GPU later drops the
  // context, xterm.js keeps or goes back to its DOM renderer.
  TerminalWindow.prototype.useWebgl = function () {
    var addon;
    if (!window.WebglAddon) {
      console.log('TerminalWindow: the WebGL addon did not load, using the DOM renderer');
      return;
    }
    try {
      addon = new window.WebglAddon.WebglAddon();
      addon.onContextLoss(function () {
        console.log('TerminalWindow: lost the WebGL context, using the DOM renderer');
        addon.dispose();
      });
      this.term.loadAddon(addon);
      addGlowFilter();
      console.log('TerminalWindow: using the WebGL renderer');
    } catch (err) {
      console.log('TerminalWindow: no WebGL, using the DOM renderer', err);
    }
  };

  TerminalWindow.prototype.setTheme = function (theme) {
    this.theme = theme;
    this.term.options.theme = theme.colors;
    var classes = this.element.classList;
    THEMES.forEach(function (t) {
      classes.remove('theme-' + t.name);
    });
    classes.add('theme-' + theme.name);
    classes.toggle('crt', theme.crt);
    this.themeTab.title = 'Theme: ' + theme.title + ' (click to change)';
  };

  TerminalWindow.prototype.nextTheme = function () {
    var theme = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length];
    this.setTheme(theme);
    saveTheme(theme);
    this.term.focus();
  };

  // − and + are disabled at the ends of FONT_SIZES, and while maximized.
  TerminalWindow.prototype.setFontSize = function (size) {
    this.term.options.fontSize = size;
    var i = FONT_SIZES.indexOf(size),
      maximized = !!this.unmaximized;
    this.zoomOutTab.classList.toggle('disabled', maximized || i === 0);
    this.zoomInTab.classList.toggle('disabled', maximized || i === FONT_SIZES.length - 1);
  };

  // Step the font size. The window grows or shrinks, so move it to keep the clicked
  // button under the pointer for the next click.
  TerminalWindow.prototype.zoom = function (step, tab) {
    var i = FONT_SIZES.indexOf(this.term.options.fontSize) + step,
      before,
      left;
    if (this.unmaximized) {
      // maximized: already as big as fits
    } else if (i >= 0 && i < FONT_SIZES.length) {
      before = tab.getBoundingClientRect().left;
      this.setFontSize(FONT_SIZES[i]);
      saveFontSize(FONT_SIZES[i]);
      left = this.element.offsetLeft + before - tab.getBoundingClientRect().left;
      this.element.style.left = Math.max(0, left) + 'px'; // but keep the window on the page
    }
    this.term.focus();
  };

  // Drag the window by its bar.
  TerminalWindow.prototype.draggable = function (bar) {
    var self = this,
      el = this.element;
    bar.addEventListener('mousedown', function (ev) {
      if (ev.target.classList.contains('tab') || self.unmaximized) return;
      ev.preventDefault();
      var start = { left: el.offsetLeft, top: el.offsetTop },
        x = ev.pageX,
        y = ev.pageY;
      self.track(function (ev) {
        el.style.left = start.left + ev.pageX - x + 'px';
        // Not above the top of the page, where the bar could not be grabbed again.
        el.style.top = Math.max(0, start.top + ev.pageY - y) + 'px';
      });
    });
  };

  // The window's box, the cells' box, and the room the frame takes around the cells.
  TerminalWindow.prototype.metrics = function () {
    var cells = this.element.querySelector('.xterm-screen').getBoundingClientRect(),
      frame = this.element.getBoundingClientRect();
    return {
      frame: frame,
      cells: cells,
      spare: { x: frame.width - cells.width, y: frame.height - cells.height },
    };
  };

  TerminalWindow.prototype.toggleMaximize = function () {
    var el = this.element,
      back = this.unmaximized;
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
  };

  // The largest font size at which the 80x24 cells fit the viewport, and the window
  // centered in it. On a small screen that may be smaller than FONT_SIZES allows.
  TerminalWindow.prototype.fitViewport = function () {
    var el = this.element,
      doc = document.documentElement,
      width = doc.clientWidth,
      height = doc.clientHeight,
      m = this.metrics(),
      size = this.term.options.fontSize;
    // Cells grow in proportion to the font size, give or take rounding.
    size = Math.floor(
      size * Math.min((width - m.spare.x) / m.cells.width, (height - m.spare.y) / m.cells.height),
    );
    this.setFontSize(Math.max(MIN_FONT_SIZE, size));
    m = this.metrics();
    // The rounding may leave it a little too big.
    while (
      (m.frame.width > width || m.frame.height > height) &&
      this.term.options.fontSize > MIN_FONT_SIZE
    ) {
      this.setFontSize(this.term.options.fontSize - 1);
      m = this.metrics();
    }
    el.style.left = Math.max(0, Math.floor((width - m.frame.width) / 2)) + 'px';
    el.style.top = Math.max(0, Math.floor((height - m.frame.height) / 2)) + 'px';
  };

  // Call onMove on every mouse move until the button is released, then give the
  // terminal back the focus.
  TerminalWindow.prototype.track = function (onMove) {
    var self = this;
    this.stopTracking();
    this.tracking = new AbortController();
    var options = { signal: this.tracking.signal };
    document.addEventListener('mousemove', onMove, options);
    document.addEventListener(
      'mouseup',
      function () {
        self.stopTracking();
        if (self.term) self.term.focus();
      },
      options,
    );
  };

  TerminalWindow.prototype.stopTracking = function () {
    if (this.tracking) this.tracking.abort();
    this.tracking = null;
  };

  TerminalWindow.prototype.launch = function () {
    this.launched = true;
    // Ctrl-U first: it drops anything typed while no Game was running, so the
    // launcher reads just this line.
    this.emulator.serial0_send('\x15' + ROWS + ' ' + COLS + ' ' + this.options.command + '\n');
    if (this.options.refreshCode) {
      this.emulator.serial0_send(String.fromCharCode(this.options.refreshCode));
    }
  };

  TerminalWindow.prototype.output = function (chr) {
    this.tail = (this.tail + chr).slice(-READY.length);
    if (this.launched) {
      if (this.tail.slice(-END.length) === END) {
        this.launched = false;
        this.tail = '';
      }
    } else if (this.tail === READY) {
      // The Game ended and the launcher waits for a line: start the next one.
      this.tail = '';
      this.launched = true; // ignore output until the launch
      this.restartTimer = setTimeout(this.launch.bind(this), RESTART_DELAY_MS);
    }
  };

  TerminalWindow.prototype.fail = function (err) {
    console.log('TerminalWindow: the emulator could not start', err);
    (this.options.onError || noop)(err);
    this.close();
  };

  TerminalWindow.prototype.close = function () {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.restartTimer);
    window.removeEventListener('resize', this.onViewportResize);
    this.stopTracking();
    if (this.element) this.element.remove();
    var emulator = this.emulator,
      frame = this.frame;
    this.emulator =
      this.frame =
      this.element =
      this.term =
      this.themeTab =
      this.zoomInTab =
      this.zoomOutTab =
      this.maximizeTab =
        null;
    if (emulator) {
      // destroy() also disposes of the terminal.
      emulator
        .destroy()
        .catch(function (err) {
          console.log('TerminalWindow: destroy failed', err);
        })
        .then(function () {
          if (frame) frame.remove();
        });
    } else if (frame) {
      frame.remove();
    }
    (this.options.onClose || noop)();
  };

  window.TerminalWindow = TerminalWindow;
})(window);
