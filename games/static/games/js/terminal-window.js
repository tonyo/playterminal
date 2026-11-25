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
;(function(window, $) {

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
  convertEol: false,  // the guest's tty already sends \r\n
  fontFamily: '"DejaVu Sans Mono", "Liberation Mono", monospace',
  fontSize: 14,
  theme: {background: '#000000', foreground: '#f0f0f0'}
};

// A monochrome phosphor palette: every ANSI color is a shade of one hue.
function phosphor(bg, dark, dim, fg, bright) {
  return {
    background: bg, foreground: fg, cursor: fg, cursorAccent: bg,
    selectionBackground: dim,
    black: dark, red: dim, green: fg, yellow: fg,
    blue: dim, magenta: dim, cyan: fg, white: fg,
    brightBlack: dim, brightRed: fg, brightGreen: bright, brightYellow: bright,
    brightBlue: fg, brightMagenta: fg, brightCyan: bright, brightWhite: bright
  };
}

// The themes the bar's ◐ cycles through. crt adds scanlines and glow.
var THEMES = [
  {name: 'classic', title: 'Classic', crt: false, colors: TERMINAL_OPTIONS.theme},
  {name: 'green', title: 'Green phosphor', crt: true,
   colors: phosphor('#031006', '#0c3315', '#1f9940', '#33ff66', '#99ffbb')},
  {name: 'amber', title: 'Amber phosphor', crt: true,
   colors: phosphor('#120a00', '#3d2600', '#b37a00', '#ffb000', '#ffd780')}
];

var THEME_KEY = 'playterminal.theme';

function savedTheme() {
  var name;
  try { name = window.localStorage.getItem(THEME_KEY); } catch (e) {}
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].name === name) return THEMES[i];
  }
  return THEMES[0];
}

function saveTheme(theme) {
  try { window.localStorage.setItem(THEME_KEY, theme.name); } catch (e) {}
}

// The font sizes the bar's − and + step through; the default is TERMINAL_OPTIONS'.
var FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];
var FONT_SIZE_KEY = 'playterminal.fontSize';

function savedFontSize() {
  var size;
  try { size = parseInt(window.localStorage.getItem(FONT_SIZE_KEY), 10); } catch (e) {}
  return FONT_SIZES.indexOf(size) >= 0 ? size : TERMINAL_OPTIONS.fontSize;
}

function saveFontSize(size) {
  try { window.localStorage.setItem(FONT_SIZE_KEY, String(size)); } catch (e) {}
}

