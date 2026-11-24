/**
 * V86Socket: a stand-in for the Kaylee SockJS socket that tty.js talks to.
 *
 * It answers the messages the Terminal Window sends with a v86 emulator
 * restored from the Snapshot, and connects the terminal to its serial port:
 *
 *   attach -> restore the Snapshot, reply {msg: 'attach', status: 200}
 *   resize -> the first one launches the Command at that size; later ones
 *             are ignored (the terminal size is fixed for the whole game)
 *   tty    -> keystrokes go to serial0
 *   serial0 output -> {msg: 'tty', stream: <base64>}
 *
 * When the Command exits and the shell prompt comes back, the socket closes,
 * which closes the Terminal Window. close() destroys the emulator.
 *
 * Each emulator runs in its own hidden iframe, removed on close. With several
 * V86 instances created one after another in one page (v86 0.5.473), each
 * new guest stalls for a while after the Snapshot is restored, and the stall
 * doubles with every instance (1 s, 2 s, 5 s, 10 s, 20 s). A fresh iframe
 * per emulator gives v86 a fresh JS realm and the stall goes away.
 */
;(function(window) {

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

// The shell prompt on ttyS0, as saved in the Snapshot. busybox ash follows
// it with a cursor position query.
var PROMPT_RE = /localhost:~# (\x1b\[6n)?$/;

function V86Socket(options) {
  this.base = options.base;           // URL prefix of the VM files, ends in '/'
  this.command = options.command;
  this.onProgress = options.onProgress || function() {};

  this.frame = null;
  this.emulator = null;
  this.closed = false;
  this.launched = false;
  this.recent = '';                   // tail of the output since launch
  this.pending = '';                  // output not yet sent to the terminal
  this.flushScheduled = false;

  this.onopen = null;
  this.onmessage = null;
  this.onclose = null;

  var self = this;
  // tty.js sets the handlers right after creating the socket.
  setTimeout(function() {
    if (!self.closed && self.onopen) self.onopen();
  }, 0);
}

V86Socket.prototype.send = function(data) {
  if (this.closed) return;
  var msg = JSON.parse(data);
  switch (msg.msg) {
    case 'attach':
      this.attach();
      break;
    case 'resize':
      if (!this.launched && this.emulator) this.launch(msg.rows, msg.cols);
      break;
    case 'tty':
      if (this.launched) this.emulator.serial0_send(Base64.decode(msg.stream));
      break;
  }
};

V86Socket.prototype.reply = function(msg) {
  if (this.closed || !this.onmessage) return;
  this.onmessage({data: JSON.stringify(msg)});
};

V86Socket.prototype.attach = function() {
  var self = this;
  Promise.all([
    createFrame(this.base),
    import(this.base + 'config.mjs')
  ]).then(function(loaded) {
    var frame = loaded[0];
    if (self.closed) {
      frame.remove();
      return;
    }
    self.frame = frame;
    var config = loaded[1];
    var options = config.v86Options(self.base);
    options.initial_state = {url: config.snapshotUrl(self.base)};
    options.disable_keyboard = true;
    options.disable_mouse = true;

    var emulator = new frame.contentWindow.V86(options);
    self.emulator = emulator;
    emulator.add_listener('download-progress', function(e) {
      self.onProgress(e);
    });
    emulator.add_listener('serial0-output-byte', function(byte) {
      self.output(String.fromCharCode(byte));
    });
    emulator.add_listener('emulator-ready', function() {
      // Reply outside v86's callback: an error in the page's handlers must
      // not abort the emulator's start (autostart runs after this event).
      setTimeout(function() {
        self.reply({msg: 'attach', status: 200});
      }, 0);
    });
  }).catch(function(err) {
    console.log('V86Socket: attach failed', err);
    self.reply({msg: 'attach', status: 500, info: String(err)});
    self.close();
  });
};

V86Socket.prototype.launch = function(rows, cols) {
  this.launched = true;
  this.emulator.serial0_send(
    'stty rows ' + (rows | 0) + ' cols ' + (cols | 0) +
    '; clear; exec ' + this.command + '\n');
};

V86Socket.prototype.output = function(chr) {
  // Before launch, the serial port only carries what the Snapshot left behind.
  if (!this.launched) return;

  this.pending += chr;
  this.recent = (this.recent + chr).slice(-32);
  if (!this.flushScheduled) {
    this.flushScheduled = true;
    var self = this;
    setTimeout(function() { self.flush(); }, 0);
  }
};

V86Socket.prototype.flush = function() {
  this.flushScheduled = false;
  if (this.pending) {
    var data = this.pending;
    this.pending = '';
    this.reply({msg: 'tty', stream: Base64.encode(data)});
  }
  // The Command exited: init respawned the shell on ttyS0. (The launch line
  // is sent at a prompt that was printed before the Snapshot, so the first
  // prompt seen after launch is the one after the Command.)
  if (PROMPT_RE.test(this.recent)) {
    this.close();
  }
};

V86Socket.prototype.close = function() {
  if (this.closed) return;
  this.closed = true;
  var emulator = this.emulator
    , frame = this.frame;
  this.emulator = null;
  this.frame = null;
  if (emulator) {
    emulator.destroy().catch(function(err) {
      console.log('V86Socket: destroy failed', err);
    }).then(function() {
      if (frame) frame.remove();
    });
  } else if (frame) {
    frame.remove();
  }
  var self = this;
  setTimeout(function() {
    if (self.onclose) self.onclose();
  }, 0);
};

window.V86Socket = V86Socket;

})(window);
