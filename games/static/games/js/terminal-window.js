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
 * opens, and again on READY after END, so a finished Game restarts in the
 * same window. Only ✖ closes the window and destroys the emulator.
 *
 * The corner grip resizes the terminal in whole cells. The window sends the
 * new size as "<rows> <cols>" on serial1, where the guest sets ttyS0's size
 * and the Game gets SIGWINCH (vm/image/playterminal-resize).
 *
 * Each emulator runs in its own hidden iframe, removed on close. With several
 * V86 instances created one after another in one page (v86 0.5.473), each
 * new guest stalls for a while after the Snapshot is restored, and the stall
 * doubles with every instance (1 s, 2 s, 5 s, 10 s, 20 s). A fresh iframe
 * per emulator gives v86 a fresh JS realm and the stall goes away.
 */
(function (window) {
  // The terminal starts at this size and can't be resized below it: most
  // terminal games need at least 80x24.
  var ROWS = 24;
  var COLS = 80;

  // Printed by the launcher.
  var END = '\x1b]777;playterminal;exit\x07';
  var READY = '\x1b]777;playterminal;ready\x07';

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

  // A hidden iframe with libv86.js loaded; resolves to the iframe.
  function createFrame(base) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.setAttribute('aria-hidden', 'true');
      frame.srcdoc = '<!DOCTYPE html><script src="' + base + 'libv86.js"></script>';
      frame.onload = function () {
        if (frame.contentWindow?.V86) {
          resolve(frame);
        } else {
          frame.remove();
          reject(new Error('could not load ' + base + 'libv86.js'));
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
    this.rows = ROWS;
    this.cols = COLS;
    this.theme = null;
    this.themeTab = this.zoomInTab = this.zoomOutTab = null;
    this.closed = false;
    this.launched = false; // a Command is running
    this.tail = ''; // the last bytes from ttyS0, to spot END and READY
    this.resizeTimer = null;
    this.start();
  }

  TerminalWindow.prototype.start = function () {
    var self = this,
      base = this.options.base;
    Promise.all([createFrame(base), import(base + 'config.mjs')])
      .then(function (loaded) {
        var frame = loaded[0],
          config = loaded[1];
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
    var bar = div('bar', [
      close,
      div('title', this.options.command),
      this.zoomOutTab,
      this.zoomInTab,
      this.themeTab,
    ]);
    var screen = div('screen');
    var grip = div('grip');
    grip.title = 'Resize';
    this.element = document.body.appendChild(div('window', [bar, screen, grip]));
    this.draggable(bar);
    this.resizable(grip);

    // v86 creates the terminal with its own options: add ours, keep the instance.
    function Terminal(options) {
      self.term = new window.Terminal(Object.assign({}, options, TERMINAL_OPTIONS));
      return self.term;
    }
    this.emulator.set_serial_container_xtermjs(screen, Terminal);
    this.setTheme(savedTheme());
    this.setFontSize(savedFontSize());
    this.term.focus();

    this.launch();
    (this.options.onOpen || noop)();
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

  TerminalWindow.prototype.setFontSize = function (size) {
    this.term.options.fontSize = size;
    var i = FONT_SIZES.indexOf(size);
    this.zoomOutTab.classList.toggle('disabled', i === 0);
    this.zoomInTab.classList.toggle('disabled', i === FONT_SIZES.length - 1);
  };

  // Step the font size; the terminal keeps its rows and columns. The window grows or
  // shrinks, so move it to keep the clicked button under the pointer for the next click.
  TerminalWindow.prototype.zoom = function (step, tab) {
    var i = FONT_SIZES.indexOf(this.term.options.fontSize) + step,
      before,
      left;
    if (i >= 0 && i < FONT_SIZES.length) {
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
      if (ev.target.classList.contains('tab')) return;
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

  // Resize the terminal by dragging the grip, in whole cells, within the page.
  TerminalWindow.prototype.resizable = function (grip) {
    var self = this;
    grip.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      var cells = self.element.querySelector('.xterm-screen').getBoundingClientRect(),
        frame = self.element.getBoundingClientRect(),
        cellWidth = cells.width / self.cols,
        cellHeight = cells.height / self.rows,
        start = { cols: self.cols, rows: self.rows, x: ev.pageX, y: ev.pageY },
        // room for the window's frame around the cells
        spare = { x: frame.width - cells.width, y: frame.height - cells.height },
        maxCols = Math.max(
          COLS,
          Math.floor(
            (document.documentElement.scrollWidth - (frame.left + window.scrollX) - spare.x) /
              cellWidth,
          ),
        ),
        // down to the bottom of the viewport
        maxRows = Math.max(
          ROWS,
          Math.floor((document.documentElement.clientHeight - frame.top - spare.y) / cellHeight),
        );
      self.track(function (ev) {
        var cols = start.cols + Math.round((ev.pageX - start.x) / cellWidth),
          rows = start.rows + Math.round((ev.pageY - start.y) / cellHeight);
        self.resize(
          Math.min(maxCols, Math.max(COLS, cols)),
          Math.min(maxRows, Math.max(ROWS, rows)),
        );
      });
    });
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

  TerminalWindow.prototype.resize = function (cols, rows) {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols;
    this.rows = rows;
    this.term.resize(cols, rows);
    // Tell the guest after the drag settles: each size is a SIGWINCH and a redraw.
    var self = this;
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(function () {
      if (self.emulator) {
        self.emulator.serial_send_bytes(
          1,
          new TextEncoder().encode(self.rows + ' ' + self.cols + '\n'),
        );
      }
    }, 100);
  };

  TerminalWindow.prototype.launch = function () {
    this.launched = true;
    // Ctrl-U first: it drops anything typed while no Game was running, so the
    // launcher reads just this line.
    this.emulator.serial0_send(
      '\x15' + this.rows + ' ' + this.cols + ' ' + this.options.command + '\n',
    );
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
      this.launch();
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
    clearTimeout(this.resizeTimer);
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