// A hidden iframe with libv86.js loaded; resolves to the iframe.
function createFrame(base) {
  return new Promise(function(resolve, reject) {
    var frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.setAttribute('aria-hidden', 'true');
    frame.srcdoc = '<!DOCTYPE html><script src="' + base + 'libv86.js"><\/script>';
    frame.onload = function() {
      if (frame.contentWindow && frame.contentWindow.V86) {
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
  this.launched = false;  // a Command is running
  this.tail = '';         // the last bytes from ttyS0, to spot END and READY
  this.resizeTimer = null;
  this.start();
}

TerminalWindow.prototype.start = function() {
  var self = this
    , base = this.options.base;
  Promise.all([
    createFrame(base),
    import(base + 'config.mjs')
  ]).then(function(loaded) {
    var frame = loaded[0]
      , config = loaded[1];
    if (self.closed) {
      frame.remove();
      return;
    }
    self.frame = frame;
    var options = config.v86Options(base);
    options.initial_state = {url: config.snapshotUrl(base)};
    options.disable_keyboard = true;
    options.disable_mouse = true;

    var emulator = new frame.contentWindow.V86(options);
    self.emulator = emulator;
    emulator.add_listener('download-progress', self.options.onProgress || noop);
    emulator.add_listener('serial0-output-byte', function(byte) {
      self.output(String.fromCharCode(byte));
    });
    emulator.add_listener('emulator-ready', function() {
      // Open outside v86's callback: an error in the page's code must not
      // abort the emulator's start (autostart runs after this event).
      setTimeout(function() { self.open(); }, 0);
    });
  }).catch(function(err) {
    self.fail(err);
  });
};

TerminalWindow.prototype.open = function() {
  if (this.closed) return;
  var self = this;

  var close = $('<div class="tab" title="Close terminal">✖</div>')
    .on('click', function() { self.close(); });
  this.zoomOutTab = $('<div class="tab" title="Smaller text">−</div>')
    .on('click', function() { self.zoom(-1, this); });
  this.zoomInTab = $('<div class="tab" title="Larger text">+</div>')
    .on('click', function() { self.zoom(1, this); });
  this.themeTab = $('<div class="tab">◐</div>')
    .on('click', function() { self.nextTheme(); });
  var bar = $('<div class="bar">')
    .append(close, $('<div class="title">').text(this.options.command),
            this.zoomOutTab, this.zoomInTab, this.themeTab);
  var screen = $('<div class="screen">');
  var grip = $('<div class="grip" title="Resize">');
  this.element = $('<div class="window">').append(bar, screen, grip).appendTo(document.body);
  this.draggable(bar);
  this.resizable(grip);

  // v86 creates the terminal with its own options: add ours, keep the instance.
  function Terminal(options) {
    self.term = new window.Terminal($.extend({}, options, TERMINAL_OPTIONS));
    return self.term;
  }
  this.emulator.set_serial_container_xtermjs(screen[0], Terminal);
  this.setTheme(savedTheme());
  this.setFontSize(savedFontSize());
  this.term.focus();

  this.launch();
  (this.options.onOpen || noop)();
};

TerminalWindow.prototype.setTheme = function(theme) {
  this.theme = theme;
  this.term.options.theme = theme.colors;
  this.element
    .removeClass(THEMES.map(function(t) { return 'theme-' + t.name; }).join(' '))
    .addClass('theme-' + theme.name)
    .toggleClass('crt', theme.crt);
  this.themeTab.attr('title', 'Theme: ' + theme.title + ' (click to change)');
};

TerminalWindow.prototype.nextTheme = function() {
  var theme = THEMES[(THEMES.indexOf(this.theme) + 1) % THEMES.length];
  this.setTheme(theme);
  saveTheme(theme);
  this.term.focus();
};

TerminalWindow.prototype.setFontSize = function(size) {
  this.term.options.fontSize = size;
  var i = FONT_SIZES.indexOf(size);
  this.zoomOutTab.toggleClass('disabled', i === 0);
  this.zoomInTab.toggleClass('disabled', i === FONT_SIZES.length - 1);
};

// Step the font size; the terminal keeps its rows and columns. The window grows or
// shrinks, so move it to keep the clicked button under the pointer for the next click.
TerminalWindow.prototype.zoom = function(step, tab) {
  var i = FONT_SIZES.indexOf(this.term.options.fontSize) + step;
  if (i >= 0 && i < FONT_SIZES.length) {
    var before = tab.getBoundingClientRect().left;
    this.setFontSize(FONT_SIZES[i]);
    saveFontSize(FONT_SIZES[i]);
    var left = this.element.position().left + before - tab.getBoundingClientRect().left;
    this.element.css('left', Math.max(0, left));  // but keep the window on the page
  }
  this.term.focus();
};

// Drag the window by its bar.
TerminalWindow.prototype.draggable = function(bar) {
  var self = this
    , el = this.element;
  bar.on('mousedown', function(ev) {
    if ($(ev.target).is('.tab')) return;
    ev.preventDefault();
    var start = el.position()
      , x = ev.pageX
      , y = ev.pageY;
    $(document).on('mousemove.terminal-window', function(ev) {
      // Not above the top of the page, where the bar could not be grabbed again.
      el.css({left: start.left + ev.pageX - x,
              top: Math.max(0, start.top + ev.pageY - y)});
    }).on('mouseup.terminal-window', function() {
      $(document).off('.terminal-window');
      if (self.term) self.term.focus();
    });
  });
};

// Resize the terminal by dragging the grip, in whole cells, within the page.
TerminalWindow.prototype.resizable = function(grip) {
  var self = this;
  grip.on('mousedown', function(ev) {
    ev.preventDefault();
    var cells = self.element.find('.xterm-screen')
      , cellWidth = cells.width() / self.cols
      , cellHeight = cells.height() / self.rows
      , start = {cols: self.cols, rows: self.rows, x: ev.pageX, y: ev.pageY}
      , offset = self.element.offset()
      , spare = {  // room for the window's frame around the cells
          x: self.element.outerWidth() - cells.width(),
          y: self.element.outerHeight() - cells.height()
        }
      , maxCols = Math.max(COLS, Math.floor(
          ($(document).width() - offset.left - spare.x) / cellWidth))
      , maxRows = Math.max(ROWS, Math.floor(
          ($(window).height() + $(window).scrollTop() - offset.top - spare.y) / cellHeight));
    $(document).on('mousemove.terminal-window', function(ev) {
      var cols = start.cols + Math.round((ev.pageX - start.x) / cellWidth)
        , rows = start.rows + Math.round((ev.pageY - start.y) / cellHeight);
      self.resize(
        Math.min(maxCols, Math.max(COLS, cols)),
        Math.min(maxRows, Math.max(ROWS, rows)));
    }).on('mouseup.terminal-window', function() {
      $(document).off('.terminal-window');
      if (self.term) self.term.focus();
    });
  });
};

TerminalWindow.prototype.resize = function(cols, rows) {
  if (cols === this.cols && rows === this.rows) return;
  this.cols = cols;
  this.rows = rows;
  this.term.resize(cols, rows);
  // Tell the guest after the drag settles: each size is a SIGWINCH and a redraw.
  var self = this;
  clearTimeout(this.resizeTimer);
  this.resizeTimer = setTimeout(function() {
    if (self.emulator) {
      self.emulator.serial_send_bytes(1,
        new TextEncoder().encode(self.rows + ' ' + self.cols + '\n'));
    }
  }, 100);
};

TerminalWindow.prototype.launch = function() {
  this.launched = true;
  // Ctrl-U first: it drops anything typed while no Game was running, so the
  // launcher reads just this line.
  this.emulator.serial0_send(
    '\x15' + this.rows + ' ' + this.cols + ' ' + this.options.command + '\n');
  if (this.options.refreshCode) {
    this.emulator.serial0_send(String.fromCharCode(this.options.refreshCode));
  }
};

TerminalWindow.prototype.output = function(chr) {
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

TerminalWindow.prototype.fail = function(err) {
  console.log('TerminalWindow: the emulator could not start', err);
  (this.options.onError || noop)(err);
  this.close();
};

TerminalWindow.prototype.close = function() {
  if (this.closed) return;
  this.closed = true;
  clearTimeout(this.resizeTimer);
  $(document).off('.terminal-window');
  if (this.element) this.element.remove();
  var emulator = this.emulator
    , frame = this.frame;
  this.emulator = this.frame = this.element = this.term = this.themeTab = this.zoomInTab = this.zoomOutTab = null;
  if (emulator) {
    // destroy() also disposes of the terminal.
    emulator.destroy().catch(function(err) {
      console.log('TerminalWindow: destroy failed', err);
    }).then(function() {
      if (frame) frame.remove();
    });
  } else if (frame) {
    frame.remove();
  }
  (this.options.onClose || noop)();
};

window.TerminalWindow = TerminalWindow;

})(window, jQuery);
