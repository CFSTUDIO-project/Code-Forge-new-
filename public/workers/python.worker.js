/* CODEFORGE Python worker. Pyodide is loaded off the UI thread to keep the editor responsive. */
let runtimePromise;
let pyodide;

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      importScripts('https://cdn.jsdelivr.net/pyodide/v314.0.8/full/pyodide.js');
      pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/' });
      pyodide.setStdout({ batched: (text) => self.postMessage({ type: 'stdout', text }) });
      pyodide.setStderr({ batched: (text) => self.postMessage({ type: 'stderr', text }) });
      self.postMessage({ type: 'ready', version: pyodide.version });
      return pyodide;
    })();
  }
  return runtimePromise;
}

self.onmessage = async (event) => {
  const { type, code } = event.data || {};
  if (type === 'run') {
    try {
      const runtime = await ensureRuntime();
      runtime.globals.set('__cf_source__', String(code ?? ''));
      await runtime.runPythonAsync("exec(compile(__cf_source__, '<CODEFORGE editor>', 'exec'))");
      self.postMessage({ type: 'done' });
    } catch (error) {
      self.postMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  } else if (type === 'load') {
    try { await ensureRuntime(); }
    catch (error) { self.postMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) }); }
  }
};
