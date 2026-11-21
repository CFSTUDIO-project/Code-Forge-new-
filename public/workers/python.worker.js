/* CODEFORGE Python worker.
 * Pyodide runs in a dedicated worker so Python execution does not block the UI.
 * The previous v314.0.8 URL was invalid; Pyodide uses semantic versions (0.x.y).
 */

const PYODIDE_VERSION = '0.27.7';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let runtimePromise = null;
let pyodide = null;

async function ensureRuntime() {
  if (pyodide) return pyodide;

  if (!runtimePromise) {
    runtimePromise = (async () => {
      // importScripts is supported in classic dedicated workers.
      // Keep the loader and indexURL on the same pinned release.
      if (typeof self.loadPyodide !== 'function') {
        importScripts(`${PYODIDE_CDN}pyodide.js`);
      }

      if (typeof self.loadPyodide !== 'function') {
        throw new Error('Pyodide loader did not initialize. Check network access or CDN availability.');
      }

      const runtime = await self.loadPyodide({ indexURL: PYODIDE_CDN });
      runtime.setStdout({ batched: (text) => self.postMessage({ type: 'stdout', text }) });
      runtime.setStderr({ batched: (text) => self.postMessage({ type: 'stderr', text }) });
      pyodide = runtime;
      self.postMessage({ type: 'ready', version: runtime.version });
      return runtime;
    })().catch((error) => {
      // Permit a later Run attempt to retry after a transient network failure.
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
}

self.onmessage = async (event) => {
  const { type, code } = event.data || {};
  if (type !== 'run' && type !== 'load') return;

  try {
    const runtime = await ensureRuntime();
    if (type === 'load') {
      self.postMessage({ type: 'done' });
      return;
    }

    runtime.globals.set('__cf_source__', String(code ?? ''));
    await runtime.runPythonAsync(
      "exec(compile(__cf_source__, '<CODEFORGE editor>', 'exec'))",
    );
    self.postMessage({ type: 'done' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      text: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
};
