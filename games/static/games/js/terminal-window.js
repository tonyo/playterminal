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
 * Each emulator runs in its own hidden iframe, removed on close. With several
 * V86 instances created one after another in one page (v86 0.5.473), each
 * new guest stalls for a while after the Snapshot is restored, and the stall
 * doubles with every instance (1 s, 2 s, 5 s, 10 s, 20 s). A fresh iframe
 * per emulator gives v86 a fresh JS realm and the stall goes away.
 */
;(function(window, $) {

// The terminal size is fixed for the whole Game.
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
  this.closed = false;
  this.launched = false;  // a Command is running
  this.tail = '';         // the last bytes from ttyS0, to spot END and READY
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
  var bar = $('<div class="bar">')
    .append(close, $('<div class="title">').text(this.options.command));
  var screen = $('<div class="screen">');
  this.element = $('<div class="window">').append(bar, screen).appendTo(document.body);
  this.draggable(bar);

  // v86 creates the terminal with its own options: add ours, keep the instance.
  function Terminal(options) {
    self.term = new window.Terminal($.extend({}, options, TERMINAL_OPTIONS));
    return self.term;
  }
  this.emulator.set_serial_container_xtermjs(screen[0], Terminal);
  this.term.focus();

  this.launch();
  (this.options.onOpen || noop)();
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
      el.css({left: start.left + ev.pageX - x, top: start.top + ev.pageY - y});
    }).on('mouseup.terminal-window', function() {
      $(document).off('.terminal-window');
      if (self.term) self.term.focus();
    });
  });
};

TerminalWindow.prototype.launch = function() {
  this.launched = true;
  // Ctrl-U first: it drops anything typed while no Game was running, so the
  // launcher reads just this line.
  this.emulator.serial0_send(
    '\x15' + ROWS + ' ' + COLS + ' ' + this.options.command + '\n');
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
  $(document).off('.terminal-window');
  if (this.element) this.element.remove();
  var emulator = this.emulator
    , frame = this.frame;
  this.emulator = this.frame = this.element = this.term = null;
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
