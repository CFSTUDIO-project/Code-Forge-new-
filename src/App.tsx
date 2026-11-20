import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
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
} from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import { firebaseConfigured } from './lib/firebase';
import { languageForFile } from './lib/language';
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
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'OAuth sign-in failed.');
    } finally {
      setBusy(false);
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
      <div className="login-footnote"><span>v0.1.0 · OPEN SOURCE</span><span>Built for creators and developers</span><span>Documentation · Privacy</span></div>
    </main>
    {showGuestWarning && <div className="modal-backdrop"><section className="modal-card warning-modal"><div className="modal-symbol"><ShieldCheck size={22} /></div><h2>Enter as a guest?</h2><p>You are using a guest account, if you log out, all projects will be lost.</p><div className="warning-note">Guest projects stay on this device. They are not automatically uploaded to cloud storage.</div><div className="modal-actions"><button className="quiet-button" onClick={() => setShowGuestWarning(false)}>Go back</button><button className="primary-button" onClick={() => onGuest(makeGuestProfile())}>Accept the risk <ArrowRight size={15} /></button></div></section></div>}
  </div>;
}

function FileIcon({ file, size = 15 }: { file: WorkspaceFile; size?: number }) {
  const info = languageForFile(file.name);
  const Icon = info.icon;
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
    {menuPath === '/' && <div className="tree-context root-context"><button onClick={() => { onAdd(); setMenuPath(null); }}>New file</button><button onClick={() => { onAdd(); setMenuPath(null); }}>New folder / file</button></div>}
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

function CodeEditor({ file, onChange, onMount, fontSize = 13, wordWrap = false }: { file: WorkspaceFile; onChange: (value: string) => void; onMount: OnMount; fontSize?: number; wordWrap?: boolean }) {
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
      minimap: { enabled: window.innerWidth > 1100, scale: 1, showSlider: 'mouseover' },
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
  const [openTabs, setOpenTabs] = useState<string[]>(['/index.html', '/script.js', '/main.py']);
  const [activeView, setActiveView] = useState<ActivityView>('explorer');
  const [panelTab, setPanelTab] = useState<PanelTab>('terminal');
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'git' | 'inspector'>('git');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: 1, kind: 'info', text: 'CODEFORGE integrated terminal · browser workspace' },
    { id: 2, kind: 'success', text: 'Workspace ready. Type "help" to see supported commands.' },
  ]);
  const [toast, setToast] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [extensionTab, setExtensionTab] = useState<'discover' | 'installed' | 'updates'>('discover');
  const [extensionSearch, setExtensionSearch] = useState('');
  const [extensionCategory, setExtensionCategory] = useState('All');
  const [installedExtensions, setInstalledExtensions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cf-installed-extensions') ?? '[]') as string[]; } catch { return []; }
  });
  const [syncState, setSyncState] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [fontSize, setFontSize] = useState(13);
  const [wordWrap, setWordWrap] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState<'idle' | 'ctrl' | 'alt' | 'shift'>('idle');
  const [problems, setProblems] = useState<Array<{ message: string; line?: number; severity: 'error' | 'warning' | 'info' }>>([]);
  const [runtimeState, setRuntimeState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [runtimeVersion, setRuntimeVersion] = useState('');
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pythonWorkerRef = useRef<Worker | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
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
    if (!supabase) { setAuthChecking(false); return; }
    let alive = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setAuthUser(session?.user ?? null);
      setAuthChecking(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.warn('Session restore failed:', error.message);
      setAuthUser(data.session?.user ?? null);
      setAuthChecking(false);
    }).catch((error) => {
      if (alive) { console.warn(error); setAuthChecking(false); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
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
    void saveWorkspace(files).catch((error) => notify(`Local save failed: ${String(error)}`));
  }, [files, workspaceReady, notify]);

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
    localStorage.setItem('cf-installed-extensions', JSON.stringify(installedExtensions));
  }, [installedExtensions]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); notify('Workspace saved locally.'); }
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

  useEffect(() => () => { pythonWorkerRef.current?.terminate(); }, []);

  const activeFile = files.find((file) => file.path === activePath) ?? files[0];
  const updateFile = (path: string, content: string) => setFiles((current) => current.map((file) => file.path === path ? { ...file, content } : file));
  const openFile = (path: string) => {
    setActivePath(path);
    setOpenTabs((tabs) => tabs.includes(path) ? tabs : [...tabs, path]);
    setMobileSidebar(false);
  };
  const closeTab = (path: string) => {
    const remaining = openTabs.filter((item) => item !== path);
    setOpenTabs(remaining);
    if (activePath === path && remaining.length) setActivePath(remaining[remaining.length - 1]);
  };
  const addFile = () => {
    const name = window.prompt('New file name (example: app.tsx)');
    if (!name?.trim()) return;
    if (files.some((file) => file.path.toLowerCase() === `/${name.trim().toLowerCase()}`)) return notify('A file with this name already exists.');
    const file = newFile(name.trim());
    setFiles((current) => [...current, file]);
    openFile(file.path);
    notify(`${file.name} created.`);
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
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: completions.map((item) => ({ ...item, range, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet })) };
      },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => notify('Workspace saved.'));
    editor.focus();
  };

  const runPython = (code: string, fileName: string) => {
    setPanelOpen(true); setPanelTab('terminal'); setRuntimeState('loading');
    appendTerminal('info', `Starting Python runtime for ${fileName}…`);
    pythonWorkerRef.current?.terminate();
    const worker = new Worker(`${import.meta.env.BASE_URL}workers/python.worker.js`);
    pythonWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type: string; text?: string; version?: string };
      if (data.type === 'ready') { setRuntimeState('ready'); setRuntimeVersion(data.version ?? 'WebAssembly'); appendTerminal('success', `Python runtime ready · ${data.version ?? 'Pyodide'}`); }
      if (data.type === 'stdout') appendTerminal('stdout', data.text ?? '');
      if (data.type === 'stderr') appendTerminal('stderr', data.text ?? '');
      if (data.type === 'error') { setRuntimeState('error'); appendTerminal('stderr', data.text ?? 'Python runtime error'); worker.terminate(); }
      if (data.type === 'done') { appendTerminal('success', 'Process finished with exit code 0'); worker.terminate(); }
    };
    worker.onerror = (event) => { setRuntimeState('error'); appendTerminal('stderr', `Python worker error: ${event.message}`); worker.terminate(); };
    worker.postMessage({ type: 'run', code });
  };

  const runJavaScript = (code: string, fileName: string) => {
    setPanelOpen(true); setPanelTab('terminal');
    appendTerminal('info', `Running ${fileName} in isolated browser Worker…`);
    const worker = new Worker(`${import.meta.env.BASE_URL}workers/javascript.worker.js`);
    const timeout = window.setTimeout(() => { worker.terminate(); appendTerminal('stderr', 'Execution stopped after 5 seconds (time limit).'); }, 5000);
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type: string; text?: string };
      if (data.type === 'stdout') appendTerminal('stdout', data.text ?? '');
      if (data.type === 'stderr') appendTerminal('stderr', data.text ?? '');
      if (data.type === 'error') appendTerminal('stderr', data.text ?? 'JavaScript error');
      if (data.type === 'done') { appendTerminal('success', 'Browser JavaScript execution finished.'); window.clearTimeout(timeout); worker.terminate(); }
    };
    worker.onerror = (event) => { appendTerminal('stderr', event.message); window.clearTimeout(timeout); worker.terminate(); };
    worker.postMessage({ code });
  };

  const runPreview = () => {
    const document = buildPreview(files);
    setPreviewDocument(document); setPreviewKey((key) => key + 1); setPreviewOpen(true);
    appendTerminal('success', 'Live Preview refreshed from the current workspace files.');
  };

  const runActiveFile = () => {
    if (!activeFile) return notify('Open a file first.');
    const language = languageForFile(activeFile.name);
    if (language.runnable === 'python') runPython(activeFile.content, activeFile.name);
    else if (language.runnable === 'javascript') runJavaScript(activeFile.content, activeFile.name);
    else if (language.runnable === 'preview') runPreview();
    else notify(`${language.label} has editor support, but no runtime is bundled in this build.`);
  };

  const executeCommand = (commandText: string) => {
    const raw = commandText.trim();
    if (!raw) return;
    appendTerminal('command', `$ ${raw}`);
    const [command, ...args] = raw.split(' ');
    const argument = args.join(' ');
    if (command === 'clear' || command === 'cls') { setTerminalLines([]); return; }
    if (command === 'help') {
      ['Supported workspace commands:', '  help                 Show this help', '  pwd                  Show workspace path', '  ls                   List workspace files', '  cat <file>           Print a file', '  echo <text>          Print text', '  touch <file>         Create a file', '  mkdir <name>         Create a folder marker', '  python <file.py>     Run Python through Pyodide/WebAssembly', '  js <file.js>         Run JavaScript in a disposable Worker', '  preview              Open the HTML/CSS/JS live preview', '  clear                Clear the terminal', '', 'This is a workspace terminal, not a full operating-system shell.'].forEach((line) => appendTerminal('info', line));
      return;
    }
    if (command === 'pwd') return appendTerminal('stdout', '/workspace');
    if (command === 'ls') {
      files.forEach((file) => appendTerminal('stdout', file.path));
      return;
    }
    if (command === 'echo') return appendTerminal('stdout', argument);
    if (command === 'cat') {
      const target = files.find((file) => file.name === argument || file.path === argument || file.path === `/${argument}`);
      return target ? target.content.split('\n').forEach((line) => appendTerminal('stdout', line)) : appendTerminal('stderr', `cat: ${argument}: file not found`);
    }
    if (command === 'touch') {
      if (!argument) return appendTerminal('stderr', 'touch: missing file name');
      if (files.some((file) => file.name === argument)) return appendTerminal('info', `${argument} already exists.`);
      const file = newFile(argument); setFiles((current) => [...current, file]); openFile(file.path); appendTerminal('success', `Created ${file.path}`); return;
    }
    if (command === 'mkdir') return argument ? appendTerminal('success', `Folder marker created: ${argument} (virtual workspace)` ) : appendTerminal('stderr', 'mkdir: missing folder name');
    if (command === 'preview') return runPreview();
    if (command === 'python' || command === 'py') {
      const target = files.find((file) => file.name === (argument || 'main.py'));
      if (!target) return appendTerminal('stderr', `python: ${argument || 'main.py'} not found`);
      if (!target.name.endsWith('.py')) return appendTerminal('stderr', 'The selected file does not have a .py extension.');
      runPython(target.content, target.name); return;
    }
    if (command === 'js') {
      const target = files.find((file) => file.name === (argument || 'script.js'));
      if (!target) return appendTerminal('stderr', `js: ${argument || 'script.js'} not found`);
      runJavaScript(target.content, target.name); return;
    }
    appendTerminal('stderr', `Command not found: ${command}. Type "help" for supported commands.`);
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
      if (lower === 's') notify('Workspace saved.');
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
    if (authUser && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) return notify(`Sign out failed: ${error.message}`);
    }
    pythonWorkerRef.current?.terminate();
    await clearWorkspace();
    sessionStorage.removeItem('cf-guest-profile');
    setGuest(null); setAuthUser(null); setFiles(starterFiles); setWorkspaceReady(false); setProfileOpen(false);
  };

  const startGuest = (profile: GuestProfile) => {
    sessionStorage.setItem('cf-guest-profile', JSON.stringify(profile));
    setGuest(profile);
  };

  const syncNow = async () => {
    if (!authUser) return notify('Sign in to sync this workspace to cloud.');
    setSyncState('syncing');
    try { await syncWorkspaceToCloud(authUser, files); setSyncState('synced'); notify('Cloud sync completed.'); }
    catch (error) { setSyncState('error'); notify(`Cloud sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`); }
  };

  const changeFontSize = (direction: number) => setFontSize((size) => Math.max(11, Math.min(20, size + direction)));

  if (authChecking) return <div className="boot-screen"><Brand /><div className="spinner large-spinner" /><span>Restoring secure session…</span></div>;
  if (!authUser && !guest) return <LoginScreen onGuest={startGuest} />;

  const profileName = displayName;
  const activeLanguage = activeFile ? languageForFile(activeFile.name) : null;
  const filteredCommands = [
    { id: 'save', label: 'Save workspace', detail: 'Ctrl / Cmd + S', run: () => notify('Workspace saved locally.') },
    { id: 'preview', label: 'Open Live Preview', detail: 'Run HTML, CSS and JavaScript', run: runPreview },
    { id: 'terminal', label: 'Toggle terminal panel', detail: 'Show or hide the bottom panel', run: () => setPanelOpen((open) => !open) },
    { id: 'search', label: 'Search in files', detail: 'Find text in this workspace', run: () => setActiveView('search') },
    { id: 'extensions', label: 'Open Extension Marketplace', detail: 'Browse local extension catalog', run: () => setActiveView('extensions') },
    { id: 'workflows', label: 'Open Workflows', detail: 'Inspect repository workflow files', run: () => setActiveView('workflows') },
    { id: 'settings', label: 'Open Settings', detail: 'Editor and workspace preferences', run: () => setSettingsOpen(true) },
  ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(commandQuery.toLowerCase()));

  return <div className="ide-shell">
    <header className="ide-titlebar">
      <div className="titlebar-left"><Brand /><div className="window-dots"><i /><i /><i /></div><button className="icon-button mobile-only" onClick={() => setMobileSidebar((v) => !v)}><Menu size={17} /></button><div className="titlebar-divider" /><div className="history-buttons"><button className="icon-button" title="Back"><ArrowLeft size={15} /></button><button className="icon-button" title="Forward"><ArrowRight size={15} /></button></div></div>
      <button className="command-search" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Search files, commands...</span><kbd>Ctrl K</kbd></button>
      <div className="titlebar-right"><button className="top-chip" onClick={() => notify('CODEFORGE is an open-source project.')}><Github size={14} /> Open Source</button><button className="top-chip github-chip" onClick={() => window.open('https://github.com/', '_blank', 'noopener,noreferrer')}><Github size={14} /> GitHub</button><button className="icon-button" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={17} /></button></div>
    </header>

    <div className="ide-workarea">
      <nav className="activity-bar" aria-label="Main navigation">
        <button className={activeView === 'explorer' ? 'active' : ''} title="Explorer" onClick={() => setActiveView('explorer')}><LayoutPanelLeft size={20} /></button>
        <button className={activeView === 'search' ? 'active' : ''} title="Search" onClick={() => setActiveView('search')}><Search size={20} /></button>
        <button className={activeView === 'git' ? 'active' : ''} title="Source Control" onClick={() => setActiveView('git')}><GitBranch size={20} /></button>
        <button className={activeView === 'run' ? 'active' : ''} title="Run and Debug" onClick={() => setActiveView('run')}><Play size={19} /></button>
        <button className={activeView === 'extensions' ? 'active' : ''} title="Extensions" onClick={() => setActiveView('extensions')}><Blocks size={20} /><span className="activity-badge">6</span></button>
        <button className={activeView === 'workflows' ? 'active' : ''} title="Workflows" onClick={() => setActiveView('workflows')}><GitPullRequest size={20} /></button>
        <div className="activity-spacer" />
        <button title="Account" onClick={() => setProfileOpen((v) => !v)}><Avatar name={profileName} hue={guest?.hue} initials={guest?.initials} /></button>
        <button title="Manage" onClick={() => setSettingsOpen(true)}><Settings size={19} /></button>
      </nav>

      <aside className={`left-sidebar ${mobileSidebar ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><span>{activeView === 'explorer' ? 'EXPLORER' : activeView === 'search' ? 'SEARCH' : activeView === 'git' ? 'SOURCE CONTROL' : activeView === 'run' ? 'RUN & DEBUG' : activeView === 'extensions' ? 'EXTENSIONS' : 'WORKFLOWS'}</span><button className="icon-button tiny" title="More actions" onClick={() => notify('View actions are available from the panel toolbar.')}><MoreHorizontal size={16} /></button></div>
        {activeView === 'explorer' && <>
          <div className="sidebar-section-label"><span>OPEN EDITORS</span><span>{openTabs.length}</span></div>
          {openTabs.map((path) => { const file = files.find((item) => item.path === path); if (!file) return null; return <div key={path} className={`open-editor-row ${path === activePath ? 'current' : ''}`}><button onClick={() => openFile(path)}><FileIcon file={file} /><span>{file.name}</span></button><button className="close-open-tab" onClick={() => closeTab(path)}><X size={12} /></button></div>; })}
          <div className="sidebar-section-label project-heading"><span>CODEFORGE_PROJECT</span><button onClick={addFile} title="New file"><Plus size={14} /></button></div>
          <FileTree files={files} activePath={activePath} onOpen={openFile} onAdd={addFile} onDelete={deleteFile} />
          <div className="sidebar-bottom-accordions"><button onClick={() => notify('Outline is generated by the active language service when available.')}><ChevronRight size={13} /> OUTLINE</button><button onClick={() => notify('Timeline history will be populated by the Git integration.')}><ChevronRight size={13} /> TIMELINE</button></div>
        </>}
        {activeView === 'search' && <div className="sidebar-content"><input className="search-input" placeholder="Search in files" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus /><div className="search-results">{searchQuery ? files.flatMap((file) => file.content.split('\n').map((line, index) => ({ file, line, index })).filter((entry) => entry.line.toLowerCase().includes(searchQuery.toLowerCase())).map((entry) => <button key={`${entry.file.path}:${entry.index}`} onClick={() => openFile(entry.file.path)}><b>{entry.file.name}:{entry.index + 1}</b><span>{entry.line.trim().slice(0, 100)}</span></button>)) : <p className="muted-copy">Search across your current workspace.</p>}</div></div>}
        {activeView === 'git' && <div className="sidebar-content"><div className="connection-card"><div className="connection-icon"><Github size={19} /></div><b>Source Control</b><p>Connect a GitHub repository to enable real clone, commit, push and pull operations.</p><button className="secondary-button" onClick={() => window.open('https://github.com/new', '_blank', 'noopener,noreferrer')}>Create repository <ExternalLink size={13} /></button></div><div className="sidebar-section-label"><span>CHANGES</span><span>{files.length}</span></div>{files.map((file) => <div className="change-row" key={file.id}><FileIcon file={file} /><span>{file.name}</span><small>M</small></div>)}</div>}
        {activeView === 'run' && <div className="sidebar-content"><div className="runtime-card"><div className="runtime-card-top"><span className="runtime-dot" /><b>Python / Pyodide</b></div><p>Browser WebAssembly runtime. First run downloads the pinned runtime files.</p><button className="primary-button compact" onClick={() => { const file = files.find((item) => item.name === 'main.py'); if (file) runPython(file.content, file.name); }}>Run main.py <Play size={13} /></button><div className="runtime-card-top"><span className="runtime-dot blue" /><b>HTML Preview</b></div><p>Render the current HTML, CSS and JavaScript workspace in a sandboxed frame.</p><button className="secondary-button" onClick={runPreview}>Open Preview <Eye size={13} /></button></div><div className="sidebar-section-label"><span>SUPPORTED EXECUTION</span></div><div className="support-list"><span className="supported">Python · WebAssembly</span><span className="supported">JavaScript · Worker</span><span className="supported">HTML / CSS · iframe</span><span className="not-supported">C / Rust / Java · runtime not bundled</span></div></div>}
        {activeView === 'extensions' && <div className="sidebar-content marketplace-sidebar"><div className="market-mini-banner"><Sparkles size={17} /><div><b>CODEFORGE Marketplace</b><small>Community extensions</small></div></div><div className="marketplace-tabs"><button className={extensionTab === 'discover' ? 'active' : ''} onClick={() => setExtensionTab('discover')}>Discover</button><button className={extensionTab === 'installed' ? 'active' : ''} onClick={() => setExtensionTab('installed')}>Installed <span>{installedExtensions.length}</span></button><button className={extensionTab === 'updates' ? 'active' : ''} onClick={() => setExtensionTab('updates')}>Updates</button></div>{extensionTab === 'discover' && <><input className="search-input extension-search" value={extensionSearch} onChange={(event) => setExtensionSearch(event.target.value)} placeholder="Search extensions…" /><div className="category-chips">{['All', 'Themes', 'Languages', 'Productivity', 'Git', 'Appearance'].map((category) => <button key={category} className={extensionCategory === category ? 'selected' : ''} onClick={() => setExtensionCategory(category)}>{category}</button>)}</div>{marketplaceItems.filter((item) => (extensionCategory === 'All' || item.category === extensionCategory) && `${item.name} ${item.description}`.toLowerCase().includes(extensionSearch.toLowerCase())).map((item) => { const installed = installedExtensions.includes(item.id); return <article className="extension-card" key={item.id}><div className="extension-card-top"><span className="extension-card-icon"><Puzzle size={15} /></span><span className="extension-tag">{item.tag}</span></div><b>{item.name}</b><p>{item.description}</p><div className="extension-meta">{item.publisher}<span>{item.downloads}</span></div><button className={installed ? 'extension-installed' : 'extension-install'} onClick={() => setInstalledExtensions((current) => installed ? current.filter((id) => id !== item.id) : [...current, item.id])}>{installed ? <><Check size={12} /> Installed · Remove</> : <><Plus size={12} /> Add to workspace</>}</button></article>; })}</>}{extensionTab === 'installed' && <>{marketplaceItems.filter((item) => installedExtensions.includes(item.id)).map((item) => <article className="extension-card" key={item.id}><b>{item.name}</b><p>{item.description}</p><button className="extension-installed" onClick={() => setInstalledExtensions((current) => current.filter((id) => id !== item.id))}><Trash2 size={12} /> Remove</button></article>)}{installedExtensions.length === 0 && <p className="muted-copy">No extensions have been added to this local workspace yet.</p>}</>}{extensionTab === 'updates' && <div className="empty-market"><CheckCircle2 size={20} /><b>You're up to date</b><span>No signed package feeds are connected in this preview build.</span></div>}<div className="marketplace-footnote">Catalog preview. Adding an item saves it to this device; executable extension packages remain disabled until publisher verification and the isolated extension host are implemented.</div></div>}
        {activeView === 'workflows' && <div className="sidebar-content"><div className="workflow-summary"><GitPullRequest size={20} /><b>GitHub Actions</b><p>Workflow definitions in this workspace are editable YAML files. Live run history requires a connected GitHub repository.</p></div><div className="sidebar-section-label"><span>WORKFLOW FILES</span></div>{files.filter((file) => file.path.includes('.github/workflows')).map((file) => <button className="workflow-file" key={file.id} onClick={() => openFile(file.path)}><FileText size={14} /><span>{file.name}</span><ChevronRight size={13} /></button>)}<button className="secondary-button full-width" onClick={() => window.open('https://github.com/features/actions', '_blank', 'noopener,noreferrer')}>GitHub Actions docs <ExternalLink size={13} /></button></div>}
      </aside>

      <main className="editor-column">
        <div className="editor-tabbar">
          <div className="editor-tabs">{openTabs.map((path) => { const file = files.find((item) => item.path === path); if (!file) return null; return <button key={path} className={`editor-tab ${activePath === path ? 'active' : ''}`} onClick={() => openFile(path)}><FileIcon file={file} /><span>{file.name}</span><button className="tab-close" onClick={(event) => { event.stopPropagation(); closeTab(path); }}><X size={12} /></button></button>; })}<button className="new-tab-button" onClick={addFile} title="New file"><Plus size={15} /></button></div>
          <div className="editor-actions"><button title="Run current file" onClick={runActiveFile}><Play size={15} className="run-icon" /></button><button title="Open preview" onClick={runPreview}><Eye size={15} /></button><button title="Split editor (coming soon)" onClick={() => notify('Split editor is planned for the next workbench milestone.')}><PanelRight size={15} /></button><button title="More editor actions" onClick={() => setSettingsOpen(true)}><MoreHorizontal size={16} /></button></div>
        </div>
        <div className="breadcrumbs"><span>CODEFORGE_PROJECT</span><ChevronRight size={12} /><span>{activeFile?.path.split('/').filter(Boolean).slice(0, -1).join(' / ') || 'src'}</span><ChevronRight size={12} /><b>{activeFile?.name ?? 'No file selected'}</b></div>
        <div className="editor-surface">
          {activeFile ? <CodeEditor file={{ ...activeFile, content: activeFile.content }} onChange={(value) => updateFile(activeFile.path, value)} onMount={onEditorMount} fontSize={fontSize} wordWrap={wordWrap} /> : <div className="empty-editor"><FileCode2 size={34} /><h3>No editor open</h3><p>Select a file from Explorer to start editing.</p><button className="secondary-button" onClick={addFile}>Create a file <Plus size={14} /></button></div>}
          {previewOpen && <div className="preview-overlay"><div className="preview-toolbar"><div><Globe size={14} /><b>Live Preview</b><span>localhost · sandbox</span></div><div><button title="Refresh" onClick={runPreview}><RefreshCw size={14} /></button><button title="Open preview separately" onClick={() => { const blob = new Blob([previewDocument], { type: 'text/html' }); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }}><ExternalLink size={14} /></button><button title="Close preview" onClick={() => setPreviewOpen(false)}><X size={15} /></button></div></div><iframe key={previewKey} ref={previewFrameRef} title="CODEFORGE Live Preview" sandbox="allow-scripts allow-forms allow-modals allow-downloads" srcDoc={previewDocument} /></div>}
        </div>
        <div className="mobile-keyboard-strip" aria-label="Coding keys">
          {['CTRL', 'ALT', 'SHIFT', 'TAB', '{', '}', '(', ')', '[', ']', ';', '"', "'", '=', '=>', 'A', 'Z', 'Y', 'C', 'ENTER', 'LEFT', 'UP', 'DOWN', 'RIGHT'].map((key) => <button key={key} className={keyboardMode === key.toLowerCase() ? 'key-active' : ''} onClick={() => handleMobileKey(key)}>{key === 'LEFT' ? <ArrowLeft size={13} /> : key === 'RIGHT' ? <ArrowRight size={13} /> : key === 'UP' ? <ArrowUp size={13} /> : key === 'DOWN' ? <ArrowDown size={13} /> : key}</button>)}
        </div>
        <section className={`bottom-panel ${panelOpen ? 'panel-open' : 'panel-closed'}`}>
          <div className="panel-header"><div className="panel-tabs">{(['terminal', 'problems', 'output', 'debug'] as PanelTab[]).map((tab) => <button key={tab} className={panelTab === tab ? 'selected' : ''} onClick={() => { setPanelTab(tab); setPanelOpen(true); }}>{tab === 'terminal' ? 'TERMINAL' : tab === 'problems' ? 'PROBLEMS' : tab === 'output' ? 'OUTPUT' : 'DEBUG CONSOLE'}{tab === 'problems' && problems.length > 0 && <span className="problem-count">{problems.length}</span>}</button>)}</div><div className="panel-controls">{panelTab === 'terminal' && <><span className="terminal-profile"><Terminal size={13} /> workspace</span><button title="New terminal" onClick={() => appendTerminal('info', 'New workspace terminal session started.')}><Plus size={14} /></button><button title="Clear terminal" onClick={() => setTerminalLines([])}><Trash2 size={14} /></button></>}<button title={panelOpen ? 'Collapse panel' : 'Expand panel'} onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></div></div>
          {panelOpen && <div className="panel-content">
            {panelTab === 'terminal' && <div className="terminal-view"><div className="terminal-output">{terminalLines.map((line) => <div key={line.id} className={`terminal-line ${line.kind}`}><span>{line.text}</span></div>)}<div ref={terminalEndRef} /></div><form className="terminal-input-row" onSubmit={(event) => { event.preventDefault(); executeCommand(terminalInput); setTerminalInput(''); }}><span className="terminal-prompt">$</span><input value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="Type a command… (help for commands)" autoCapitalize="off" autoCorrect="off" spellCheck={false} /><button type="submit" title="Run command"><ArrowRight size={15} /></button></form></div>}
            {panelTab === 'problems' && <div className="empty-panel-state"><CheckCircle2 size={22} /><b>No workspace problems detected</b><span>Monaco diagnostics are active for supported languages.</span></div>}
            {panelTab === 'output' && <div className="output-view"><div className="output-line"><CheckCircle2 size={13} /> CODEFORGE workspace initialized.</div><div className="output-line"><InfoIcon /> Python runtime: {runtimeState === 'ready' ? `ready (${runtimeVersion})` : runtimeState === 'loading' ? 'loading' : runtimeState === 'error' ? 'error' : 'not started'}.</div><div className="output-line"><InfoIcon /> Firebase configured: {firebaseConfigured ? 'yes' : 'no'} · Supabase configured: {supabaseConfigured ? 'yes' : 'no'}.</div></div>}
            {panelTab === 'debug' && <div className="empty-panel-state"><Activity size={22} /><b>Debug console</b><span>Language-specific debugging adapters are not bundled in this starter release.</span></div>}
          </div>}
        </section>
      </main>

      {rightOpen && <aside className="right-sidebar"><div className="right-tabs"><button className={rightTab === 'git' ? 'active' : ''} onClick={() => setRightTab('git')}><GitBranch size={14} /> SOURCE CONTROL</button><button className={rightTab === 'inspector' ? 'active' : ''} onClick={() => setRightTab('inspector')}><ListFilter size={14} /> INSPECTOR</button><button className="right-close" title="Hide right sidebar" onClick={() => setRightOpen(false)}><X size={14} /></button></div>{rightTab === 'git' ? <>
        <div className="git-graph-title"><b>BRANCH GRAPH</b><button onClick={() => notify('Connect a GitHub repository to load real commit history.')}><RefreshCw size={13} /></button></div>
        <div className="git-graph"><svg viewBox="0 0 220 255" preserveAspectRatio="none" aria-label="Illustrative branch graph"><path d="M25 12 V245" stroke="#59b9c7" strokeWidth="2" fill="none"/><path d="M25 49 C25 82 90 77 90 105 V160 C90 184 25 183 25 216" stroke="#b58cf2" strokeWidth="2" fill="none"/><path d="M90 105 C90 130 165 130 165 156 V193" stroke="#d3a36e" strokeWidth="2" fill="none"/><path d="M25 216 C25 238 66 235 66 251" stroke="#8b83ec" strokeWidth="2" fill="none"/>{[[25,12,'#5dbdcc'],[25,49,'#5dbdcc'],[90,105,'#b58cf2'],[90,160,'#b58cf2'],[165,156,'#d3a36e'],[165,193,'#d3a36e'],[25,216,'#5dbdcc'],[66,251,'#8b83ec']].map(([x,y,c],index)=><circle key={index} cx={x as number} cy={y as number} r="5" fill={c as string} stroke="#141720" strokeWidth="2" />)}</svg><div className="branch-labels"><span className="branch-main"><GitBranch size={12} /> main</span><span className="branch-feature"><GitBranch size={12} /> feature/ui</span><span className="branch-remote"><GitBranch size={12} /> origin/main</span></div></div>
        <div className="inspector-section"><div className="inspector-heading"><b>WORKSPACE</b><MoreHorizontal size={14} /></div><div className="inspector-row"><span>Name</span><b>CODEFORGE_PROJECT</b></div><div className="inspector-row"><span>Files</span><b>{files.length}</b></div><div className="inspector-row"><span>Runtime</span><b>{runtimeState === 'ready' ? 'Python ready' : 'Local'}</b></div><div className="inspector-row"><span>Cloud</span><b>{authUser ? syncState : 'Guest'}</b></div></div>
        <div className="inspector-section"><div className="inspector-heading"><b>COMMITS</b><span className="muted-tag">LOCAL</span></div><div className="commit-placeholder"><GitCommit size={16} /><span>Connect GitHub to load real commit history.</span></div></div>
      </> : <div className="inspector-panel"><div className="inspector-heading"><b>ACTIVE FILE</b><MoreHorizontal size={14} /></div><div className="file-inspector-icon">{activeFile && <FileIcon file={activeFile} size={23} />}</div><h3>{activeFile?.name ?? 'No selection'}</h3><div className="inspector-row"><span>Language</span><b>{activeLanguage?.label ?? '—'}</b></div><div className="inspector-row"><span>Lines</span><b>{activeFile?.content.split('\n').length ?? 0}</b></div><div className="inspector-row"><span>Characters</span><b>{activeFile?.content.length ?? 0}</b></div><div className="inspector-row"><span>Path</span><b>{activeFile?.path ?? '—'}</b></div><div className="inspector-section"><div className="inspector-heading"><b>LANGUAGE SUPPORT</b></div><p className="muted-copy">Syntax highlighting and editor assistance depend on the language service. Runtime availability is shown separately.</p></div></div>}</aside>}
      {!rightOpen && <button className="reopen-right" title="Show right panel" onClick={() => setRightOpen(true)}><PanelRight size={16} /></button>}
    </div>

    <footer className="statusbar"><div className="status-left"><span><GitBranch size={12} /> main*</span><span><CircleDot size={12} /> 0</span><span><AlertCircle size={12} /> {problems.length} Problems</span></div><div className="status-right"><span>{activeLanguage?.label ?? 'Plain Text'}</span><span>UTF-8</span><span>Spaces: 2</span><span>Ln 1, Col 1</span><span className="status-runtime">{runtimeState === 'ready' ? 'Python ready' : runtimeState === 'loading' ? 'Python loading' : 'Runtime idle'}</span><span className={`sync-indicator ${syncState}`}><Cloud size={12} /> {authUser ? syncState : 'Local'}</span><button title="Notifications" onClick={() => notify('You are all caught up.')}><Bell size={13} /></button></div></footer>

    {profileOpen && <><button className="click-away" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" /><div className="profile-popover"><div className="profile-header"><Avatar name={profileName} hue={guest?.hue} initials={guest?.initials} /><div><b>{profileName}</b><span>{displayHandle}</span><small><i /> {guest ? 'Guest session' : 'Online'}</small></div></div><div className="profile-stats"><span><b>{files.length}</b> files</span><span><b>{installedExtensions.length}</b> extensions</span></div><div className="profile-menu-section"><small>ACCOUNT</small><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><UserCircle2 size={15} /> My Profile</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><ShieldCheck size={15} /> Account & Security</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Cloud size={15} /> Connected Accounts</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Monitor size={15} /> Sessions & Devices</button></div><div className="profile-menu-section"><small>WORKSPACE</small><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><PaletteIcon /> Appearance & Themes</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Keyboard size={15} /> Keyboard Shortcuts</button><button onClick={() => { setProfileOpen(false); setActiveView('extensions'); }}><Puzzle size={15} /> Extensions Manager</button><button onClick={() => { setProfileOpen(false); void syncNow(); }}><CloudUpload size={15} /> Cloud Sync</button><button onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><HardDrive size={15} /> Storage Manager</button></div><div className="profile-menu-section"><small>SUPPORT</small><button onClick={() => window.open('https://github.com/', '_blank', 'noopener,noreferrer')}><Github size={15} /> Open Source</button><button onClick={() => notify('Documentation is included in the project ZIP.')}><BookOpen size={15} /> Documentation</button><button onClick={() => notify('Use the project GitHub Issues page to report bugs after publishing the repository.')}><MessageSquare size={15} /> Report a Bug</button><button onClick={() => notify('CODEFORGE v0.1.0 · Open-source preview build.')}><CircleHelp size={15} /> About CODEFORGE</button></div><button className="logout-button" onClick={() => void signOut()}><LogOut size={15} /> Log Out</button></div></>}

    {settingsOpen && <div className="modal-backdrop"><section className="settings-modal"><div className="modal-title"><div><small>CODEFORGE PREFERENCES</small><h2>Settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)}><X size={17} /></button></div><div className="settings-content"><section><h3>Editor</h3><div className="setting-row"><div><b>Font size</b><span>Adjust code editor typography.</span></div><div className="stepper"><button onClick={() => changeFontSize(-1)}>−</button><b>{fontSize}px</b><button onClick={() => changeFontSize(1)}>+</button></div></div><div className="setting-row"><div><b>Word wrap</b><span>Wrap long lines in the editor.</span></div><button className={`toggle ${wordWrap ? 'on' : ''}`} onClick={() => { setWordWrap((v) => !v); notify('Word wrap preference changed.'); }}><i /></button></div></section><section><h3>Cloud services</h3><div className="setting-row"><div><b>Supabase</b><span>Auth, database and project sync.</span></div><span className={`service-state ${supabaseConfigured ? 'good' : 'off'}`}>{supabaseConfigured ? 'Configured' : 'Not configured'}</span></div><div className="setting-row"><div><b>Firebase</b><span>Optional Firebase app / messaging setup.</span></div><span className={`service-state ${firebaseConfigured ? 'good' : 'off'}`}>{firebaseConfigured ? 'Configured' : 'Optional'}</span></div><div className="setting-row"><div><b>Workspace sync</b><span>{authUser ? 'Signed-in workspace syncs after edits.' : 'Guest workspaces stay on this device.'}</span></div><button className="secondary-button compact" onClick={() => { setSettingsOpen(false); void syncNow(); }}>Sync now <CloudUpload size={13} /></button></div></section><section><h3>Runtime support</h3><div className="runtime-grid"><span className="good-runtime"><CheckCircle2 size={13} /> Python · Pyodide</span><span className="good-runtime"><CheckCircle2 size={13} /> JavaScript · Worker</span><span className="good-runtime"><CheckCircle2 size={13} /> HTML · Preview</span><span className="pending-runtime"><AlertCircle size={13} /> C / Rust / Java · planned</span></div></section></div><div className="modal-actions"><button className="quiet-button" onClick={() => setSettingsOpen(false)}>Close</button><button className="primary-button" onClick={() => { setSettingsOpen(false); notify('Preferences applied to the current session.'); }}>Done <Check size={15} /></button></div></section></div>}

    {commandOpen && <div className="modal-backdrop command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><section className="command-palette"><div className="command-input-wrap"><Command size={16} /><input autoFocus placeholder="Type a command or search…" value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && filteredCommands[0]) { filteredCommands[0].run(); setCommandOpen(false); setCommandQuery(''); } }} /><kbd>ESC</kbd></div><div className="command-results">{filteredCommands.map((item) => <button key={item.id} onClick={() => { item.run(); setCommandOpen(false); setCommandQuery(''); }}><Zap size={14} /><span><b>{item.label}</b><small>{item.detail}</small></span><ChevronRight size={14} /></button>)}</div></section></div>}

    {toast && <div className="toast"><CheckCircle2 size={15} />{toast}</div>}
  </div>;
}

function InfoIcon() { return <span className="info-icon">i</span>; }
function PaletteIcon() { return <span className="palette-icon"><Sparkles size={14} /></span>; }

export default App;
