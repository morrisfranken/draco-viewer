// Reads files that live on a gvfs sftp mount (/run/user/<uid>/gvfs/sftp:host=...) directly
// over one compressed SSH session instead of through the FUSE mount: OBJ text compresses
// ~3x, and the mount is slow for large files. Uses the user's ssh config and keys; never
// prompts (BatchMode), so callers can simply fall back to the mount when this fails.
const { spawn } = require('child_process');

/** { host, port, user, path } for a file on a gvfs sftp mount, or null. */
function gvfsSftpTarget(filePath) {
  const m = /^\/run\/user\/\d+\/gvfs\/sftp:([^/]+)(\/.*)$/.exec(filePath);
  if (!m) return null;
  const spec = Object.fromEntries(m[1].split(',').map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i), decodeURIComponent(kv.slice(i + 1))];
  }));
  return spec.host ? { host: spec.host, port: spec.port, user: spec.user, path: m[2] } : null;
}

// Remote side: answer one request per line ("cat|head|tail <n> <path>") with
// "<size>\n<bytes>", or "-1" when the file can't be read. POSIX sh only, and no single
// quotes or '!' so it survives any login shell.
const SERVER = [
  'while read -r op n p; do',
  '  if [ -f "$p" ] && [ -r "$p" ]; then',
  '    s=$(( $(wc -c < "$p") ))',
  '    case $op in',
  '      head) [ "$s" -gt "$n" ] && s=$n; echo "$s"; head -c "$s" "$p";;',
  '      tail) s=$(( s > n ? s - n : 0 )); echo "$s"; tail -c "$s" "$p";;',
  '      *) echo "$s"; cat "$p";;',
  '    esac',
  '  else echo -1; fi',
  'done',
].join('\n');

class SshFileSource {
  constructor({ host, port, user }) {
    const args = ['-C', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5'];
    if (port) args.push('-p', port);
    args.push(user ? `${user}@${host}` : host, `exec sh -c '${SERVER}'`);
    this.proc = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'ignore'] });
    this.queue = []; // pending { resolve, reject }, answered in order
    this.buffer = Buffer.alloc(0);
    this.expect = null; // { size, chunks, received } while reading a body
    this.failed = null;
    this.proc.stdout.on('data', (chunk) => this.onData(chunk));
    const fail = (err) => {
      this.failed = err;
      for (const task of this.queue.splice(0)) task.reject(err);
    };
    this.proc.on('error', fail);
    this.proc.on('close', (code) => fail(new Error(`ssh exited with code ${code}`)));
    this.proc.stdin.on('error', () => {});
  }

  /** Read (part of) a remote file: op is 'cat', 'head' (first n bytes) or 'tail' (from n). */
  get(op, path, n = 0) {
    if (this.failed) return Promise.reject(this.failed);
    if (/[\n\r]/.test(path)) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.proc.stdin.write(`${op} ${n} ${path}\n`);
    });
  }

  onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      if (!this.expect) {
        const nl = this.buffer.indexOf(10);
        if (nl < 0) return;
        const size = Number(this.buffer.subarray(0, nl).toString());
        this.buffer = this.buffer.subarray(nl + 1);
        if (!(size >= 0)) { this.queue.shift()?.resolve(null); continue; }
        this.expect = { size, data: Buffer.allocUnsafe(size), received: 0 };
      }
      const e = this.expect;
      const take = Math.min(e.size - e.received, this.buffer.length);
      this.buffer.copy(e.data, e.received, 0, take);
      e.received += take;
      this.buffer = this.buffer.subarray(take);
      if (e.received < e.size) return;
      this.expect = null;
      this.queue.shift()?.resolve(e.data);
    }
  }

  close() {
    this.proc.stdin.end();
  }
}

module.exports = { gvfsSftpTarget, SshFileSource };
