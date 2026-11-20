/* User JavaScript executes in a disposable Worker without DOM access. */
self.onmessage = (event) => {
  const code = String(event.data?.code ?? '');
  const send = (type, values) => self.postMessage({ type, text: values.map((value) => {
    try { return typeof value === 'string' ? value : JSON.stringify(value); }
    catch { return String(value); }
  }).join(' ') });
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = (...args) => send('stdout', args);
  console.info = (...args) => send('stdout', args);
  console.warn = (...args) => send('stderr', args);
  console.error = (...args) => send('stderr', args);
  try {
    const execute = new Function('console', 'self', 'postMessage', 'onmessage', 'close', 'setTimeout', 'setInterval', code);
    execute(console, self, self.postMessage.bind(self), null, self.close.bind(self), setTimeout, setInterval);
    send('done', ['Execution finished.']);
  } catch (error) {
    send('error', [error instanceof Error ? `${error.name}: ${error.message}` : String(error)]);
  } finally {
    Object.assign(console, original);
  }
};
