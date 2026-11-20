export type WorkspaceFile = { id: string; name: string; path: string; content: string; language?: string };

export const starterFiles: WorkspaceFile[] = [
  {
    id: 'index-html', name: 'index.html', path: '/index.html', language: 'html',
    content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>My CODEFORGE project</title>\n</head>\n<body>\n  <main class="hero">\n    <span class="eyebrow">BUILT WITH CODEFORGE</span>\n    <h1>Hello, developer.</h1>\n    <p>Your workspace is ready. Start building something meaningful.</p>\n    <button id="launch">Explore the preview</button>\n    <small id="status">JavaScript is connected.</small>\n  </main>\n</body>\n</html>`,
  },
  {
    id: 'style-css', name: 'style.css', path: '/style.css', language: 'css',
    content: `:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui; }\n* { box-sizing: border-box; }\nbody { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 20% 0%, #272346, #0d1018 55%); color: #f4f3fa; }\n.hero { width: min(680px, 90vw); padding: 52px; border: 1px solid #ffffff20; border-radius: 24px; background: #171a24cc; box-shadow: 0 28px 90px #0008; }\n.eyebrow { color: #a996ff; letter-spacing: .18em; font-size: 11px; font-weight: 700; }\nh1 { font-size: clamp(36px, 7vw, 64px); letter-spacing: -.06em; margin: 18px 0 12px; }\np { color: #a9afc0; line-height: 1.7; }\nbutton { margin-top: 20px; padding: 12px 18px; border: 0; border-radius: 10px; background: #8270f3; color: white; font-weight: 700; cursor: pointer; }\nsmall { display: block; margin-top: 18px; color: #828a9b; }`,
  },
  {
    id: 'script-js', name: 'script.js', path: '/script.js', language: 'javascript',
    content: `const button = document.querySelector('#launch');\nconst status = document.querySelector('#status');\n\nbutton?.addEventListener('click', () => {\n  status.textContent = 'Preview interaction is working.';\n  console.log('CODEFORGE preview event fired');\n});`,
  },
  {
    id: 'main-py', name: 'main.py', path: '/main.py', language: 'python',
    content: `project = "CODEFORGE"\nprint(f"Hello from {project}!")\n\nfor step in range(1, 4):\n    print(f"Runtime check {step}: ready")`,
  },
  {
    id: 'readme-md', name: 'README.md', path: '/README.md', language: 'markdown',
    content: `# My CODEFORGE project\n\nWelcome to your workspace.\n\n- Edit files in the Explorer.\n- Run **index.html** using Live Preview.\n- Run **main.py** with the browser Python runtime.\n\n> Python uses Pyodide/WebAssembly in this web starter. Native runtimes for C, Rust, Java and other languages are not bundled yet.`,
  },
  {
    id: 'workflow-yml', name: 'ci.yml', path: '/.github/workflows/ci.yml', language: 'yaml',
    content: `name: CODEFORGE CI\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\njobs:\n  web-check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: npm run build`,
  },
];

export function newFile(name: string): WorkspaceFile {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name, path: `/${name.replace(/^\/+/, '')}`, content: '', language: extension };
}
