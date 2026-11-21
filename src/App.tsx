import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ChangeEvent } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, Position as MonacoPosition } from 'monaco-editor';
import type { User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import {
  Activity, AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bell, Blocks,
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp,
  Cloud, CloudUpload, Command, ExternalLink, Eye, FileCode2, FilePlus2, FileText, Folder, FolderOpen, GitBranch, GitCommit,
  Github, Globe, HardDrive, Keyboard, LayoutPanelLeft, ListFilter,
  LogOut, Menu, MessageSquare, Monitor, MoreHorizontal, PanelRight,
  Play, Plus, Puzzle, RefreshCw, Search, Settings, ShieldCheck, Sparkles,
  Terminal, Trash2, UserCircle2, X, Zap, CircleDot, GitPullRequest,
  Download, Upload, Columns2, Square,
} from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { firebaseConfigured } from './lib/firebase';
import { languageForFile } from './lib/language';
import { exportWorkspaceJson, exportWorkspaceZip, importWorkspaceFile } from './lib/archive';
import { clearWorkspace, loadWorkspace, saveWorkspace } from './lib/persistence';
import { loadWorkspaceFromCloud, syncWorkspaceToCloud } from './lib/cloud';
import { newFile, starterFiles, type WorkspaceFile } from './lib/workspace';

type ActivityView = 'explorer' | 'search' | 'git' | 'run' | 'extensions' | 'workflows';
type PanelTab = 'terminal' | 'problems' | 'output' | 'debug';
type TerminalLine = { id: number; kind: 'command' | 'stdout' | 'stderr' | 'info' | 'success'; text: string };
type GuestProfile = { name: string; handle: string; hue: number; initials: string };

const profileNames = ['Nova Circuit', 'Arden Vale', 'Mika Rowan', 'Sora Bennett', 'Riven Clarke', 'Aster Quinn', 'Kairo Finch', 'Eden Park'];
const marketplaceItems = [
  { id: 'one-dark', name: 'One Dark Pro', category: 'Themes', description: 'A balanced dark palette for long coding sessions.', publisher: 'CODEFORGE Community', downloads: '12.4k', tag: 'Theme' },
  { id: 'material-icons', name: 'Material File Icons', category: 'Appearance', description: 'Clear, recognizable icons for common project files.', publisher: 'Community Studio', downloads: '9.8k', tag: 'Icons' },
  { id: 'prettier', name: 'Prettier Formatter', category: 'Productivity', description: 'Consistent formatting for supported web languages.', publisher: 'Prettier', downloads: '8.2k', tag: 'Formatter' },
  { id: 'git-graph', name: 'Git Graph View', category: 'Git', description: 'A visual history panel for connected repositories.', publisher: 'CODEFORGE Community', downloads: '5.6k', tag: 'Git' },
  { id: 'python-tools', name: 'Python Essentials', category: 'Languages', description: 'Python snippets and editor helpers for the browser runtime.', publisher: 'CODEFORGE', downloads: '4.9k', tag: 'Language' },
  { id: 'rest-client', name: 'REST Client', category: 'Productivity', description: 'Compose and inspect HTTP requests in a workspace.', publisher: 'Community Studio', downloads: '3.1k', tag: 'API' },
];

function makeGuestProfile(): GuestProfile {
  const name = profileNames[Math.floor(Math.random() * profileNames.length)];
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return { name, handle: `guest-${Math.random().toString(36).slice(2, 7)}`, hue: Math.floor(Math.random() * 360), initials };
}

function Avatar({ name, hue = 260, initials }: { name: string; hue?: number; initials?: string }) {
  const letters = initials ?? name.split(/[ @._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <div className="avatar" style={{ ['--avatar-hue' as string]: hue } as CSSProperties}>{letters}</div>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}>
    <img src={`${import.meta.env.BASE_URL}icons/codeforge-mark.svg`} alt="" className="brand-mark" />
    {!compact && <span className="brand-word">CODE<span>FORGE</span></span>}
  </div>;
}

function LoginScreen({ onGuest }: { onGuest: (profile: GuestProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error_description') || params.get('error') || params.get('error_code');
    if (oauthError) {
      setNotice(oauthError.replace(/\+/g, ' '));
      params.delete('error');
      params.delete('error_description');
      params.delete('error_code');
      const nextUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    if (!supabase) {
      setNotice('Supabase belum dikonfigurasi. Gunakan Guest Mode atau isi .env sesuai README.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setNotice('Akun dibuat. Periksa email untuk konfirmasi sebelum masuk.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: 'github' | 'google') => {
    if (!supabase) return setNotice('Hubungkan Supabase dan aktifkan provider OAuth terlebih dahulu.');
    if (Capacitor.isNativePlatform()) {
      setNotice('OAuth di APK memerlukan konfigurasi deep-link callback. Gunakan email/password untuk build ini; panduan ada di README.');
      return;
    }

    setNotice('');
    setBusy(true);
    // A guest session is local UI state, not a Supabase identity. Remove its marker
    // before redirecting so it cannot mask the authenticated session on return.
    sessionStorage.removeItem('cf-guest-profile');
    sessionStorage.setItem('cf-oauth-pending', provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: new URL('/', window.location.origin).toString(),
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
      if (error) throw error;
      // Supabase performs the browser redirect. Keep the busy state until navigation.
    } catch (error) {
      sessionStorage.removeItem('cf-oauth-pending');
      setBusy(false);
      setNotice(error instanceof Error ? error.message : 'OAuth sign-in failed.');
    }
  };

  const resetPassword = async () => {
    if (!supabase) return setNotice('Supabase belum dikonfigurasi.');
    if (!email.trim()) return setNotice('Masukkan email terlebih dahulu.');
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
      setNotice('Link pemulihan password dikirim jika email terdaftar.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not send reset link.');
    } finally { setBusy(false); }
  };

  return <div className="login-shell">
    <header className="login-topbar">
      <Brand />
      <div className="login-top-actions">
        <span className="top-pill"><Github size={13} /> Open Source</span>
        <span className="top-pill"><ShieldCheck size={13} /> Secure workspace</span>
        <button className="icon-button" title="Settings" onClick={() => setNotice('Application settings are available after entering the workspace.')}><Settings size={17} /></button>
      </div>
    </header>
    <main className="login-main">
      <div className="login-intro"><div className="eyebrow"><span className="pulse-dot" /> OPEN-SOURCE DEVELOPMENT WORKBENCH</div><h1>Forge your vision.<br /><span>Connect and code.</span></h1><p>A focused workspace for building, testing and shipping ideas.</p></div>
      <section className="login-card">
        <div className="login-card-brand"><img src={`${import.meta.env.BASE_URL}icons/codeforge-mark.svg`} alt="CODEFORGE logo" /><div><strong>CODEFORGE</strong><span>OPEN-SOURCE IDE</span></div></div>
        <p className="login-tagline">Your next idea starts here.</p>
        <div className="login-columns">
          <form className="login-form" onSubmit={submit}>
            <div className="form-heading"><div><h2>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h2><p>{mode === 'signin' ? 'Sign in to your workspace' : 'Start your developer workspace'}</p></div><span className="secure-lock"><ShieldCheck size={15} /></span></div>
            <label>Email address<input type="email" required autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} title={showPassword ? 'Hide password' : 'Show password'}><Eye size={15} /></button></div></label>
            <div className="login-meta"><label className="remember"><input type="checkbox" defaultChecked /> <span>Remember me</span></label><button type="button" className="text-button" onClick={resetPassword}>Forgot password?</button></div>
            <button className="primary-button login-submit" disabled={busy} type="submit">{busy ? <span className="spinner" /> : null}{mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></button>
            <div className="switch-auth">{mode === 'signin' ? 'New to CODEFORGE?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice(''); }}>{mode === 'signin' ? 'Create account' : 'Sign in'}</button></div>
          </form>
          <div className="social-column">
            <div className="or-label"><span /> <small>OR CONTINUE WITH</small> <span /></div>
            <button className="social-button" onClick={() => social('github')} disabled={busy}><Github size={18} /><span><b>Continue with GitHub</b><small>Connect your developer identity</small></span><ChevronRight size={15} /></button>
            <button className="social-button" onClick={() => social('google')} disabled={busy}><span className="google-g">G</span><span><b>Continue with Google</b><small>Quick and secure access</small></span><ChevronRight size={15} /></button>
            <div className="guest-divider"><span /> <small>OR EXPLORE FIRST</small> <span /></div>
            <button className="guest-button" onClick={() => setShowGuestWarning(true)}><UserCircle2 size={18} /><span><b>Guest Mode</b><small>Try the workspace without an account</small></span><ArrowRight size={15} /></button>
            {!supabaseConfigured && <div className="config-hint"><AlertCircle size={14} /> Cloud sign-in is inactive until Supabase is configured.</div>}
          </div>
        </div>
        {notice && <div className="notice-line"><AlertCircle size={14} />{notice}</div>}
      </section>
      <div className="login-footnote"><span>v2.0.0 · OPEN SOURCE</span><span>Built for creators and developers</span><span>Documentation · Privacy</span></div>
    </main>
    {showGuestWarning && <div className="modal-backdrop"><section className="modal-card warning-modal"><div className="modal-symbol"><ShieldCheck size={22} /></div><h2>Enter as a guest?</h2><p>You are using a guest account, if you log out, all projects will be lost.</p><div className="warning-note">Guest projects stay on this device. They are not automatically uploaded to cloud storage.</div><div className="modal-actions"><button className="quiet-button" onClick={() => setShowGuestWarning(false)}>Go back</button><button className="primary-button" onClick={() => onGuest(makeGuestProfile())}>Accept the risk <ArrowRight size={15} /></button></div></section></div>}
  </div>;
}

function FileIcon({ file, size = 15 }: { file: WorkspaceFile; size?: number }) {
  const info = languageForFile(file.name);
  const Icon = info.icon;
  if (info.mark) return <span aria-label={info.label} title={info.label} className={`filetype-mark type-${info.tone}`} style={{ width: size + 3, height: size + 3, fontSize: Math.max(7, size * (info.mark.length > 2 ? 0.42 : 0.58)) }}>{info.mark}</span>;
  return <Icon size={size} className={`filetype-icon type-${info.tone}`} />;
}

function FileTree({ files, activePath, onOpen, onAdd, onDelete }: {
  files: WorkspaceFile[]; activePath: string; onOpen: (path: string) => void; onAdd: () => void; onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '/': true, '/.github': true, '/.github/workflows': true });
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const groups = useMemo(() => {
    const visible: Array<{ file: WorkspaceFile; depth: number; folder?: string }> = [];
    const paths = new Set<string>();
    [...files].sort((a, b) => a.path.localeCompare(b.path)).forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let folder = '';
      for (let i = 0; i < parts.length - 1; i++) {
        folder += `/${parts[i]}`;
        if (!paths.has(folder)) { paths.add(folder); visible.push({ file: { id: `folder:${folder}`, name: parts[i], path: folder, content: '' }, depth: i, folder }); }
      }
      visible.push({ file, depth: parts.length - 1 });
    });
    return visible.filter((item) => {
      const parts = item.file.path.split('/').filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        const parent = `/${parts.slice(0, i).join('/')}`;
        if (expanded[parent] === false) return false;
      }
      return true;
    });
  }, [files, expanded]);

  return <div className="file-tree">
    <div className="tree-root"><button className="tree-caret" onClick={() => setExpanded((v) => ({ ...v, '/': !v['/'] }))}><ChevronDown size={13} /></button><FolderOpen size={14} className="folder-icon" /><b>CODEFORGE_PROJECT</b><div className="tree-root-actions"><button title="New file" onClick={onAdd}><FilePlus2 size={14} /></button><button title="More" onClick={() => setMenuPath(menuPath ? null : '/')}><MoreHorizontal size={15} /></button></div></div>
    {menuPath === '/' && <div className="tree-context root-context"><button onClick={() => { onAdd(); setMenuPath(null); }}>New file</button><button onClick={() => { onAdd(); setMenuPath(null); }}>Create a file / folder path</button></div>}
    {groups.map(({ file, depth, folder }) => folder ? <div key={file.path} className="tree-folder-row" style={{ paddingLeft: 15 + depth * 14 }}>
      <button className="tree-caret" onClick={() => setExpanded((v) => ({ ...v, [file.path]: v[file.path] === false }))}>{expanded[file.path] === false ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
      {expanded[file.path] === false ? <Folder size={14} className="folder-icon" /> : <FolderOpen size={14} className="folder-icon" />}
      <span>{file.name}</span>
    </div> : <div key={file.id} className={`tree-file-row ${activePath === file.path ? 'selected' : ''}`} style={{ paddingLeft: 33 + depth * 14 }}>
      <button className="tree-file-main" onClick={() => onOpen(file.path)}><FileIcon file={file} /><span>{file.name}</span></button>
      <button className="tree-more" title={`Delete ${file.name}`} onClick={() => onDelete(file.path)}><MoreHorizontal size={14} /></button>
    </div>)}
  </div>;
}

function CodeEditor({ file, onChange, onMount, fontSize = 13, wordWrap = false, showMinimap = true }: { file: WorkspaceFile; onChange: (value: string) => void; onMount: OnMount; fontSize?: number; wordWrap?: boolean; showMinimap?: boolean }) {
  const language = languageForFile(file.name);
  return <Editor
    height="100%"
    path={file.path}
    language={language.monaco}
    value={file.content}
    theme="codeforge-dark"
    onChange={(value) => onChange(value ?? '')}
    onMount={onMount}
    options={{
      automaticLayout: true,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      fontSize,
      lineHeight: 22,
      fontLigatures: true,
      minimap: { enabled: showMinimap && window.innerWidth > 1100, scale: 1, showSlider: 'mouseover' },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 15, bottom: 18 },
      tabSize: 2,
      wordWrap: wordWrap ? 'on' : 'off',
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      suggest: { preview: true, showWords: true, showSnippets: true },
      quickSuggestions: { other: true, comments: false, strings: true },
      fixedOverflowWidgets: true,
      renderLineHighlight: 'all',
      overviewRulerBorder: false,
      glyphMargin: true,
    }}
  />;
}

function buildPreview(files: WorkspaceFile[]) {
  const html = files.find((file) => file.name.toLowerCase() === 'index.html')?.content ?? '<main><h1>index.html not found</h1></main>';
  const css = files.find((file) => file.name.toLowerCase() === 'style.css')?.content ?? '';
  const js = files.find((file) => file.name.toLowerCase() === 'script.js')?.content ?? '';
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const bridge = `<script>\n(() => { const send = (type, args) => parent.postMessage({ __codeforgePreview: true, type, text: Array.from(args).map((v) => { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }).join(' ') }, '*'); const old = { log: console.log, warn: console.warn, error: console.error, info: console.info }; ['log','warn','error','info'].forEach((key) => { console[key] = (...args) => { send(key, args); old[key](...args); }; }); window.addEventListener('error', (e) => send('error', [e.message])); window.addEventListener('unhandledrejection', (e) => send('error', [e.reason])); })();\n</script>`;
  const styleTag = `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  let document = html;
  document = document.replace(/<link[^>]+href=["']\.\/?style\.css["'][^>]*>/i, '');
  document = document.replace(/<script[^>]+src=["']\.\/?script\.js["'][^>]*><\/script>/i, '');
  if (document.includes('</head>')) document = document.replace('</head>', `${styleTag}${bridge}</head>`);
  else document = `${styleTag}${bridge}${document}`;
  if (document.includes('</body>')) document = document.replace('</body>', `<script>\n${safeJs}\n</script></body>`);
  else document += `<script>\n${safeJs}\n</script>`;
  return document;
}

function buildOutline(file: WorkspaceFile) {
  const language = languageForFile(file.name).monaco;
  const entries: Array<{ label: string; line: number; kind: string }> = [];
  file.content.split(/\r?\n/).forEach((text, index) => {
    const line = text.trim();
    if (!line) return;
    let match: RegExpMatchArray | null = null;
    if (language === 'markdown') match = line.match(/^(#{1,6})\s+(.+)$/);
    else if (language === 'python') match = line.match(/^(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/);
    else match = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/);
    if (match) {
      const label = language === 'markdown' ? match[2] : (match[2] ?? match[3] ?? match[1]);
      entries.push({ label: label || line.slice(0, 48), line: index + 1, kind: language === 'markdown' ? 'heading' : (match[1] ?? 'symbol') });
    }
  });
  return entries.slice(0, 120);
}

function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [guest, setGuest] = useState<GuestProfile | null>(() => {
    try { const stored = sessionStorage.getItem('cf-guest-profile'); return stored ? JSON.parse(stored) as GuestProfile : null; }
    catch { return null; }
  });
  const [authChecking, setAuthChecking] = useState(Boolean(supabase));
  const [files, setFiles] = useState<WorkspaceFile[]>(starterFiles);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activePath, setActivePath] = useState('/index.html');
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['/index.html']);
  const [navigationIndex, setNavigationIndex] = useState(0);
  const [openTabs, setOpenTabs] = useState<string[]>(['/index.html', '/script.js', '/main.py']);
  const [activeView, setActiveView] = useState<ActivityView>('explorer');
  const [panelTab, setPanelTab] = useState<PanelTab>('terminal');
  const [panelOpen, setPanelOpen] = useState(() => {
    const uiVersion = localStorage.getItem('cf-ui-version');
    if (uiVersion !== '3') {
      localStorage.setItem('cf-ui-version', '3');
      localStorage.setItem('cf-terminal-open', 'true');
      return true;
    }
    return localStorage.getItem('cf-terminal-open') !== 'false';
  });
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'git' | 'inspector'>('git');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: 1, kind: 'info', text: 'CODEFORGE integrated terminal · browser workspace' },
    { id: 2, kind: 'success', text: 'Workspace ready. Type "help" to see supported commands.' },
  ]);
  const [toast, setToast] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileError, setNewFileError] = useState('');
  const [splitView, setSplitView] = useState(false);
  const [splitPath, setSplitPath] = useState('/script.js');
  const [terminalCwd, setTerminalCwd] = useState('/workspace');
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('cf-auto-save') !== 'false');
  const [showMinimap, setShowMinimap] = useState(() => localStorage.getItem('cf-minimap') !== 'false');
  const [searchQuery, setSearchQuery] = useState('');
  const [extensionTab, setExtensionTab] = useState<'discover' | 'installed' | 'updates'>('discover');
  const [extensionSearch, setExtensionSearch] = useState('');
  const [extensionCategory, setExtensionCategory] = useState('All');
  const [installedExtensions, setInstalledExtensions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cf-installed-extensions') ?? '[]') as string[]; } catch { return []; }
  });
  const [syncState, setSyncState] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('cf-font-size')) || 13);
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem('cf-word-wrap') === 'true');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [recentFilesOpen, setRecentFilesOpen] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState<'idle' | 'ctrl' | 'alt' | 'shift'>('idle');
  const [problems, setProblems] = useState<Array<{ message: string; line?: number; path: string; severity: 'error' | 'warning' | 'info' }>>([]);
  const diagnosticsSubscriptionRef = useRef<{ dispose: () => void } | null>(null);
  const [runtimeState, setRuntimeState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [runtimeVersion, setRuntimeVersion] = useState('');
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pythonWorkerRef = useRef<Worker | null>(null);
  const javascriptWorkerRef = useRef<Worker | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const terminalIdRef = useRef(2);
  const displayName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || guest?.name || 'Developer';
  const displayHandle = authUser?.email ?? guest?.handle ?? 'local-workspace';

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const appendTerminal = useCallback((kind: TerminalLine['kind'], text: string) => {
    terminalIdRef.current += 1;
    setTerminalLines((lines) => [...lines.slice(-249), { id: terminalIdRef.current, kind, text }]);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthUser(null);
      setAuthChecking(false);
      return;
    }

    let active = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventReceived = true;
      // Keep this callback synchronous. Supabase emits INITIAL_SESSION after it
      // restores persisted auth and processes the PKCE redirect callback.
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      setAuthChecking(false);

      if (nextUser) {
        sessionStorage.removeItem('cf-guest-profile');
        sessionStorage.removeItem('cf-oauth-pending');
        setGuest(null);
      } else if (event === 'SIGNED_OUT') {
        setGuest(null);
        sessionStorage.removeItem('cf-guest-profile');
        sessionStorage.removeItem('cf-oauth-pending');
      }
    });

    // Recovery path for browsers where the initial auth event is delayed or
    // missed. Do not overwrite a session if the listener already delivered one.
    const recoveryTimer = window.setTimeout(() => {
      if (!active || authEventReceived) return;
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active || authEventReceived) return;
        if (error) console.warn('Supabase session recovery:', error.message);
        const nextUser = data.session?.user ?? null;
        setAuthUser(nextUser);
        setAuthChecking(false);
        if (nextUser) {
          sessionStorage.removeItem('cf-guest-profile');
          sessionStorage.removeItem('cf-oauth-pending');
          setGuest(null);
        }
      }).catch((error: unknown) => {
        if (!active || authEventReceived) return;
        console.warn('Supabase session recovery failed:', error);
        setAuthChecking(false);
      });
    }, 2200);

    return () => {
      active = false;
      window.clearTimeout(recoveryTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      if (!authUser && !guest) { setWorkspaceReady(false); return; }
      setWorkspaceReady(false);
      try {
        if (authUser) {
          const cloudFiles = await loadWorkspaceFromCloud(authUser);
          if (cancelled) return;
          if (cloudFiles?.length) {
            setFiles(cloudFiles);
            setActivePath(cloudFiles.some((file) => file.path === '/index.html') ? '/index.html' : cloudFiles[0].path);
            setOpenTabs((tabs) => Array.from(new Set([...tabs, cloudFiles[0].path])));
          } else {
            const local = await loadWorkspace();
            if (!cancelled && local?.length) setFiles(local);
          }
        } else {
          const local = await loadWorkspace();
          if (!cancelled && local?.length) setFiles(local);
        }
      } catch (error) {
        console.warn('Workspace restore:', error);
        if (!cancelled) notify(`Cloud restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setWorkspaceReady(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [authUser, guest, notify]);

  useEffect(() => {
    if (!workspaceReady) return;
    if (!autoSave) return;
    void saveWorkspace(files).catch((error) => notify(`Local save failed: ${String(error)}`));
  }, [files, workspaceReady, autoSave, notify]);

  useEffect(() => {
    if (!authUser || !workspaceReady || !supabase) return;
    setSyncState('syncing');
    const timer = window.setTimeout(() => {
      void syncWorkspaceToCloud(authUser, files)
        .then(() => setSyncState('synced'))
        .catch((error) => {
          setSyncState('error');
          console.warn('Cloud sync:', error);
        });
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [authUser, files, workspaceReady]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [terminalLines]);

  useEffect(() => {
    if (panelOpen && panelTab === 'terminal' && window.innerWidth > 700) terminalInputRef.current?.focus();
  }, [panelOpen, panelTab]);

  useEffect(() => {
    localStorage.setItem('cf-installed-extensions', JSON.stringify(installedExtensions));
  }, [installedExtensions]);

  useEffect(() => {
    localStorage.setItem('cf-auto-save', String(autoSave));
    localStorage.setItem('cf-minimap', String(showMinimap));
    localStorage.setItem('cf-terminal-open', String(panelOpen));
    localStorage.setItem('cf-font-size', String(fontSize));
    localStorage.setItem('cf-word-wrap', String(wordWrap));
  }, [autoSave, showMinimap, panelOpen, fontSize, wordWrap]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); void saveWorkspace(files).then(() => notify('Workspace saved locally.')).catch((error) => notify(`Save failed: ${String(error)}`)); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'p') { event.preventDefault(); setCommandOpen(true); }
      if ((event.ctrlKey || event.metaKey) && key === 'k') { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') { setCommandOpen(false); setProfileOpen(false); setSettingsOpen(false); setMobileSidebar(false); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [notify]);

  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      if (!previewFrameRef.current || event.source !== previewFrameRef.current.contentWindow) return;
      const data = event.data;
      if (!data || data.__codeforgePreview !== true || typeof data.text !== 'string') return;
      appendTerminal(data.type === 'error' ? 'stderr' : data.type === 'warn' ? 'info' : 'stdout', `[preview] ${data.text}`);
    };
    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, [appendTerminal]);

  useEffect(() => () => {
    pythonWorkerRef.current?.terminate();
    javascriptWorkerRef.current?.terminate();
    diagnosticsSubscriptionRef.current?.dispose();
  }, []);

  const activeFile = files.find((file) => file.path === activePath) ?? files[0];
  const updateFile = (path: string, content: string) => setFiles((current) => current.map((file) => file.path === path ? { ...file, content } : file));
  const openFile = (path: string) => {
    setActivePath(path);
    if (navigationHistory[navigationIndex] !== path) {
      const nextHistory = [...navigationHistory.slice(0, navigationIndex + 1), path].slice(-100);
      setNavigationHistory(nextHistory);
      setNavigationIndex(nextHistory.length - 1);
    }
    setOpenTabs((tabs) => tabs.includes(path) ? tabs : [...tabs, path]);
    setMobileSidebar(false);
  };
  const navigateBack = () => {
    if (navigationIndex <= 0) return;
    const next = navigationIndex - 1;
    setNavigationIndex(next);
    const path = navigationHistory[next];
    if (files.some((file) => file.path === path)) setActivePath(path);
  };
  const navigateForward = () => {
    if (navigationIndex >= navigationHistory.length - 1) return;
    const next = navigationIndex + 1;
    setNavigationIndex(next);
    const path = navigationHistory[next];
    if (files.some((file) => file.path === path)) setActivePath(path);
  };

  const closeTab = (path: string) => {
    const remaining = openTabs.filter((item) => item !== path);
    setOpenTabs(remaining);
    if (activePath === path && remaining.length) setActivePath(remaining[remaining.length - 1]);
  };
  const addFile = () => {
    setNewFileName('');
    setNewFileError('');
    setNewFileOpen(true);
  };

  const createFileFromDialog = () => {
    const clean = newFileName.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = clean.split('/');
    if (!clean || parts.some((part) => !part || part === '.' || part === '..')) {
      setNewFileError('Enter a valid name such as src/main.py.');
      return;
    }
    const path = `/${clean}`;
    if (files.some((file) => file.path.toLowerCase() === path.toLowerCase())) {
      setNewFileError('A file with this path already exists.');
      return;
    }
    const name = parts[parts.length - 1];
    const file = newFile(name);
    file.path = path;
    setFiles((current) => [...current, file]);
    setNewFileOpen(false);
    openFile(file.path);
    notify(`${file.path} created.`);
  };
  const deleteFile = (path: string) => {
    const file = files.find((item) => item.path === path);
    if (!file || !window.confirm(`Delete ${file.name}?`)) return;
    setFiles((current) => current.filter((item) => item.path !== path));
    closeTab(path);
    if (activePath === path) setActivePath(files.find((item) => item.path !== path)?.path ?? '');
  };

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    diagnosticsSubscriptionRef.current?.dispose();
    diagnosticsSubscriptionRef.current = monaco.editor.onDidChangeMarkers(() => {
      const collected = monaco.editor.getModels().flatMap((model: MonacoEditor.ITextModel) =>
        monaco.editor.getModelMarkers({ resource: model.uri }).map((marker: MonacoEditor.IMarker) => ({
          message: marker.message,
          line: marker.startLineNumber,
          path: model.uri.path.replace(/^\/split:/, '').replace(/^\//, '/'),
          severity: marker.severity === monaco.MarkerSeverity.Error ? 'error' as const : marker.severity === monaco.MarkerSeverity.Warning ? 'warning' as const : 'info' as const,
        })),
      );
      setProblems(collected.slice(0, 300));
    });
    monaco.editor.defineTheme('codeforge-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'comment', foreground: '727C91', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'B7A2FF' },
        { token: 'string', foreground: 'A8D6B2' },
        { token: 'number', foreground: 'E6B779' },
        { token: 'type.identifier', foreground: '81B8E8' },
        { token: 'function', foreground: '83B8EA' },
        { token: 'identifier', foreground: 'D7DBE5' },
      ],
      colors: {
        'editor.background': '#11141c', 'editor.foreground': '#d7dbe5',
        'editorLineNumber.foreground': '#535b6c', 'editorLineNumber.activeForeground': '#aeb8ca',
        'editorCursor.foreground': '#a997ff', 'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#7465cb55', 'editor.inactiveSelectionBackground': '#7465cb25',
        'editorIndentGuide.background1': '#272d39', 'editorIndentGuide.activeBackground1': '#4a5264',
        'editorWidget.background': '#191e29', 'editorWidget.border': '#333a49',
        'editorSuggestWidget.background': '#191e29', 'editorSuggestWidget.border': '#333a49',
        'editorSuggestWidget.selectedBackground': '#7667d333', 'editorOverviewRuler.border': '#00000000',
      },
    });
    monaco.editor.setTheme('codeforge-dark');
    const completions = [
      { label: 'console.log', insertText: 'console.log(${1:value});', detail: 'Write a message to the console', kind: monaco.languages.CompletionItemKind.Snippet },
      { label: 'async function', insertText: 'async function ${1:name}(${2:params}) {\n\t${3:// code}\n}', detail: 'Async function template', kind: monaco.languages.CompletionItemKind.Snippet },
      { label: 'useState', insertText: 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});', detail: 'React state hook', kind: monaco.languages.CompletionItemKind.Snippet },
      { label: 'try / catch', insertText: 'try {\n\t${1:// code}\n} catch (error) {\n\tconsole.error(error);\n}', detail: 'Error handling template', kind: monaco.languages.CompletionItemKind.Snippet },
    ];
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems(model: MonacoEditor.ITextModel, position: MonacoPosition) {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: completions.map((item) => ({ ...item, range, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet })) };
      },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveWorkspace(files).then(() => notify('Workspace saved locally.')).catch((error) => notify(`Save failed: ${String(error)}`));
    });
    editor.focus();
  };

  const runPython = (code: string, fileName: string) => {
    setPanelTab('terminal');
    setPanelOpen(true);
    setRuntimeState('loading');
    appendTerminal('info', `Starting Python runtime for ${fileName}…`);

    pythonWorkerRef.current?.terminate();
    try {
      const workerUrl = new URL(`${import.meta.env.BASE_URL}workers/python.worker.js`, window.location.href);
      const worker = new Worker(workerUrl, { name: 'codeforge-python-runtime' });
      pythonWorkerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; text?: string; version?: string };
        if (data.type === 'ready') {
          setRuntimeState('ready');
          setRuntimeVersion(data.version ?? 'WebAssembly');
          appendTerminal('success', `Python runtime ready · ${data.version ?? 'Pyodide'}`);
        }
        if (data.type === 'stdout') appendTerminal('stdout', data.text ?? '');
        if (data.type === 'stderr') appendTerminal('stderr', data.text ?? '');
        if (data.type === 'error') {
          setRuntimeState('error');
          appendTerminal('stderr', data.text ?? 'Python runtime error');
          worker.terminate();
          if (pythonWorkerRef.current === worker) pythonWorkerRef.current = null;
        }
        if (data.type === 'done') {
          setRuntimeState('ready');
          appendTerminal('success', 'Process finished with exit code 0');
          worker.terminate();
          if (pythonWorkerRef.current === worker) pythonWorkerRef.current = null;
        }
      };
      worker.onerror = (event) => {
        setRuntimeState('error');
        appendTerminal('stderr', `Python worker error: ${event.message || 'Could not load runtime worker.'}`);
        worker.terminate();
        if (pythonWorkerRef.current === worker) pythonWorkerRef.current = null;
      };
      worker.onmessageerror = () => {
        setRuntimeState('error');
        appendTerminal('stderr', 'Python worker returned a message that could not be decoded.');
        worker.terminate();
        if (pythonWorkerRef.current === worker) pythonWorkerRef.current = null;
      };
      worker.postMessage({ type: 'run', code });
    } catch (error) {
      setRuntimeState('error');
      appendTerminal('stderr', `Could not start Python: ${error instanceof Error ? error.message : String(error)}`);
      pythonWorkerRef.current = null;
    }
  };

  const runJavaScript = (code: string, fileName: string) => {
    setPanelTab('terminal');
    setPanelOpen(true);
    appendTerminal('info', `Running ${fileName} in isolated browser Worker…`);
    javascriptWorkerRef.current?.terminate();

    try {
      const workerUrl = new URL(`${import.meta.env.BASE_URL}workers/javascript.worker.js`, window.location.href);
      const worker = new Worker(workerUrl, { name: 'codeforge-javascript-runtime' });
      javascriptWorkerRef.current = worker;
      const timeout = window.setTimeout(() => {
        worker.terminate();
        if (javascriptWorkerRef.current === worker) javascriptWorkerRef.current = null;
        appendTerminal('stderr', 'Execution stopped after 5 seconds (time limit).');
      }, 5000);

      const finish = () => {
        window.clearTimeout(timeout);
        worker.terminate();
        if (javascriptWorkerRef.current === worker) javascriptWorkerRef.current = null;
      };

      worker.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; text?: string };
        if (data.type === 'stdout') appendTerminal('stdout', data.text ?? '');
        if (data.type === 'stderr') appendTerminal('stderr', data.text ?? '');
        if (data.type === 'error') {
          appendTerminal('stderr', data.text ?? 'JavaScript error');
          finish();
        }
        if (data.type === 'done') {
          appendTerminal('success', 'Browser JavaScript execution finished.');
          finish();
        }
      };
      worker.onerror = (event) => {
        appendTerminal('stderr', `JavaScript worker error: ${event.message || 'Could not load runtime worker.'}`);
        finish();
      };
      worker.onmessageerror = () => {
        appendTerminal('stderr', 'JavaScript worker returned a message that could not be decoded.');
        finish();
      };
      worker.postMessage({ code });
    } catch (error) {
      appendTerminal('stderr', `Could not start JavaScript: ${error instanceof Error ? error.message : String(error)}`);
      javascriptWorkerRef.current = null;
    }
  };

  const stopExecution = () => {
    const hadExecution = Boolean(pythonWorkerRef.current || javascriptWorkerRef.current);
    pythonWorkerRef.current?.terminate();
    javascriptWorkerRef.current?.terminate();
    pythonWorkerRef.current = null;
    javascriptWorkerRef.current = null;
    if (runtimeState === 'loading') setRuntimeState('idle');
    appendTerminal(hadExecution ? 'success' : 'info', hadExecution ? 'Current execution stopped.' : 'No active execution to stop.');
  };

  const runPreview = () => {
    const document = buildPreview(files);
    setPreviewDocument(document); setPreviewKey((key) => key + 1); setPreviewOpen(true);
    appendTerminal('success', 'Live Preview refreshed from the current workspace files.');
  };

  const runActiveFile = () => {
    if (!activeFile) {
      notify('Open a file first.');
      return;
    }

    setPanelTab('terminal');
    setPanelOpen(true);
    const currentModel = editorRef.current?.getModel();
    const source = currentModel?.uri.path.endsWith(activePath)
      ? currentModel.getValue()
      : activeFile.content;
    const language = languageForFile(activeFile.name);
    appendTerminal('command', `run ${activeFile.name}`);

    if (language.runnable === 'python') {
      runPython(source, activeFile.name);
    } else if (language.runnable === 'javascript') {
      runJavaScript(source, activeFile.name);
    } else if (language.runnable === 'preview') {
      runPreview();
    } else {
      const message = `${language.label} (${activeFile.name}) has editor support, but no runtime is bundled in this build.`;
      appendTerminal('stderr', message);
      notify(message);
    }
  };

  const normalizeTerminalPath = (input: string, base = terminalCwd) => {
    const seed = input.startsWith('/') ? input : `${base}/${input}`;
    const segments: string[] = [];
    for (const segment of seed.replace(/\\/g, '/').split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        if (segments.length > 1) segments.pop();
        continue;
      }
      segments.push(segment);
    }
    if (segments[0] !== 'workspace') segments.unshift('workspace');
    return `/${segments.join('/')}`;
  };

  const toWorkspaceFilePath = (virtualPath: string) => {
    const trimmed = virtualPath.replace(/^\/workspace/, '');
    return trimmed || '/';
  };

  const tokenizeCommand = (value: string) => {
    const tokens: string[] = [];
    const matcher = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(value))) tokens.push((match[1] ?? match[2] ?? match[3]).replace(/\\(["'])/g, '$1'));
    return tokens;
  };

  const executeCommand = (commandText: string) => {
    const raw = commandText.trim();
    if (!raw) return;
    appendTerminal('command', `${terminalCwd.replace('/workspace', 'workspace')}$ ${raw}`);
    const tokens = tokenizeCommand(raw);
    const command = (tokens.shift() ?? '').toLowerCase();
    const argument = tokens.join(' ');
    const targetVirtual = (value: string) => normalizeTerminalPath(value || '.', terminalCwd);
    const resolveFile = (value: string) => {
      const virtual = targetVirtual(value);
      const path = toWorkspaceFilePath(virtual);
      return files.find((file) => file.path.toLowerCase() === path.toLowerCase());
    };
    const output = (value: string) => appendTerminal('stdout', value);

    if (command === 'clear' || command === 'cls') { setTerminalLines([]); return; }
    if (command === 'help') {
      [
        'CODEFORGE workspace terminal · supported commands',
        '  help                         Show this help',
        '  pwd                          Print current workspace path',
        '  ls [path]                    List files and folders',
        '  tree [path]                  Print the project tree',
        '  cd <path>                    Change virtual workspace directory',
        '  cat <file>                   Print a text file',
        '  head [-n count] <file>       Print the first lines',
        '  tail [-n count] <file>       Print the last lines',
        '  grep <text> [file]           Search text in workspace files',
        '  wc <file>                    Count lines, words and bytes',
        '  echo <text>                  Print text',
        '  touch <file>                 Create a file',
        '  mkdir <folder>               Create a virtual folder',
        '  rm <file>                    Delete a workspace file',
        '  mv <source> <destination>    Rename / move a file',
        '  python <file.py>             Run Python with Pyodide',
        '  js <file.js>                 Run JavaScript in a Worker',
        '  preview                      Open the HTML/CSS/JS preview',
        '  clear                        Clear terminal output',
        '',
        'This is a browser workspace terminal, not an operating-system shell.',
        'Commands such as bash, pip, npm, gcc and apt are not available here.',
      ].forEach((line) => appendTerminal('info', line));
      return;
    }
    if (command === 'pwd') return output(terminalCwd);
    if (command === 'cd') {
      const next = targetVirtual(tokens[0] ?? '/workspace');
      const targetPath = toWorkspaceFilePath(next);
      const directoryExists = targetPath === '/' || files.some((file) => file.path.startsWith(`${targetPath.replace(/\/$/, '')}/`));
      if (!directoryExists) return appendTerminal('stderr', `cd: ${tokens[0]}: directory not found`);
      setTerminalCwd(next);
      return;
    }
    if (command === 'ls') {
      const directory = toWorkspaceFilePath(targetVirtual(tokens[0] ?? '.')).replace(/\/$/, '') || '/';
      const prefix = directory === '/' ? '/' : `${directory}/`;
      const entries = new Map<string, 'file' | 'directory'>();
      files.forEach((file) => {
        if (!file.path.startsWith(prefix)) return;
        const remainder = file.path.slice(prefix.length);
        if (!remainder) return;
        const [first, ...rest] = remainder.split('/');
        if (first) entries.set(first, rest.length ? 'directory' : 'file');
      });
      if (!entries.size) return appendTerminal('info', '(empty directory)');
      [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, type]) => output(type === 'directory' ? `${name}/` : name));
      return;
    }
    if (command === 'tree') {
      const startPath = toWorkspaceFilePath(targetVirtual(tokens[0] ?? '.')).replace(/\/$/, '') || '/';
      const prefix = startPath === '/' ? '/' : `${startPath}/`;
      const paths = files.filter((file) => file.path.startsWith(prefix)).map((file) => file.path.slice(prefix.length)).filter(Boolean).sort();
      output(startPath === '/' ? '.' : startPath.split('/').at(-1) ?? '.');
      paths.forEach((path) => output(`├── ${path}`));
      output(`${paths.length} file entries`);
      return;
    }
    if (command === 'echo') return output(raw.slice(raw.indexOf(' ') + 1));
    if (command === 'cat' || command === 'head' || command === 'tail' || command === 'wc') {
      let filename = tokens.at(-1) ?? '';
      let count = 10;
      if ((command === 'head' || command === 'tail') && tokens[0] === '-n') {
        count = Math.max(1, Math.min(500, Number(tokens[1]) || 10));
        filename = tokens[2] ?? '';
      }
      const file = resolveFile(filename);
      if (!file) return appendTerminal('stderr', `${command}: ${filename || 'missing file'}: file not found`);
      if (command === 'wc') {
        const lines = file.content ? file.content.split(/\r?\n/).length : 0;
        const words = file.content.trim() ? file.content.trim().split(/\s+/).length : 0;
        return output(`${lines} ${words} ${new TextEncoder().encode(file.content).length} ${file.path}`);
      }
      const lines = file.content.split(/\r?\n/);
      const selected = command === 'head' ? lines.slice(0, count) : command === 'tail' ? lines.slice(-count) : lines;
      selected.forEach((line) => output(line));
      return;
    }
    if (command === 'grep') {
      const pattern = tokens[0] ?? '';
      if (!pattern) return appendTerminal('stderr', 'grep: missing search text');
      const selected = tokens[1] ? files.filter((file) => resolveFile(tokens[1])?.path === file.path) : files;
      const matches: string[] = [];
      selected.forEach((file) => file.content.split(/\r?\n/).forEach((line, index) => {
        if (line.toLowerCase().includes(pattern.toLowerCase())) matches.push(`${file.path}:${index + 1}: ${line}`);
      }));
      if (!matches.length) return appendTerminal('info', `No matches for "${pattern}".`);
      matches.slice(0, 200).forEach(output);
      return;
    }
    if (command === 'touch') {
      const value = tokens[0];
      if (!value) return appendTerminal('stderr', 'touch: missing file name');
      const virtual = targetVirtual(value);
      const path = toWorkspaceFilePath(virtual);
      if (files.some((file) => file.path.toLowerCase() === path.toLowerCase())) return appendTerminal('info', `${path} already exists.`);
      if (path === '/') return appendTerminal('stderr', 'touch: expected a file path');
      const file = newFile(path.split('/').at(-1) ?? 'untitled.txt');
      file.path = path;
      setFiles((current) => [...current, file]);
      openFile(file.path);
      appendTerminal('success', `Created ${file.path}`);
      return;
    }
    if (command === 'mkdir') {
      const value = tokens[0];
      if (!value) return appendTerminal('stderr', 'mkdir: missing folder name');
      const directory = toWorkspaceFilePath(targetVirtual(value)).replace(/\/$/, '');
      if (files.some((file) => file.path === `${directory}/.gitkeep`)) return appendTerminal('info', `${directory} already exists.`);
      const marker = newFile('.gitkeep');
      marker.path = `${directory}/.gitkeep`;
      setFiles((current) => [...current, marker]);
      appendTerminal('success', `Created folder ${directory}`);
      return;
    }
    if (command === 'rm') {
      const value = tokens[0];
      if (!value) return appendTerminal('stderr', 'rm: missing file path');
      const file = resolveFile(value);
      if (!file) return appendTerminal('stderr', `rm: ${value}: file not found`);
      setFiles((current) => current.filter((item) => item.path !== file.path));
      closeTab(file.path);
      if (activePath === file.path) setActivePath(files.find((item) => item.path !== file.path)?.path ?? '');
      appendTerminal('success', `Removed ${file.path}`);
      return;
    }
    if (command === 'mv') {
      if (tokens.length < 2) return appendTerminal('stderr', 'mv: usage: mv <source> <destination>');
      const source = resolveFile(tokens[0]);
      const destination = toWorkspaceFilePath(targetVirtual(tokens[1]));
      if (!source) return appendTerminal('stderr', `mv: ${tokens[0]}: file not found`);
      if (files.some((file) => file.path.toLowerCase() === destination.toLowerCase())) return appendTerminal('stderr', `mv: ${destination}: destination already exists`);
      const nextName = destination.split('/').at(-1) ?? source.name;
      setFiles((current) => current.map((file) => file.path === source.path ? { ...file, path: destination, name: nextName } : file));
      setOpenTabs((tabs) => tabs.map((tab) => tab === source.path ? destination : tab));
      if (activePath === source.path) setActivePath(destination);
      if (splitPath === source.path) setSplitPath(destination);
      appendTerminal('success', `Moved ${source.path} → ${destination}`);
      return;
    }
    if (command === 'preview') return runPreview();
    if (command === 'python' || command === 'py') {
      const target = resolveFile(tokens[0] ?? 'main.py');
      if (!target) return appendTerminal('stderr', `python: ${tokens[0] ?? 'main.py'} not found`);
      if (languageForFile(target.name).runnable !== 'python') return appendTerminal('stderr', 'Selected file is not recognized as Python (.py).');
      runPython(target.content, target.name);
      return;
    }
    if (command === 'js') {
      const target = resolveFile(tokens[0] ?? 'script.js');
      if (!target) return appendTerminal('stderr', `js: ${tokens[0] ?? 'script.js'} not found`);
      if (languageForFile(target.name).runnable !== 'javascript') return appendTerminal('stderr', 'Selected file is not JavaScript (.js, .mjs or .cjs).');
      runJavaScript(target.content, target.name);
      return;
    }
    if (command === 'open') {
      const file = resolveFile(tokens[0] ?? '');
      if (!file) return appendTerminal('stderr', `open: ${tokens[0] ?? ''}: file not found`);
      openFile(file.path);
      return;
    }
    appendTerminal('stderr', `Command not found: ${command}. Type "help" for supported workspace commands.`);
  };
  const insertEditorText = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    const range = selection ?? editor.getModel()?.getFullModelRange();
    if (!range) return;
    editor.executeEdits('mobile-keyboard', [{ range, text, forceMoveMarkers: true }]);
    editor.focus();
  };

  const handleMobileKey = (key: string) => {
    const editor = editorRef.current;
    if (['CTRL', 'ALT', 'SHIFT'].includes(key)) { setKeyboardMode((mode) => mode === key.toLowerCase() ? 'idle' : key.toLowerCase() as 'ctrl' | 'alt' | 'shift'); return; }
    const lower = key.toLowerCase();
    if (keyboardMode === 'ctrl') {
      if (lower === 's') void saveWorkspace(files).then(() => notify('Workspace saved locally.')).catch((error) => notify(`Save failed: ${String(error)}`));
      else if (lower === 'f') setActiveView('search');
      else if (lower === 'a') editor?.trigger('mobile-keyboard', 'editor.action.selectAll', null);
      else if (lower === 'z') editor?.trigger('mobile-keyboard', 'undo', null);
      else if (lower === 'y') editor?.trigger('mobile-keyboard', 'redo', null);
      else if (lower === 'c') { const selected = editor?.getModel()?.getValueInRange(editor.getSelection()!); if (selected) void navigator.clipboard?.writeText(selected).then(() => notify('Selection copied.')).catch(() => notify('Clipboard permission unavailable.')); }
      setKeyboardMode('idle'); return;
    }
    if (keyboardMode === 'alt' && key === 'LEFT') editor?.trigger('mobile-keyboard', 'cursorWordLeft', null);
    else if (keyboardMode === 'alt' && key === 'RIGHT') editor?.trigger('mobile-keyboard', 'cursorWordRight', null);
    else if (keyboardMode === 'shift' && key === 'LEFT') editor?.trigger('mobile-keyboard', 'cursorLeftSelect', null);
    else if (keyboardMode === 'shift' && key === 'RIGHT') editor?.trigger('mobile-keyboard', 'cursorRightSelect', null);
    else if (keyboardMode === 'shift' && key.length === 1) insertEditorText(key.toUpperCase());
    else if (key === 'TAB') insertEditorText('  ');
    else if (key === 'ENTER') insertEditorText('\n');
    else if (key === 'BACKSPACE') editor?.trigger('keyboard', 'deleteLeft', null);
    else if (key === 'LEFT') editor?.trigger('keyboard', 'cursorLeft', null);
    else if (key === 'RIGHT') editor?.trigger('keyboard', 'cursorRight', null);
    else if (key === 'UP') editor?.trigger('keyboard', 'cursorUp', null);
    else if (key === 'DOWN') editor?.trigger('keyboard', 'cursorDown', null);
    else insertEditorText(key);
    setKeyboardMode('idle');
  };

  const signOut = async () => {
    if (!window.confirm('Log out and clear this device workspace? Guest projects will be permanently removed from this device.')) return;

    pythonWorkerRef.current?.terminate();
    javascriptWorkerRef.current?.terminate();
    pythonWorkerRef.current = null;
    javascriptWorkerRef.current = null;

    // Local scope prevents a logout on this browser from revoking sessions on
    // the user's other devices. The local app state is cleared even if the
    // best-effort server revoke reports a network error.
    let signOutWarning = '';
    if (authUser && supabase) {
      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) signOutWarning = `Local session cleared; server revoke warning: ${error.message}`;
      } catch (error) {
        signOutWarning = `Signed out on this device; server revoke could not be confirmed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    await clearWorkspace();
    sessionStorage.removeItem('cf-guest-profile');
    sessionStorage.removeItem('cf-oauth-pending');
    setGuest(null);
    setAuthUser(null);
    setFiles(starterFiles);
    setWorkspaceReady(false);
    setProfileOpen(false);
    setAuthChecking(false);
    if (signOutWarning) notify(signOutWarning);
  };

  const startGuest = (profile: GuestProfile) => {
    sessionStorage.removeItem('cf-oauth-pending');
    sessionStorage.setItem('cf-guest-profile', JSON.stringify(profile));
    setAuthUser(null);
    setAuthChecking(false);
    setGuest(profile);
  };

  const syncNow = async () => {
    if (!authUser) return notify('Sign in to sync this workspace to cloud.');
    setSyncState('syncing');
    try { await syncWorkspaceToCloud(authUser, files); setSyncState('synced'); notify('Cloud sync completed.'); }
    catch (error) { setSyncState('error'); notify(`Cloud sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  };

  const showStorageUsage = async () => {
    try {
      if (!navigator.storage?.estimate) return notify('This browser does not expose local storage estimates.');
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ?? 0;
      const total = estimate.quota ?? 0;
      const toMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      notify(total ? `Browser storage: ${toMb(used)} used of ${toMb(total)} available.` : `Browser storage used: ${toMb(used)}.`);
    } catch {
      notify('Could not read this browser storage estimate.');
    }
  };

  const changeFontSize = (direction: number) => setFontSize((size) => Math.max(11, Math.min(20, size + direction)));
  const formatActiveDocument = () => {
    const action = editorRef.current?.getAction('editor.action.formatDocument');
    if (!action) return notify('No formatter is available for the active language.');
    void action.run().then(() => notify('Document formatting requested.')).catch(() => notify('No formatter is available for the active language.'));
  };

  const openTerminal = () => { setPanelTab('terminal'); setPanelOpen(true); };

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const exportZip = () => {
    try {
      const bytes = exportWorkspaceZip(files);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      downloadBlob(new Blob([buffer], { type: 'application/zip' }), 'codeforge-workspace.zip');
      notify(`Exported ${files.length} text files as ZIP.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Workspace export failed.');
    }
  };

  const exportJson = () => {
    downloadBlob(exportWorkspaceJson(files), 'codeforge-workspace.codeforge.json');
    notify(`Created a CODEFORGE backup with ${files.length} files.`);
  };

  const importWorkspace = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!picked) return;
    try {
      const result = await importWorkspaceFile(picked);
      if (!result.files.length) throw new Error('No editable text files were found in this import.');
      const replace = window.confirm(`Import ${result.files.length} files from ${picked.name}?\n\nOK = replace current workspace\nCancel = merge with current files`);
      setFiles((current) => {
        if (replace) return result.files;
        const merged = new Map(current.map((file) => [file.path.toLowerCase(), file]));
        result.files.forEach((file) => merged.set(file.path.toLowerCase(), file));
        return [...merged.values()];
      });
      const first = result.files[0];
      setNavigationHistory([first.path]);
      setNavigationIndex(0);
      setOpenTabs([first.path]);
      setActivePath(first.path);
      setWorkspaceReady(true);
      setActiveView('explorer');
      setMobileSidebar(false);
      notify(`Imported ${result.files.length} files${result.skipped.length ? ` · skipped ${result.skipped.length} unsupported/binary entries` : ''}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import this workspace.');
    }
  };

  if (authChecking) return <div className="boot-screen"><Brand /><div className="spinner large-spinner" /><span>Restoring secure session…</span></div>;
  if (!authUser && !guest) return <LoginScreen onGuest={startGuest} />;

  const profileName = displayName;
  const activeLanguage = activeFile ? languageForFile(activeFile.name) : null;
  const outlineItems = activeFile ? buildOutline(activeFile) : [];
  const recentFilePaths = Array.from(new Set([...navigationHistory].reverse())).filter((path) => files.some((file) => file.path === path));
  const filteredCommands = [
    { id: 'save', label: 'Save workspace', detail: 'Ctrl / Cmd + S', run: () => { void saveWorkspace(files).then(() => notify('Workspace saved locally.')).catch((error) => notify(String(error))); } },
    { id: 'new-file', label: 'New file', detail: 'Create a file with a live extension icon', run: addFile },
    { id: 'import', label: 'Import workspace or file', detail: 'Open a ZIP, CODEFORGE backup or text file', run: () => importInputRef.current?.click() },
    { id: 'export-zip', label: 'Export workspace as ZIP', detail: 'Download project source files', run: exportZip },
    { id: 'export-json', label: 'Export CODEFORGE backup', detail: 'Download a portable JSON backup', run: exportJson },
    { id: 'split', label: splitView ? 'Close split editor' : 'Split editor', detail: 'Open two files side by side', run: () => { setSplitView((value) => !value); const next = files.find((file) => file.path !== activePath); if (next) setSplitPath(next.path); } },
    { id: 'preview', label: 'Open Live Preview', detail: 'Run HTML, CSS and JavaScript', run: runPreview },
    {
      id: 'terminal',
      label: 'Open terminal panel',
      detail: 'Show the workspace terminal',
      run: openTerminal,
    },
    { id: 'search', label: 'Search in files', detail: 'Find text in this workspace', run: () => setActiveView('search') },
    { id: 'extensions', label: 'Open Workspace Tool Catalog', detail: 'Browse locally saved workspace tools', run: () => setActiveView('extensions') },
    { id: 'workflows', label: 'Open Workflows', detail: 'Inspect repository workflow files', run: () => setActiveView('workflows') },
    { id: 'format', label: 'Format document', detail: 'Run Monaco formatting for the active language', run: formatActiveDocument },
    { id: 'close-tabs', label: 'Close all editor tabs', detail: 'Keep files in the workspace and close their tabs', run: () => { setOpenTabs([]); setSplitView(false); } },
    { id: 'terminal-clear', label: 'Clear terminal', detail: 'Clear the current terminal output', run: () => { openTerminal(); setTerminalLines([]); } },
    { id: 'terminal-toggle', label: panelOpen ? 'Hide terminal panel' : 'Show terminal panel', detail: 'Toggle the integrated workspace terminal', run: () => { setPanelTab('terminal'); setPanelOpen((open) => !open); } },
    { id: 'problems', label: 'Show Problems', detail: 'Open current editor diagnostics panel', run: () => { setPanelTab('problems'); setPanelOpen(true); } },
    { id: 'output', label: 'Show Output', detail: 'Open runtime and service output', run: () => { setPanelTab('output'); setPanelOpen(true); } },
    { id: 'settings', label: 'Open Settings', detail: 'Editor and workspace preferences', run: () => setSettingsOpen(true) },
  ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(commandQuery.toLowerCase()));

  return <div className="ide-shell">
    <header className="ide-titlebar">
      <div className="titlebar-left"><Brand /><div className="window-dots"><i /><i /><i /></div><button className="icon-button mobile-only" onClick={() => setMobileSidebar((v) => !v)}><Menu size={17} /></button><div className="titlebar-divider" /><div className="history-buttons"><button className="icon-button" title="Back" onClick={navigateBack} disabled={navigationIndex <= 0}><ArrowLeft size={15} /></button><button className="icon-button" title="Forward" onClick={navigateForward} disabled={navigationIndex >= navigationHistory.length - 1}><ArrowRight size={15} /></button></div></div>
      <button className="command-search" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Search files, commands...</span><kbd>Ctrl K</kbd></button>
      <div className="titlebar-right"><button className="top-chip workspace-action" title="Import workspace" onClick={() => importInputRef.current?.click()}><Upload size={13} /> Import</button><button className="top-chip workspace-action" title="Export workspace ZIP" onClick={exportZip}><Download size={13} /> Export</button><button className="top-chip github-chip" onClick={() => window.open('https://github.com/CFSTUDIO-project/Code-Forge-new-', '_blank', 'noopener,noreferrer')}><Github size={14} /> GitHub</button><button className="icon-button" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={17} /></button></div>
    </header>

    <div className="ide-workarea">
      <nav className="activity-bar" aria-label="Main navigation">
        <button className={activeView === 'explorer' ? 'active' : ''} title="Explorer" onClick={() => setActiveView('explorer')}><LayoutPanelLeft size={20} /></button>
        <button className={activeView === 'search' ? 'active' : ''} title="Search" onClick={() => setActiveView('search')}><Search size={20} /></button>
        <button className={activeView === 'git' ? 'active' : ''} title="Source Control" onClick={() => setActiveView('git')}><GitBranch size={20} /></button>
        <button className={activeView === 'run' ? 'active' : ''} title="Run and Debug" onClick={() => setActiveView('run')}><Play size={19} /></button>
        <button className={activeView === 'extensions' ? 'active' : ''} title="Extensions" onClick={() => setActiveView('extensions')}><Blocks size={20} /><span className="activity-badge">{marketplaceItems.length}</span></button>
        <button className={activeView === 'workflows' ? 'active' : ''} title="Workflows" onClick={() => setActiveView('workflows')}><GitPullRequest size={20} /></button>
        <div className="activity-spacer" />
        <button title="Account" onClick={() => setProfileOpen((v) => !v)}><Avatar name={profileName} hue={guest?.hue} initials={guest?.initials} /></button>
        <button title="Manage" onClick={() => setSettingsOpen(true)}><Settings size={19} /></button>
      </nav>

      <aside className={`left-sidebar ${mobileSidebar ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><span>{activeView === 'explorer' ? 'EXPLORER' : activeView === 'search' ? 'SEARCH' : activeView === 'git' ? 'SOURCE CONTROL' : activeView === 'run' ? 'RUN & DEBUG' : activeView === 'extensions' ? 'EXTENSIONS' : 'WORKFLOWS'}</span><button className="icon-button tiny" title="More actions" onClick={() => setCommandOpen(true)}><MoreHorizontal size={16} /></button></div>
        {activeView === 'explorer' && <>
          <div className="sidebar-section-label"><span>OPEN EDITORS</span><span>{openTabs.length}</span></div>
          {openTabs.map((path) => { const file = files.find((item) => item.path === path); if (!file) return null; return <div key={path} className={`open-editor-row ${path === activePath ? 'current' : ''}`}><button onClick={() => openFile(path)}><FileIcon file={file} /><span>{file.name}</span></button><button className="close-open-tab" onClick={() => closeTab(path)}><X size={12} /></button></div>; })}
          <div className="sidebar-section-label project-heading"><span>CODEFORGE_PROJECT</span><button onClick={addFile} title="New file"><Plus size={14} /></button></div>
          <FileTree files={files} activePath={activePath} onOpen={openFile} onAdd={addFile} onDelete={deleteFile} />
          <div className="sidebar-bottom-accordions">
            <button onClick={() => setOutlineOpen((open) => !open)}><ChevronRight className={outlineOpen ? 'accordion-chevron open' : 'accordion-chevron'} size={13} /> OUTLINE <span>{outlineItems.length}</span></button>
            {outlineOpen && <div className="outline-list">{outlineItems.length ? outlineItems.map((item) => <button className="outline-item" key={`${activeFile?.path}:${item.line}`} onClick={() => { editorRef.current?.revealLineInCenter(item.line); editorRef.current?.setPosition({ lineNumber: item.line, column: 1 }); editorRef.current?.focus(); }}><span>{item.label}</span><small>{item.line}</small></button>) : <p className="outline-empty">No symbols or headings detected in this file.</p>}</div>}
            <button onClick={() => setRecentFilesOpen((open) => !open)}><ChevronRight className={recentFilesOpen ? 'accordion-chevron open' : 'accordion-chevron'} size={13} /> RECENT FILES <span>{recentFilePaths.length}</span></button>
            {recentFilesOpen && <div className="outline-list">{recentFilePaths.length ? recentFilePaths.map((path) => { const file = files.find((item) => item.path === path); return file ? <button className="outline-item recent-item" key={path} onClick={() => openFile(path)}><FileIcon file={file} size={12} /><span>{file.name}</span></button> : null; }) : <p className="outline-empty">Files you open will appear here.</p>}</div>}
          </div>
        </>}
        {activeView === 'search' && <div className="sidebar-content"><input className="search-input" placeholder="Search in files" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus /><div className="search-results">{searchQuery ? files.flatMap((file) => file.content.split('\n').map((line, index) => ({ file, line, index })).filter((entry) => entry.line.toLowerCase().includes(searchQuery.toLowerCase())).map((entry) => <button key={`${entry.file.path}:${entry.index}`} onClick={() => openFile(entry.file.path)}><b>{entry.file.name}:{entry.index + 1}</b><span>{entry.line.trim().slice(0, 100)}</span></button>)) : <p className="muted-copy">Search across your current workspace.</p>}</div></div>}
        {activeView === 'git' && <div className="sidebar-content"><div className="connection-card"><div className="connection-icon"><Github size={19} /></div><b>Git provider is not connected</b><p>This workspace edits files locally and syncs through Supabase when signed in. Clone, commit, push and pull are not enabled in this browser build.</p><button className="secondary-button" onClick={() => window.open('https://github.com/CFSTUDIO-project/Code-Forge-new-', '_blank', 'noopener,noreferrer')}>Open CODEFORGE repository <ExternalLink size={13} /></button></div><div className="sidebar-section-label"><span>LOCAL WORKSPACE FILES</span><span>{files.length}</span></div>{files.map((file) => <button className="change-row" key={file.id} onClick={() => openFile(file.path)}><FileIcon file={file} /><span>{file.path}</span><small>OPEN</small></button>)}<div className="marketplace-footnote">No fake Git status is shown. Import or export a ZIP to move your project between devices.</div></div>}
        {activeView === 'run' && <div className="sidebar-content"><div className="runtime-card"><div className="runtime-card-top"><span className="runtime-dot" /><b>Python / Pyodide</b></div><p>Browser WebAssembly runtime. First run downloads the pinned runtime files.</p><button className="primary-button compact" onClick={() => { const file = files.find((item) => item.name === 'main.py'); if (file) runPython(file.content, file.name); else notify('main.py was not found. Create it in Explorer first.'); }}>Run main.py <Play size={13} /></button><div className="runtime-card-top"><span className="runtime-dot blue" /><b>HTML Preview</b></div><p>Render the current HTML, CSS and JavaScript workspace in a sandboxed frame.</p><button className="secondary-button" onClick={runPreview}>Open Preview <Eye size={13} /></button></div><div className="sidebar-section-label"><span>SUPPORTED EXECUTION</span></div><div className="support-list"><span className="supported">Python · WebAssembly</span><span className="supported">JavaScript · Worker</span><span className="supported">HTML / CSS · iframe</span><span className="not-supported">C / Rust / Java · runtime not bundled</span></div></div>}
        {activeView === 'extensions' && <div className="sidebar-content marketplace-sidebar"><div className="market-mini-banner"><Sparkles size={17} /><div><b>Workspace Tool Catalog</b><small>Local preferences · no remote packages</small></div></div><div className="marketplace-tabs"><button className={extensionTab === 'discover' ? 'active' : ''} onClick={() => setExtensionTab('discover')}>Discover</button><button className={extensionTab === 'installed' ? 'active' : ''} onClick={() => setExtensionTab('installed')}>Installed <span>{installedExtensions.length}</span></button><button className={extensionTab === 'updates' ? 'active' : ''} onClick={() => setExtensionTab('updates')}>Updates</button></div>{extensionTab === 'discover' && <><input className="search-input extension-search" value={extensionSearch} onChange={(event) => setExtensionSearch(event.target.value)} placeholder="Search extensions…" /><div className="category-chips">{['All', 'Themes', 'Languages', 'Productivity', 'Git', 'Appearance'].map((category) => <button key={category} className={extensionCategory === category ? 'selected' : ''} onClick={() => setExtensionCategory(category)}>{category}</button>)}</div>{marketplaceItems.filter((item) => (extensionCategory === 'All' || item.category === extensionCategory) && `${item.name} ${item.description}`.toLowerCase().includes(extensionSearch.toLowerCase())).map((item) => { const installed = installedExtensions.includes(item.id); return <article className="extension-card" key={item.id}><div className="extension-card-top"><span className="extension-card-icon"><Puzzle size={15} /></span><span className="extension-tag">{item.tag}</span></div><b>{item.name}</b><p>{item.description}</p><div className="extension-meta">{item.publisher}<span>{item.downloads}</span></div><button className={installed ? 'extension-installed' : 'extension-install'} onClick={() => setInstalledExtensions((current) => installed ? current.filter((id) => id !== item.id) : [...current, item.id])}>{installed ? <><Check size={12} /> Installed · Remove</> : <><Plus size={12} /> Add to workspace</>}</button></article>; })}</>}{extensionTab === 'installed' && <>{marketplaceItems.filter((item) => installedExtensions.includes(item.id)).map((item) => <article className="extension-card" key={item.id}><b>{item.name}</b><p>{item.description}</p><button className="extension-installed" onClick={() => setInstalledExtensions((current) => current.filter((id) => id !== item.id))}><Trash2 size={12} /> Remove</button></article>)}{installedExtensions.length === 0 && <p className="muted-copy">No extensions have been added to this local workspace yet.</p>}</>}{extensionTab === 'updates' && <div className="empty-market"><CheckCircle2 size={20} /><b>No update feed connected</b><span>Updates are unavailable because no signed extension registry is configured.</span></div>}<div className="marketplace-footnote">This catalog stores local selections only. It does not download or execute third-party extension packages; no publisher feed is connected.</div></div>}
        {activeView === 'workflows' && <div className="sidebar-content"><div className="workflow-summary"><GitPullRequest size={20} /><b>GitHub Actions</b><p>Workflow definitions in this workspace are editable YAML files. Live run history requires a connected GitHub repository.</p></div><div className="sidebar-section-label"><span>WORKFLOW FILES</span></div>{files.filter((file) => file.path.includes('.github/workflows')).map((file) => <button className="workflow-file" key={file.id} onClick={() => openFile(file.path)}><FileText size={14} /><span>{file.name}</span><ChevronRight size={13} /></button>)}<button className="secondary-button full-width" onClick={() => window.open('https://github.com/features/actions', '_blank', 'noopener,noreferrer')}>GitHub Actions docs <ExternalLink size={13} /></button></div>}
      </aside>

      <main className={`editor-column ${panelOpen ? 'panel-visible' : 'panel-hidden'}`}>
        <div className="editor-tabbar">
          <div className="editor-tabs">{openTabs.map((path) => { const file = files.find((item) => item.path === path); if (!file) return null; return <button key={path} className={`editor-tab ${activePath === path ? 'active' : ''}`} onClick={() => openFile(path)}><FileIcon file={file} /><span>{file.name}</span><button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(path); }}><X size={12} /></button></button>; })}<button className="new-tab-button" onClick={addFile} title="New file"><Plus size={15} /></button></div>
          <div className="editor-actions"><button title="Open terminal" aria-label="Open terminal" onClick={openTerminal}><Terminal size={15} /></button><button title="Run current file" onClick={runActiveFile}><Play size={15} className="run-icon" /></button><button title="Open preview" onClick={runPreview}><Eye size={15} /></button><button title={splitView ? 'Close split editor' : 'Split editor'} onClick={() => { setSplitView((value) => !value); const next = files.find((file) => file.path !== activePath); if (next) setSplitPath(next.path); }}><Columns2 size={15} /></button><button title="More editor actions" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={16} /></button></div>
        </div>
        <div className="breadcrumbs"><span>CODEFORGE_PROJECT</span><ChevronRight size={12} /><span>{activeFile?.path.split('/').filter(Boolean).slice(0, -1).join(' / ') || 'src'}</span><ChevronRight size={12} /><b>{activeFile?.name ?? 'No file selected'}</b></div>
        <div className={`editor-surface ${splitView ? 'split-active' : ''}`}>
          {activeFile ? (splitView ? <div className="split-editor-layout">
            <section className="split-editor-pane"><div className="split-pane-heading"><span><FileIcon file={activeFile} size={13} /> {activeFile.name}</span><small>PRIMARY</small></div><div className="split-pane-editor"><CodeEditor file={{ ...activeFile, content: activeFile.content }} onChange={(value) => updateFile(activeFile.path, value)} onMount={onEditorMount} fontSize={fontSize} wordWrap={wordWrap} showMinimap={showMinimap} /></div></section>
            <section className="split-editor-pane"><div className="split-pane-heading"><select aria-label="Select file for split editor" value={files.some((file) => file.path === splitPath) ? splitPath : activeFile.path} onChange={(event) => setSplitPath(event.target.value)}>{files.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select><button title="Close split editor" onClick={() => setSplitView(false)}><X size={13} /></button></div><div className="split-pane-editor">{(() => { const sideFile = files.find((file) => file.path === splitPath) ?? activeFile; return <Editor height="100%" path={`split:${sideFile.path}`} language={languageForFile(sideFile.name).monaco} value={sideFile.content} theme="codeforge-dark" onChange={(value) => updateFile(sideFile.path, value ?? '')} onMount={onEditorMount} options={{ automaticLayout: true, fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace', fontSize, lineHeight: 22, minimap: { enabled: showMinimap && window.innerWidth > 1100, scale: 1 }, scrollBeyondLastLine: false, smoothScrolling: true, cursorBlinking: 'smooth', padding: { top: 15, bottom: 18 }, tabSize: 2, wordWrap: wordWrap ? 'on' : 'off', bracketPairColorization: { enabled: true }, guides: { indentation: true, bracketPairs: true } }} />; })()}</div></section>
          </div> : <CodeEditor file={{ ...activeFile, content: activeFile.content }} onChange={(value) => updateFile(activeFile.path, value)} onMount={onEditorMount} fontSize={fontSize} wordWrap={wordWrap} showMinimap={showMinimap} />) : <div className="empty-editor"><FileCode2 size={34} /><h3>No editor open</h3><p>Select a file from Explorer to start editing.</p><button className="secondary-button" onClick={addFile}>Create a file <Plus size={14} /></button></div>}
          {previewOpen && <div className="preview-overlay"><div className="preview-toolbar"><div><Globe size={14} /><b>Live Preview</b><span>localhost · sandbox</span></div><div><button title="Refresh" onClick={runPreview}><RefreshCw size={14} /></button><button title="Open preview separately" onClick={() => { const blob = new Blob([previewDocument], { type: 'text/html' }); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }}><ExternalLink size={14} /></button><button title="Close preview" onClick={() => setPreviewOpen(false)}><X size={15} /></button></div></div><iframe key={previewKey} ref={previewFrameRef} title="CODEFORGE Live Preview" sandbox="allow-scripts allow-forms allow-modals allow-downloads" srcDoc={previewDocument} /></div>}
        </div>
        <div className="mobile-keyboard-strip" aria-label="Coding keys">
          <button className="mobile-terminal-quick" onClick={openTerminal}><Terminal size={13} /> TERMINAL</button>
          {['CTRL', 'ALT', 'SHIFT', 'TAB', '{', '}', '(', ')', '[', ']', ';', '"', "'", '=', '=>', 'A', 'Z', 'Y', 'C', 'ENTER', 'LEFT', 'UP', 'DOWN', 'RIGHT'].map((key) => <button key={key} className={keyboardMode === key.toLowerCase() ? 'key-active' : ''} onClick={() => handleMobileKey(key)}>{key === 'LEFT' ? <ArrowLeft size={13} /> : key === 'RIGHT' ? <ArrowRight size={13} /> : key === 'UP' ? <ArrowUp size={13} /> : key === 'DOWN' ? <ArrowDown size={13} /> : key}</button>)}
        </div>
        <section className={`bottom-panel ${panelOpen ? 'panel-open' : 'panel-closed'}`}>
          <div className="panel-header"><div className="panel-tabs">{(['terminal', 'problems', 'output', 'debug'] as PanelTab[]).map((tab) => <button key={tab} className={panelTab === tab ? 'selected' : ''} onClick={() => { setPanelTab(tab); setPanelOpen(true); }}>{tab === 'terminal' ? 'TERMINAL' : tab === 'problems' ? 'PROBLEMS' : tab === 'output' ? 'OUTPUT' : 'DEBUG CONSOLE'}{tab === 'problems' && problems.length > 0 && <span className="problem-count">{problems.length}</span>}</button>)}</div><div className="panel-controls">{panelTab === 'terminal' && <><span className="terminal-profile"><Terminal size={13} /> workspace</span><button title="New terminal" onClick={() => { setTerminalCwd('/workspace'); setTerminalLines([{ id: 1, kind: 'info', text: 'New CODEFORGE workspace terminal session.' }, { id: 2, kind: 'success', text: 'Type help to list available commands.' }]); terminalIdRef.current = 2; }}><Plus size={14} /></button><button title="Stop execution" onClick={stopExecution}><Square size={12} /></button><button title="Clear terminal" onClick={() => setTerminalLines([])}><Trash2 size={14} /></button></>}<button title={panelOpen ? 'Collapse panel' : 'Expand panel'} onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></div></div>
          {panelOpen && <div className="panel-content">
            {panelTab === 'terminal' && <div className="terminal-view"><div className="terminal-output">{terminalLines.map((line) => <div key={line.id} className={`terminal-line ${line.kind}`}><span>{line.text}</span></div>)}<div ref={terminalEndRef} /></div><form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); const command = terminalInput.trim(); if (command) setTerminalHistory((history) => [...history.slice(-99), command]); setTerminalHistoryIndex(-1); executeCommand(terminalInput); setTerminalInput(''); }}><span className="terminal-prompt">{terminalCwd.replace('/workspace', 'workspace')}$</span><input ref={terminalInputRef} value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'ArrowUp' && terminalHistory.length) { event.preventDefault(); const next = Math.min(terminalHistory.length - 1, Math.max(0, terminalHistoryIndex + 1)); setTerminalHistoryIndex(next); setTerminalInput(terminalHistory[terminalHistory.length - 1 - next] ?? ''); } else if (event.key === 'ArrowDown' && terminalHistory.length) { event.preventDefault(); const next = terminalHistoryIndex - 1; setTerminalHistoryIndex(next); setTerminalInput(next < 0 ? '' : terminalHistory[terminalHistory.length - 1 - next] ?? ''); } }} placeholder="Type a command… (help for commands)" autoCapitalize="off" autoCorrect="off" spellCheck={false} /><button type="submit" title="Run command"><ArrowRight size={15} /></button></form></div>}
            {panelTab === 'problems' && <div className="problems-view">{problems.length ? problems.map((problem, index) => <button className={`problem-row ${problem.severity}`} key={`${problem.path}:${problem.line}:${index}`} onClick={() => { const target = problem.path.replace(/^\/split:/, ''); if (files.some((file) => file.path === target)) openFile(target); window.setTimeout(() => { if (problem.line) { editorRef.current?.revealLineInCenter(problem.line); editorRef.current?.setPosition({ lineNumber: problem.line, column: 1 }); editorRef.current?.focus(); } }, 80); }}><AlertCircle size={13} /><span>{problem.message}<small>{problem.path}{problem.line ? ` · line ${problem.line}` : ''}</small></span><b>{problem.severity.toUpperCase()}</b></button>) : <div className="empty-panel-state"><CheckCircle2 size={22} /><b>No diagnostics reported</b><span>Problems appear here when the active Monaco language service reports errors or warnings.</span></div>}</div>}
            {panelTab === 'output' && <div className="output-view"><div className="output-line"><CheckCircle2 size={13} /> CODEFORGE workspace initialized.</div><div className="output-line"><InfoIcon /> Python runtime: {runtimeState === 'ready' ? `ready (${runtimeVersion})` : runtimeState === 'loading' ? 'loading' : runtimeState === 'error' ? 'error' : 'not started'}.</div><div className="output-line"><InfoIcon /> Firebase configured: {firebaseConfigured ? 'yes' : 'no'} · Supabase configured: {supabaseConfigured ? 'yes' : 'no'}.</div></div>}
            {panelTab === 'debug' && <div className="empty-panel-state"><Activity size={22} /><b>Debug console</b><span>Language-specific debugging adapters are not bundled in this starter release.</span></div>}
          </div>}
        </section>
      </main>

      {rightOpen && <aside className="right-sidebar"><div className="right-tabs"><button className={rightTab === 'git' ? 'active' : ''} onClick={() => setRightTab('git')}><GitBranch size={14} /> SOURCE CONTROL</button><button className={rightTab === 'inspector' ? 'active' : ''} onClick={() => setRightTab('inspector')}><ListFilter size={14} /> INSPECTOR</button><button className="right-close" title="Hide right sidebar" onClick={() => setRightOpen(false)}><X size={14} /></button></div>{rightTab === 'git' ? <div className="inspector-panel"><div className="inspector-heading"><b>VERSION CONTROL</b><span className="muted-tag">DISCONNECTED</span></div><div className="file-inspector-icon"><Github size={23} /></div><h3>Local workspace</h3><div className="inspector-row"><span>Files</span><b>{files.length}</b></div><div className="inspector-row"><span>Git remote</span><b>Not connected</b></div><div className="inspector-row"><span>Cloud sync</span><b>{authUser ? syncState : 'Local only'}</b></div><div className="inspector-section"><div className="inspector-heading"><b>AVAILABLE ACTIONS</b></div><button className="secondary-button full-width" onClick={exportZip}><Download size={13} /> Export source ZIP</button><button className="secondary-button full-width" onClick={() => importInputRef.current?.click()}><Upload size={13} /> Import repository ZIP</button><p className="muted-copy">Git branch history and commit actions require an authenticated Git provider. This panel reports the real connection state instead of drawing sample commits.</p></div></div> : <div className="inspector-panel"><div className="inspector-heading"><b>ACTIVE FILE</b><MoreHorizontal size={14} /></div><div className="file-inspector-icon">{activeFile && <FileIcon file={activeFile} size={23} />}</div><h3>{activeFile?.name ?? 'No selection'}</h3><div className="inspector-row"><span>Language</span><b>{activeLanguage?.label ?? '—'}</b></div><div className="inspector-row"><span>Lines</span><b>{activeFile?.content.split('\n').length ?? 0}</b></div><div className="inspector-row"><span>Characters</span><b>{activeFile?.content.length ?? 0}</b></div><div className="inspector-row"><span>Path</span><b>{activeFile?.path ?? '—'}</b></div><div className="inspector-section"><div className="inspector-heading"><b>LANGUAGE SUPPORT</b></div><p className="muted-copy">Syntax highlighting and editor assistance depend on the language service. Runtime availability is shown separately.</p></div></div>}</aside>}
      {!rightOpen && <button className="reopen-right" title="Show right panel" onClick={() => setRightOpen(true)}><PanelRight size={16} /></button>}
    </div>

    <footer className="statusbar"><div className="status-left"><span><GitBranch size={12} /> LOCAL</span><span><CircleDot size={12} /> 0</span><span><AlertCircle size={12} /> {problems.length} Problems</span></div><div className="status-right"><span>{activeLanguage?.label ?? 'Plain Text'}</span><span>UTF-8</span><span>Spaces: 2</span><span>Ln 1, Col 1</span><span className="status-runtime">{runtimeState === 'ready' ? 'Python ready' : runtimeState === 'loading' ? 'Python loading' : 'Runtime idle'}</span><span className={`sync-indicator ${syncState}`}><Cloud size={12} /> {authUser ? syncState : 'Local'}</span><button title="Notifications" onClick={() => notify('No notification service is connected to this browser build.')}><Bell size={13} /></button></div></footer>

    {profileOpen && <><button className="click-away" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" /><div className="profile-popover"><div className="profile-header"><Avatar name={profileName} hue={guest?.hue} initials={guest?.initials} /><div><b>{profileName}</b><span>{displayHandle}</span><small><i /> {guest ? 'Guest session' : 'Signed in'}</small></div></div><div className="profile-stats"><span><b>{files.length}</b> files</span><span><b>{installedExtensions.length}</b> saved tools</span></div><div className="profile-menu-section"><small>ACCOUNT</small><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><UserCircle2 size={15} /> My Profile</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><ShieldCheck size={15} /> Account & Security</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Cloud size={15} /> Connected Accounts</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Monitor size={15} /> Sessions & Devices</button></div><div className="profile-menu-section"><small>WORKSPACE</small><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><PaletteIcon /> Appearance & Themes</button><button onClick={() => { setProfileOpen(false); notify('Shortcuts: Ctrl/Cmd+S save · Ctrl/Cmd+K command palette · Ctrl/Cmd+Shift+P command palette · Arrow Up/Down terminal history.'); }}><Keyboard size={15} /> Keyboard Shortcuts</button><button onClick={() => { setProfileOpen(false); setActiveView('extensions'); }}><Puzzle size={15} /> Workspace Tool Catalog</button><button onClick={() => { setProfileOpen(false); void syncNow(); }}><CloudUpload size={15} /> Cloud Sync</button><button onClick={() => { setProfileOpen(false); void showStorageUsage(); }}><HardDrive size={15} /> Storage Manager</button></div><div className="profile-menu-section"><small>SUPPORT</small><button onClick={() => window.open('https://github.com/', '_blank', 'noopener,noreferrer')}><Github size={15} /> Open Source</button><button onClick={() => window.open('https://github.com/CFSTUDIO-project/Code-Forge-new-/blob/main/README.md', '_blank', 'noopener,noreferrer')}><BookOpen size={15} /> Documentation</button><button onClick={() => window.open('https://github.com/CFSTUDIO-project/Code-Forge-new-/issues/new', '_blank', 'noopener,noreferrer')}><MessageSquare size={15} /> Report a Bug</button><button onClick={() => notify('CODEFORGE V2 · Browser development workspace.')}><CircleHelp size={15} /> About CODEFORGE</button></div><button className="logout-button" onClick={() => void signOut()}><LogOut size={15} /> Log Out</button></div></>}

    {settingsOpen && <div className="modal-backdrop"><section className="settings-modal"><div className="modal-title"><div><small>CODEFORGE PREFERENCES</small><h2>Settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={17} /></button></div><div className="settings-content"><section><h3>Editor</h3><div className="setting-row"><div><b>Font size</b><span>Adjust code editor typography.</span></div><div className="stepper"><button onClick={() => changeFontSize(-1)}>−</button><b>{fontSize}px</b><button onClick={() => changeFontSize(1)}>+</button></div></div><div className="setting-row"><div><b>Word wrap</b><span>Wrap long lines in the editor.</span></div><button className={`toggle ${wordWrap ? 'on' : ''}`} onClick={() => setWordWrap((v) => !v)}><i /></button></div><div className="setting-row"><div><b>Minimap</b><span>Show code overview in the editor.</span></div><button className={`toggle ${showMinimap ? 'on' : ''}`} onClick={() => setShowMinimap((v) => !v)}><i /></button></div><div className="setting-row"><div><b>Integrated terminal</b><span>Keep the workspace terminal visible when opening the IDE.</span></div><button className={`toggle ${panelOpen ? 'on' : ''}`} onClick={() => { setPanelTab('terminal'); setPanelOpen((v) => !v); }}><i /></button></div><div className="setting-row"><div><b>Automatic local save</b><span>Save changes to this device after edits.</span></div><button className={`toggle ${autoSave ? 'on' : ''}`} onClick={() => setAutoSave((v) => !v)}><i /></button></div></section><section><h3>Workspace</h3><div className="setting-row"><div><b>Import project</b><span>Load a ZIP, CODEFORGE backup or text file.</span></div><button className="secondary-button compact" onClick={() => importInputRef.current?.click()}><Upload size={13} /> Import</button></div><div className="setting-row"><div><b>Export project</b><span>Download source files as a ZIP archive.</span></div><button className="secondary-button compact" onClick={exportZip}><Download size={13} /> Export</button></div><div className="setting-row"><div><b>Portable backup</b><span>Save a JSON workspace snapshot.</span></div><button className="secondary-button compact" onClick={exportJson}>Backup JSON</button></div></section><section><h3>Cloud services</h3><div className="setting-row"><div><b>Supabase</b><span>Auth, database and project sync.</span></div><span className={`service-state ${supabaseConfigured ? 'good' : 'off'}`}>{supabaseConfigured ? 'Configured' : 'Not configured'}</span></div><div className="setting-row"><div><b>Firebase</b><span>Optional Firebase app / messaging setup.</span></div><span className={`service-state ${firebaseConfigured ? 'good' : 'off'}`}>{firebaseConfigured ? 'Configured' : 'Optional'}</span></div><div className="setting-row"><div><b>Workspace sync</b><span>{authUser ? 'Signed-in workspace syncs after edits.' : 'Guest workspaces stay on this device.'}</span></div><button className="secondary-button compact" onClick={() => { setSettingsOpen(false); void syncNow(); }}>Sync now <CloudUpload size={13} /></button></div></section><section><h3>Runtime support</h3><div className="runtime-grid"><span className="good-runtime"><CheckCircle2 size={13} /> Python · Pyodide</span><span className="good-runtime"><CheckCircle2 size={13} /> JavaScript · Worker</span><span className="good-runtime"><CheckCircle2 size={13} /> HTML · Preview</span><span className="pending-runtime"><AlertCircle size={13} /> C / Rust / Java · editor only</span></div></section></div><div className="modal-actions"><button className="quiet-button" onClick={() => setSettingsOpen(false)}>Close</button><button className="primary-button" onClick={() => { setSettingsOpen(false); notify('Preferences applied to the current session.'); }}>Done <Check size={15} /></button></div></section></div>}

    {commandOpen && <div className="modal-backdrop command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><section className="command-palette"><div className="command-input-wrap"><Command size={16} /><input autoFocus placeholder="Type a command or search…" value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && filteredCommands[0]) { filteredCommands[0].run(); setCommandOpen(false); setCommandQuery(''); } }} /><kbd>ESC</kbd></div><div className="command-results">{filteredCommands.map((item) => <button key={item.id} onClick={() => { item.run(); setCommandOpen(false); setCommandQuery(''); }}><Zap size={14} /><span><b>{item.label}</b><small>{item.detail}</small></span><ChevronRight size={14} /></button>)}</div></section></div>}

    <input ref={importInputRef} className="visually-hidden" type="file" accept=".zip,.codeforge.json,.txt,.html,.htm,.css,.js,.jsx,.ts,.tsx,.py,.json,.md,.yml,.yaml,.xml,.sql,.sh,.toml,.rs,.go,.java,.kt,.php,.lua,.c,.h,.cpp,.cs,.svg" onChange={importWorkspace} />

    {newFileOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewFileOpen(false); }}><section className="new-file-modal"><div className="modal-title"><div><small>EXPLORER · NEW RESOURCE</small><h2>Create a file</h2></div><button className="icon-button" onClick={() => setNewFileOpen(false)}><X size={17} /></button></div><div className="new-file-body"><label htmlFor="new-file-name">File name or relative path</label><div className="new-file-input-wrap"><FileIcon file={{ id: 'preview', name: newFileName.split('/').at(-1) || 'untitled', path: '/', content: '' }} size={18} /><input id="new-file-name" autoFocus value={newFileName} onChange={(event) => { setNewFileName(event.target.value); setNewFileError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') createFileFromDialog(); }} placeholder="example: src/main.py" /></div><div className="new-file-detected"><span>{languageForFile(newFileName.split('/').at(-1) || '').label}</span><span>{languageForFile(newFileName.split('/').at(-1) || '').monaco}</span></div>{newFileError && <p className="new-file-error">{newFileError}</p>}<p className="new-file-hint">The file icon and language switch automatically when you complete a recognized extension, such as <b>.py</b>, <b>.tsx</b> or <b>.html</b>.</p></div><div className="modal-actions"><button className="quiet-button" onClick={() => setNewFileOpen(false)}>Cancel</button><button className="primary-button" onClick={createFileFromDialog} disabled={!newFileName.trim()}>Create file <Plus size={15} /></button></div></section></div>}

    {toast && <div className="toast"><CheckCircle2 size={15} />{toast}</div>}
  </div>;
}

function InfoIcon() { return <span className="info-icon">i</span>; }
function PaletteIcon() { return <span className="palette-icon"><Sparkles size={14} /></span>; }

export default App;
