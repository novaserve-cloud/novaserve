import React, { useState, useEffect } from 'react';
import {
  Activity,
  Box,
  Database,
  Globe,
  Play,
  Settings,
  Terminal,
  Zap,
  Layers,
  Search,
  RefreshCw,
  Server,
  Sparkles,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  ChevronRight,
  Plus,
  PlayCircle,
  PauseCircle,
  Trash2,
  Bell,
  AlertTriangle,
  FileText,
  Command,
  BarChart3,
  GitPullRequest,
  Rocket,
  Check,
  X,
  ExternalLink,
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Save,
  User,
  LogOut,
  Copy,
  LogIn
} from 'lucide-react';





type TabId =
  | 'overview'
  | 'resources'
  | 'deployments'
  | 'functions'
  | 'apis'
  | 'storage'
  | 'queues'
  | 'databases'
  | 'logs'
  | 'metrics'
  | 'traces'
  | 'events'
  | 'ai'
  | 'credentials'
  | 'config'
  | 'cli'
  | 'docs';


export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [signOutNotice, setSignOutNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployToast, setDeployToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<string>('api-gateway');
  const [environment, setEnvironment] = useState<'local' | 'staging' | 'production'>('local');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [userToast, setUserToast] = useState<string | null>(null);

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    setIsAuthenticated(false);
    setSignOutNotice(true);
  };

  const handleSignIn = () => {
    setIsAuthenticated(true);
    setSignOutNotice(false);
    setUserToast('Authenticated successfully as Md Shadab Azam Ansari');
    setTimeout(() => setUserToast(null), 3500);
  };


  const [patTokens, setPatTokens] = useState([
    { id: 'pat-1', name: 'MacBook Air CLI Token', created: '2 days ago', lastUsed: '5 mins ago', secret: 'nova_pat_891230491823901' },
    { id: 'pat-2', name: 'GitHub Actions CI/CD', created: '1 week ago', lastUsed: '1 hour ago', secret: 'nova_pat_091238091238091' }
  ]);
  const [newTokenName, setNewTokenName] = useState('');

  const handleTriggerDeploy = () => {
    setDeployModalOpen(false);
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setDeployToast(true);
      setTimeout(() => setDeployToast(false), 4500);
    }, 1600);
  };

  const handleCreatePAT = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    const newToken = {
      id: `pat-${Date.now()}`,
      name: newTokenName.trim(),
      created: 'Just now',
      lastUsed: 'Never',
      secret: `nova_pat_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    };
    setPatTokens((prev) => [newToken, ...prev]);
    setNewTokenName('');
    setUserToast('Personal Access Token created successfully!');
    setTimeout(() => setUserToast(null), 3000);
  };

  const handleDeletePAT = (id: string) => {
    setPatTokens((prev) => prev.filter((t) => t.id !== id));
    setUserToast('Personal Access Token revoked');
    setTimeout(() => setUserToast(null), 3000);
  };


  if (!isAuthenticated) {
    return <JenkinsStyleLoginScreen onSignIn={handleSignIn} signOutNotice={signOutNotice} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">

      {/* Toast Notification */}
      {deployToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 text-white shadow-lg border border-gray-800 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-gray-900 shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Deployment Successful</div>
            <div className="text-[11px] text-gray-400 font-mono">
              App {environment} release built in 1.4s · DAG resolved
            </div>
          </div>
        </div>
      )}

      {/* Deploy Confirmation Modal */}
      {deployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Rocket className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Trigger DAG Cloud Deployment</h3>
                  <p className="text-xs text-gray-500">Incremental build & distribution</p>
                </div>
              </div>
              <button
                onClick={() => setDeployModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-6 text-xs text-gray-600">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Provider:</span>
                  <span className="font-semibold text-gray-900">AWS (ap-south-1)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Env:</span>
                  <span className="font-semibold text-amber-600 capitalize">{environment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Modified Resources:</span>
                  <span className="font-semibold text-gray-900">3 of 6 nodes</span>
                </div>
              </div>
              <p className="leading-relaxed">
                NovaServe will bundle TypeScript handlers with esbuild and update CloudFormation stacks incrementally.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeployModalOpen(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerDeploy}
                className="btn-primary-yellow text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Confirm Deployment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-gray-800 shadow-xs font-semibold">
              <Zap className="w-4 h-4 fill-gray-800 text-gray-800" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base text-gray-800 tracking-tight">NovaServe</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-gray-100 text-gray-600 border border-gray-200">
                  v0.1.0
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">Serverless Engine</p>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Section List */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {/* Section: PLATFORM */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Platform
            </div>
            <div className="space-y-0.5">
              <NavItem
                active={activeTab === 'overview'}
                icon={<Activity className="w-4 h-4" />}
                label="Overview"
                onClick={() => { setActiveTab('overview'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'resources'}
                icon={<Box className="w-4 h-4" />}
                label="Cloud Resources"
                count={6}
                onClick={() => { setActiveTab('resources'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'deployments'}
                icon={<Rocket className="w-4 h-4" />}
                label="Deployments"
                onClick={() => { setActiveTab('deployments'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'functions'}
                icon={<Cpu className="w-4 h-4" />}
                label="Functions"
                count={3}
                onClick={() => { setActiveTab('functions'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'apis'}
                icon={<Globe className="w-4 h-4" />}
                label="APIs"
                onClick={() => { setActiveTab('apis'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'storage'}
                icon={<HardDrive className="w-4 h-4" />}
                label="Storage"
                onClick={() => { setActiveTab('storage'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'queues'}
                icon={<Layers className="w-4 h-4" />}
                label="Queues"
                onClick={() => { setActiveTab('queues'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'databases'}
                icon={<Database className="w-4 h-4" />}
                label="Databases"
                onClick={() => { setActiveTab('databases'); setMobileSidebarOpen(false); }}
              />
            </div>
          </div>

          {/* Section: OBSERVABILITY */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Observability
            </div>
            <div className="space-y-0.5">
              <NavItem
                active={activeTab === 'logs'}
                icon={<Terminal className="w-4 h-4" />}
                label="Logs"
                badge="Live"
                onClick={() => { setActiveTab('logs'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'metrics'}
                icon={<BarChart3 className="w-4 h-4" />}
                label="Metrics"
                onClick={() => { setActiveTab('metrics'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'traces'}
                icon={<GitPullRequest className="w-4 h-4" />}
                label="Traces"
                onClick={() => { setActiveTab('traces'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'events'}
                icon={<Zap className="w-4 h-4" />}
                label="Events"
                onClick={() => { setActiveTab('events'); setMobileSidebarOpen(false); }}
              />
            </div>
          </div>

          {/* Section: DEVELOPER */}
          <div>
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Developer
            </div>
            <div className="space-y-0.5">
              <NavItem
                active={activeTab === 'ai'}
                icon={<Sparkles className="w-4 h-4 text-amber-500" />}
                label="Nova AI Copilot"
                badge="AI"
                onClick={() => { setActiveTab('ai'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'credentials'}
                icon={<Key className="w-4 h-4 text-amber-600" />}
                label="Cloud Credentials"
                badge="Vault"
                onClick={() => { setActiveTab('credentials'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'config'}
                icon={<Settings className="w-4 h-4" />}
                label="Config & Runtime"
                onClick={() => { setActiveTab('config'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'cli'}
                icon={<Command className="w-4 h-4" />}
                label="CLI"
                onClick={() => { setActiveTab('cli'); setMobileSidebarOpen(false); }}
              />
              <NavItem
                active={activeTab === 'docs'}
                icon={<FileText className="w-4 h-4" />}
                label="Documentation"
                onClick={() => { setActiveTab('docs'); setMobileSidebarOpen(false); }}
              />
            </div>
          </div>
        </nav>

        {/* Bottom Environment Selector Card */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/50">
          <div className="p-3 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Environment
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-gray-700" />
                <span className="text-xs font-medium text-gray-900 capitalize">{environment} Engine</span>
              </div>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="text-[11px] font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 focus:outline-none"
              >
                <option value="local">Local</option>
                <option value="staging">Staging</option>
                <option value="production">Prod</option>
              </select>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
              <span>localhost:4002</span>
              <span className="text-gray-400">Hono v4</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 2. TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-gray-600 hover:text-gray-900 p-1"
            >
              <Command className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-800 flex items-center gap-2 capitalize">
                {activeTab === 'overview' && 'System Overview'}
                {activeTab === 'resources' && 'Cloud Resources'}
                {activeTab === 'deployments' && 'Deployments & History'}
                {activeTab === 'functions' && 'Serverless Functions'}
                {activeTab === 'apis' && 'API Gateways'}
                {activeTab === 'storage' && 'Object Storage'}
                {activeTab === 'queues' && 'Message Queues'}
                {activeTab === 'databases' && 'Managed Databases'}
                {activeTab === 'logs' && 'Log Stream'}
                {activeTab === 'metrics' && 'Performance Metrics'}
                {activeTab === 'traces' && 'Distributed Traces'}
                {activeTab === 'events' && 'Event Bus Stream'}
                {activeTab === 'ai' && 'Nova AI Copilot'}
                {activeTab === 'credentials' && 'Cloud Credentials & Vault'}
                {activeTab === 'config' && 'Framework Configuration'}
                {activeTab === 'cli' && 'CLI Command Center'}
                {activeTab === 'docs' && 'Developer Documentation'}
              </h1>
              <p className="text-xs text-gray-500">
                {activeTab === 'overview' && 'Monitor and manage your NovaServe infrastructure.'}
                {activeTab === 'resources' && 'Inspect active cloud components across environments.'}
                {activeTab === 'deployments' && 'Track DAG deployment releases and cloud rollouts.'}
                {activeTab === 'logs' && 'Real-time stdout / stderr stream from local and cloud handlers.'}
                {activeTab === 'ai' && 'Terminal-native AI assistant for code generation and infrastructure.'}
                {activeTab === 'credentials' && 'Securely manage cloud provider authentication keys and API credentials.'}
                {activeTab === 'config' && 'Manage typescript configuration and cloud provider credentials.'}
                {activeTab !== 'overview' && activeTab !== 'resources' && activeTab !== 'deployments' && activeTab !== 'logs' && activeTab !== 'ai' && activeTab !== 'credentials' && activeTab !== 'config' && 'Enterprise serverless development controls.'}
              </p>
            </div>
          </div>

          {/* Center Global Search */}
          <div className="relative hidden lg:block w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources, functions, APIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-200/60 rounded border border-gray-300">
              /
            </kbd>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('logs')}
              className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 border border-white" />
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className="btn-secondary text-xs py-1.5 px-3 hidden sm:inline-flex"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Nova AI</span>
            </button>

            {/* Deploy CTA */}
            <button
              onClick={() => setDeployModalOpen(true)}
              disabled={isDeploying}
              className="btn-primary-yellow text-xs py-1.5 px-3.5 shadow-xs"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-800" />
                  <span>Deploying...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-gray-800 text-gray-800" />
                  <span>Deploy</span>
                </>
              )}
            </button>

            {/* Profile Avatar & Interactive Dropdown Menu */}
            <div className="relative ml-1">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold tracking-wide border border-gray-800 hover:ring-2 hover:ring-amber-400 transition-all focus:outline-none"
                title="Md Shadab Azam Ansari (SA)"
              >
                SA
              </button>

              {/* Profile Dropdown Menu */}
              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-xl z-30 py-2 animate-in fade-in zoom-in-95 duration-100 text-xs">
                    {/* User Info Header */}
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <div className="font-semibold text-gray-800 text-sm">Md Shadab Azam Ansari</div>
                      <div className="text-gray-500 font-mono text-[11px] truncate">shadab@novaserve.dev</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-amber-100 text-amber-900 border border-amber-200">
                          Owner
                        </span>
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-gray-100 text-gray-600">
                          NovaServe Admin
                        </span>
                      </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setProfileModalOpen(true);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                      >
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        <span>Account & Personal Tokens</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setActiveTab('credentials');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cloud Credentials & Vault</span>
                      </button>

                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setActiveTab('config');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 font-medium"
                      >
                        <Settings className="w-3.5 h-3.5 text-gray-500" />
                        <span>Framework Settings</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2.5 font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                        <span>Sign Out / Log Out</span>
                      </button>
                    </div>

                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* User Profile & Personal Access Tokens Modal */}
        {profileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-xl w-full p-6 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-900 text-white font-bold flex items-center justify-center text-sm border border-gray-800">
                    SA
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Md Shadab Azam Ansari</h3>
                    <p className="text-xs text-gray-500 font-mono">shadab@novaserve.dev · Lead Architect</p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Toast inside modal */}
              {userToast && (
                <div className="mb-4 p-2.5 bg-gray-900 text-white rounded-lg text-xs font-mono flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>{userToast}</span>
                </div>
              )}

              {/* Account Details Card */}
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Organization</span>
                    <span className="font-semibold text-gray-800">NovaServe Core Engineering</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Access Level</span>
                    <span className="font-semibold text-amber-700">Administrator (All Permissions)</span>
                  </div>
                </div>

                {/* Personal Access Tokens Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">Personal Access Tokens (PATs)</h4>
                      <p className="text-gray-500 text-[11px]">Use tokens to authenticate NovaServe CLI and CI/CD pipelines</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreatePAT} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Token description (e.g. CI Build Server)"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                    />
                    <button type="submit" className="btn-primary-yellow text-xs py-1.5 px-3">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate Token</span>
                    </button>
                  </form>

                  <div className="border border-gray-200 rounded-lg overflow-hidden font-mono">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] border-b border-gray-200">
                        <tr>
                          <th className="p-2.5">Token Name</th>
                          <th className="p-2.5">Secret Key</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {patTokens.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="p-2.5 font-bold text-gray-900">
                              {t.name}
                              <span className="block text-[10px] text-gray-400 font-normal">Last used: {t.lastUsed}</span>
                            </td>
                            <td className="p-2.5 text-gray-500 text-[11px]">{t.secret.substring(0, 14)}...</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(t.secret);
                                  setUserToast(`Copied token "${t.name}" to clipboard!`);
                                  setTimeout(() => setUserToast(null), 3000);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-700 mr-1"
                                title="Copy Token"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePAT(t.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Revoke Token"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="btn-secondary text-xs py-1.5 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Scrollable Workspace Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {activeTab === 'overview' && (
            <OverviewSection
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'resources' && <ResourcesSection searchQuery={searchQuery} />}
          {activeTab === 'deployments' && <DeploymentsSection />}
          {activeTab === 'functions' && <FunctionsSection />}
          {activeTab === 'apis' && <ApisSection />}
          {activeTab === 'storage' && <StorageSection />}
          {activeTab === 'queues' && <QueuesSection />}
          {activeTab === 'databases' && <DatabasesSection />}
          {activeTab === 'logs' && <LogsSection />}
          {activeTab === 'metrics' && <MetricsSection />}
          {activeTab === 'traces' && <TracesSection />}
          {activeTab === 'events' && <EventsSection />}
          {activeTab === 'ai' && <AiCopilotSection />}
          {activeTab === 'credentials' && <CredentialsSection />}
          {activeTab === 'config' && <ConfigSection />}
          {activeTab === 'cli' && <CliSection />}
          {activeTab === 'docs' && <DocsSection />}
        </main>
      </div>
    </div>

  );
}

/* Nav Item Component */
function NavItem({
  icon,
  label,
  active,
  badge,
  count,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors duration-150 group relative ${active
          ? 'bg-amber-50 text-gray-950 font-semibold border-l-4 border-amber-400 pl-2'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 font-medium'
        }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={active ? 'text-gray-950' : 'text-gray-400 group-hover:text-gray-700'}>
          {icon}
        </div>
        <span>{label}</span>
      </div>

      {badge && (
        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-100 text-amber-800 border border-amber-200">
          {badge}
        </span>
      )}

      {count !== undefined && (
        <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-gray-100 text-gray-500 border border-gray-200">
          {count}
        </span>
      )}
    </button>
  );
}

/* 3. MAIN DASHBOARD: Overview Tab */
function OverviewSection({
  selectedNode,
  setSelectedNode,
  onNavigate
}: {
  selectedNode: string;
  setSelectedNode: (id: string) => void;
  onNavigate: (tab: TabId) => void;
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 3. Top Compact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Cloud Resources"
          value="6"
          meta="Active resources"
          badge="+2 today"
          badgePositive
        />
        <MetricCard
          title="Average Latency"
          value="24ms"
          meta="Emulator baseline"
          badge="-8ms vs baseline"
          badgePositive
        />
        <MetricCard
          title="Requests"
          value="1,420/min"
          meta="Live throughput"
          badge="+18.4%"
          badgePositive
        />
        <MetricCard
          title="Estimated Cost"
          value="$4.12"
          meta="This month"
          badge="In budget"
        />
      </div>

      {/* 4. ARCHITECTURE / TOPOLOGY & 5. RESOURCE PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-700" />
                Architecture
              </h2>
              <p className="text-xs text-gray-500">
                Visual dependency graph generated from <code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">nova.config.ts</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 rounded border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DAG Resolved
              </span>
            </div>
          </div>

          {/* Canvas with subtle grid lines */}
          <div className="relative min-h-[320px] flex-1 bg-topology-grid rounded-lg border border-gray-200 p-6 flex flex-col justify-center overflow-hidden">
            {/* SVG Connecting Lines - Gray default, Yellow for selected path */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line
                x1="22%" y1="50%" x2="42%" y2="35%"
                stroke={selectedNode === 'api-gateway' || selectedNode === 'fn-users-list' ? '#FACC15' : '#D1D5DB'}
                strokeWidth={selectedNode === 'api-gateway' || selectedNode === 'fn-users-list' ? '2.5' : '1.5'}
                strokeDasharray="4 4"
              />
              <line
                x1="22%" y1="50%" x2="42%" y2="65%"
                stroke={selectedNode === 'api-gateway' || selectedNode === 'fn-email-process' ? '#FACC15' : '#D1D5DB'}
                strokeWidth={selectedNode === 'api-gateway' || selectedNode === 'fn-email-process' ? '2.5' : '1.5'}
                strokeDasharray="4 4"
              />
              <line
                x1="58%" y1="65%" x2="78%" y2="65%"
                stroke={selectedNode === 'queue-emails' || selectedNode === 'fn-email-process' ? '#FACC15' : '#D1D5DB'}
                strokeWidth={selectedNode === 'queue-emails' || selectedNode === 'fn-email-process' ? '2.5' : '1.5'}
                strokeDasharray="4 4"
              />
              <line
                x1="58%" y1="35%" x2="78%" y2="35%"
                stroke={selectedNode === 'db-postgres' || selectedNode === 'fn-users-list' ? '#FACC15' : '#D1D5DB'}
                strokeWidth={selectedNode === 'db-postgres' || selectedNode === 'fn-users-list' ? '2.5' : '1.5'}
                strokeDasharray="4 4"
              />
              <line
                x1="78%" y1="35%" x2="78%" y2="65%"
                stroke={selectedNode === 'bucket-uploads' ? '#FACC15' : '#D1D5DB'}
                strokeWidth={selectedNode === 'bucket-uploads' ? '2.5' : '1.5'}
                strokeDasharray="4 4"
              />
            </svg>

            {/* Architecture Node Layout */}
            <div className="relative z-10 grid grid-cols-3 gap-6 items-center">
              {/* Ingress Node */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ingress</div>
                <NodeItem
                  id="api-gateway"
                  name="API Gateway"
                  type="REST Gateway"
                  status="Healthy"
                  icon={<Globe className="w-4 h-4 text-gray-700" />}
                  selected={selectedNode === 'api-gateway'}
                  onClick={() => setSelectedNode('api-gateway')}
                />
              </div>

              {/* Compute Handlers */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Compute</div>
                <NodeItem
                  id="fn-users-list"
                  name="src/handlers/users.ts"
                  type="Node20 Function"
                  status="Active"
                  icon={<Cpu className="w-4 h-4 text-gray-700" />}
                  selected={selectedNode === 'fn-users-list'}
                  onClick={() => setSelectedNode('fn-users-list')}
                />
                <NodeItem
                  id="fn-email-process"
                  name="src/handlers/email.ts"
                  type="Queue Consumer"
                  status="Active"
                  icon={<Layers className="w-4 h-4 text-gray-700" />}
                  selected={selectedNode === 'fn-email-process'}
                  onClick={() => setSelectedNode('fn-email-process')}
                />
              </div>

              {/* Persistence & Queues */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Persistence</div>
                <NodeItem
                  id="db-postgres"
                  name="postgres-db"
                  type="Postgres 16"
                  status="Healthy"
                  icon={<Database className="w-4 h-4 text-gray-700" />}
                  selected={selectedNode === 'db-postgres'}
                  onClick={() => setSelectedNode('db-postgres')}
                />
                <NodeItem
                  id="bucket-uploads"
                  name="uploads-bucket"
                  type="S3 Storage"
                  status="Ready"
                  icon={<HardDrive className="w-4 h-4 text-gray-700" />}
                  selected={selectedNode === 'bucket-uploads'}
                  onClick={() => setSelectedNode('bucket-uploads')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. RESOURCE PANEL (Selected Node Details) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Resource Details</span>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-100 text-amber-800 rounded font-semibold border border-amber-200">
                Selected Node
              </span>
            </div>

            <ResourceInspectorPanel node={selectedNode} />
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-2">
            <button onClick={() => onNavigate('logs')} className="btn-secondary text-xs flex-1 justify-center">
              View Logs
            </button>
            <button onClick={() => onNavigate('config')} className="btn-secondary text-xs flex-1 justify-center">
              Configure
            </button>
            <button onClick={() => onNavigate('deployments')} className="btn-primary-yellow text-xs py-2 px-3">
              Deploy
            </button>
          </div>
        </div>
      </div>

      {/* 6. ACTIVITY SECTION & 7. DEPLOYMENT SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 6. Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-700" />
              Recent Activity
            </h3>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <ActivityRow
              status="success"
              title="Function deployed"
              detail="src/handlers/users.ts"
              time="2 minutes ago"
            />
            <ActivityRow
              status="success"
              title="Database migration completed"
              detail="postgres-db"
              time="12 minutes ago"
            />
            <ActivityRow
              status="warning"
              title="High latency detected"
              detail="/api/orders (140ms)"
              time="32 minutes ago"
            />
            <ActivityRow
              status="success"
              title="S3 Bucket policy updated"
              detail="uploads-bucket"
              time="1 hour ago"
            />
          </div>
        </div>

        {/* 7. Deployments Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-gray-700" />
              Recent Deployments
            </h3>
            <button
              onClick={() => onNavigate('deployments')}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
            >
              <span>Full deployment history</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400 uppercase text-[10px] font-semibold border-b border-gray-100">
                <tr>
                  <th className="pb-2">Deployment</th>
                  <th className="pb-2">Environment</th>
                  <th className="pb-2">Commit</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-5">
                <DeploymentRow
                  name="users-api"
                  env="Production"
                  commit="a83f92c"
                  status="Success"
                  duration="42s"
                  created="2 min ago"
                />
                <DeploymentRow
                  name="auth-worker"
                  env="Staging"
                  commit="f7b91d2"
                  status="Success"
                  duration="18s"
                  created="15 min ago"
                />
                <DeploymentRow
                  name="cron-billing"
                  env="Production"
                  commit="e4c8201"
                  status="Warning"
                  duration="1m 04s"
                  created="1 hr ago"
                />
                <DeploymentRow
                  name="uploads-handler"
                  env="Local"
                  commit="c3d901f"
                  status="Success"
                  duration="4s"
                  created="3 hrs ago"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Metric Card */
function MetricCard({
  title,
  value,
  meta,
  badge,
  badgePositive
}: {
  title: string;
  value: string;
  meta: string;
  badge: string;
  badgePositive?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors shadow-xs">
      <div className="text-xs text-gray-500 font-medium mb-1">{title}</div>
      <div className="text-2xl font-semibold text-gray-800 font-mono tracking-tight">{value}</div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400">{meta}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[11px] font-medium font-mono ${badgePositive
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-gray-600 bg-gray-100 border border-gray-200'
            }`}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}

/* Node Item for Topology */
function NodeItem({
  name,
  type,
  status,
  icon,
  selected,
  onClick
}: {
  id: string;
  name: string;
  type: string;
  status: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 ${selected
          ? 'bg-amber-50/50 border-amber-400 border-2 shadow-xs'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1 rounded bg-gray-100 border border-gray-200 shrink-0">{icon}</div>
          <div className="font-semibold text-xs text-gray-900 truncate font-mono">{name}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
        <span>{type}</span>
        <span className="text-emerald-700 font-medium font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {status}
        </span>
      </div>
    </div>
  );
}

/* Resource Inspector Details */
function ResourceInspectorPanel({ node }: { node: string }) {
  const detailsMap: Record<string, any> = {
    'api-gateway': {
      title: 'API Gateway',
      status: 'Healthy',
      endpoint: '/api/users',
      requests: '12,482',
      latency: '42ms',
      functions: '2 connected',
      deployments: 'v1.4.0 (2 min ago)'
    },
    'fn-users-list': {
      title: 'src/handlers/users.ts',
      status: 'Healthy',
      endpoint: 'GET /users',
      requests: '8,920',
      latency: '24ms',
      functions: 'Lambda Node20',
      deployments: 'v1.4.0 (2 min ago)'
    },
    'fn-email-process': {
      title: 'src/handlers/email.ts',
      status: 'Healthy',
      endpoint: 'Queue Worker',
      requests: '3,562',
      latency: '110ms',
      functions: 'SQS Trigger',
      deployments: 'v1.3.9 (1 hr ago)'
    },
    'db-postgres': {
      title: 'postgres-db',
      status: 'Healthy',
      endpoint: 'db.novaserve.internal:5432',
      requests: '45,100 queries',
      latency: '4ms',
      functions: 'PostgreSQL 16',
      deployments: 'Managed Instance'
    },
    'bucket-uploads': {
      title: 'uploads-bucket',
      status: 'Ready',
      endpoint: 's3://novaserve-uploads',
      requests: '1,200 objects',
      latency: '18ms',
      functions: '10MB Max size',
      deployments: 'Auto-scaled'
    }
  };

  const current = detailsMap[node] || detailsMap['api-gateway'];

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-gray-800 font-mono">{current.title}</h4>
        <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
          ● {current.status}
        </span>
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-100 text-gray-600 font-mono">
        <div className="flex justify-between py-1 border-b border-gray-50">
          <span className="text-gray-400">Endpoint / Path:</span>
          <span className="font-semibold text-gray-900">{current.endpoint}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-50">
          <span className="text-gray-400">Total Requests:</span>
          <span className="font-semibold text-gray-900">{current.requests}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-50">
          <span className="text-gray-400">Avg Latency:</span>
          <span className="font-semibold text-gray-900">{current.latency}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-gray-50">
          <span className="text-gray-400">Connected Compute:</span>
          <span className="font-semibold text-gray-900">{current.functions}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-400">Recent Deployment:</span>
          <span className="font-semibold text-gray-900">{current.deployments}</span>
        </div>
      </div>
    </div>
  );
}

/* Activity Row */
function ActivityRow({
  status,
  title,
  detail,
  time
}: {
  status: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
      {status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
      {status === 'error' && <X className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="font-mono text-gray-500 truncate">{detail}</div>
      </div>
      <span className="text-[11px] text-gray-400 whitespace-nowrap">{time}</span>
    </div>
  );
}

/* Deployment Table Row */
function DeploymentRow({
  name,
  env,
  commit,
  status,
  duration,
  created
}: {
  name: string;
  env: string;
  commit: string;
  status: 'Success' | 'Warning' | 'Error';
  duration: string;
  created: string;
}) {
  return (
    <tr className="hover:bg-gray-50/80 transition-colors">
      <td className="py-2.5 font-bold font-mono text-gray-900">{name}</td>
      <td className="py-2.5 text-gray-600">{env}</td>
      <td className="py-2.5 font-mono text-gray-500">{commit}</td>
      <td className="py-2.5">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${status === 'Success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : status === 'Warning'
                ? 'text-amber-700 bg-amber-50 border border-amber-200'
                : 'text-red-700 bg-red-50 border border-red-200'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${status === 'Success' ? 'bg-emerald-600' : status === 'Warning' ? 'bg-amber-600' : 'bg-red-600'
              }`}
          />
          {status}
        </span>
      </td>
      <td className="py-2.5 font-mono text-gray-500">{duration}</td>
      <td className="py-2.5 text-right text-gray-400">{created}</td>
    </tr>
  );
}

/* Section Components for Remaining Sidebar Tabs */

function ResourcesSection({ searchQuery }: { searchQuery: string }) {
  const [typeFilter, setTypeFilter] = useState('all');

  const resources = [
    { name: 'api-gateway', type: 'REST API', runtime: 'AWS API Gateway', status: 'Healthy', details: '2 routes mounted' },
    { name: 'src/handlers/users.list', type: 'Function', runtime: 'Node20.x', status: 'Active', details: '256 MB · 24ms' },
    { name: 'src/handlers/users.create', type: 'Function', runtime: 'Node20.x', status: 'Active', details: '256 MB · 48ms' },
    { name: 'src/handlers/email.process', type: 'Queue Consumer', runtime: 'Node20.x', status: 'Active', details: '512 MB · 110ms' },
    { name: 'uploads-bucket', type: 'Storage Bucket', runtime: 'AWS S3', status: 'Ready', details: '10 MB max' },
    { name: 'postgres-db', type: 'Database', runtime: 'PostgreSQL 16', status: 'Healthy', details: '1.2 GB stored' },
  ];

  const filtered = resources.filter(
    (r) =>
      (r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.type.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (typeFilter === 'all' || r.type.toLowerCase().includes(typeFilter))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2">
          {['all', 'function', 'api', 'storage', 'database'].map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${typeFilter === f
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="btn-primary-yellow text-xs">
          <Plus className="w-3.5 h-3.5 text-gray-950" />
          <span>Define Resource</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase text-[10px]">
            <tr>
              <th className="px-5 py-3">Resource Identifier</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Runtime / Provider</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Configuration</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono font-bold text-gray-950 flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-amber-500" />
                  <span>{r.name}</span>
                </td>
                <td className="px-5 py-3 text-gray-600 font-medium">{r.type}</td>
                <td className="px-5 py-3 font-mono text-gray-500">{r.runtime}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                    ● {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-gray-500">{r.details}</td>
                <td className="px-5 py-3 text-right">
                  <button className="text-gray-400 hover:text-gray-700 p-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeploymentsSection() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-3">Deployment Rollouts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] border-b border-gray-200">
              <tr>
                <th className="p-3">Deployment ID</th>
                <th className="p-3">Environment</th>
                <th className="p-3">Commit Hash</th>
                <th className="p-3">Status</th>
                <th className="p-3">Execution Time</th>
                <th className="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <DeploymentRow name="deploy-dep-891" env="Production" commit="a83f92c" status="Success" duration="42s" created="2 min ago" />
              <DeploymentRow name="deploy-dep-890" env="Staging" commit="f7b91d2" status="Success" duration="18s" created="15 min ago" />
              <DeploymentRow name="deploy-dep-889" env="Production" commit="e4c8201" status="Warning" duration="1m 04s" created="1 hr ago" />
              <DeploymentRow name="deploy-dep-888" env="Local" commit="c3d901f" status="Success" duration="4s" created="3 hrs ago" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FunctionsSection() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-3">Serverless Handlers (TypeScript)</h3>
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
              <div className="font-bold text-gray-900">src/handlers/users.list</div>
              <div className="text-gray-500 text-[11px]">GET /users · 256MB · Timeout 30s</div>
            </div>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">Active</span>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
              <div className="font-bold text-gray-900">src/handlers/users.create</div>
              <div className="text-gray-500 text-[11px]">POST /users · 256MB · Timeout 30s</div>
            </div>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">Active</span>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
              <div className="font-bold text-gray-900">src/handlers/email.process</div>
              <div className="text-gray-500 text-[11px]">Queue Worker · 512MB · Retries: 3</div>
            </div>
            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApisSection() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-3">API Gateway Routes</h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">GET /users</span>
            <span className="text-gray-600">src/handlers/users.list</span>
            <span className="text-gray-400">CORS: Enabled</span>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">POST /users</span>
            <span className="text-gray-600">src/handlers/users.create</span>
            <span className="text-gray-400">CORS: Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StorageSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-1">Object Storage Buckets</h3>
        <p className="text-xs text-gray-500 mb-4">AWS S3 / Cloudflare R2 compatibility</p>
        <div className="p-4 border border-gray-200 rounded-lg font-mono text-xs flex justify-between items-center">
          <div>
            <div className="font-bold text-gray-900">uploads-bucket</div>
            <div className="text-gray-500">Max object size: 10MB</div>
          </div>
          <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded">s3://novaserve-uploads</span>
        </div>
      </div>
    </div>
  );
}

function QueuesSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-1">Message Queues</h3>
        <p className="text-xs text-gray-500 mb-4">AWS SQS / Cloudflare Queues</p>
        <div className="p-4 border border-gray-200 rounded-lg font-mono text-xs flex justify-between items-center">
          <div>
            <div className="font-bold text-gray-900">emails-queue</div>
            <div className="text-gray-500">Consumer: src/handlers/email.process (retries: 3)</div>
          </div>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold">0 messages pending</span>
        </div>
      </div>
    </div>
  );
}

function DatabasesSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-1">Managed Relational Databases</h3>
        <p className="text-xs text-gray-500 mb-4">PostgreSQL 16 Serverless Engine</p>
        <div className="p-4 border border-gray-200 rounded-lg font-mono text-xs flex justify-between items-center">
          <div>
            <div className="font-bold text-gray-900">postgres-db</div>
            <div className="text-gray-500">Storage: 1.2 GB / 10 GB</div>
          </div>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold">● Healthy</span>
        </div>
      </div>
    </div>
  );
}

function LogsSection() {
  const [logs, setLogs] = useState<string[]>([
    '[INIT] NovaServe Local Engine v0.1.0 started on http://localhost:4002',
    '[ROUTER] Mounted route GET /users -> src/handlers/users.list',
    '[ROUTER] Mounted route POST /users -> src/handlers/users.create',
    '[14:42:01] INFO GET /users 200 OK (22ms)',
    '[14:42:15] INFO POST /users 201 Created (48ms)',
    '[14:43:02] QUEUE Triggered job: emails-queue -> 1 item processed',
    '[14:45:00] WATCH Hot reload triggered: nova.config.ts updated',
  ]);
  const [isStreaming, setIsStreaming] = useState(true);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      const ms = Math.floor(Math.random() * 60) + 10;
      const routes = ['GET /users', 'POST /users', 'GET /health', 'POST /events'];
      const randomRoute = routes[Math.floor(Math.random() * routes.length)];
      const now = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-40), `[${now}] INFO ${randomRoute} 200 OK (${ms}ms)`]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div className="max-w-7xl mx-auto space-y-3">
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2 font-mono text-xs text-gray-700">
          <Terminal className="w-4 h-4 text-gray-900" />
          <span>Local Hono Execution Log Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsStreaming(!isStreaming)} className="btn-secondary text-xs py-1 px-2.5">
            {isStreaming ? <PauseCircle className="w-3.5 h-3.5 text-amber-600" /> : <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isStreaming ? 'Pause' : 'Stream'}</span>
          </button>
          <button onClick={() => setLogs([])} className="btn-secondary text-xs py-1 px-2.5">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-950 text-gray-200 p-4 rounded-xl font-mono text-xs leading-relaxed min-h-[420px] max-h-[550px] overflow-y-auto border border-gray-800 shadow-inner">
        {logs.map((l, idx) => (
          <div key={idx} className="py-0.5 flex items-start gap-3 border-b border-gray-900">
            <span className="text-gray-600 select-none w-6">{idx + 1}</span>
            <span className={l.includes('200') ? 'text-emerald-400' : l.includes('201') ? 'text-amber-300' : 'text-gray-300'}>
              {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-950">System Metrics & Baseline Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-gray-500 mb-1">P95 Latency</div>
            <div className="text-xl font-bold text-gray-900">32ms</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-gray-500 mb-1">Cold Start Avg</div>
            <div className="text-xl font-bold text-gray-900">180ms</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg">
            <div className="text-gray-500 mb-1">Error Rate</div>
            <div className="text-xl font-bold text-emerald-700">0.00%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TracesSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-3">Distributed X-Ray Traces</h3>
        <div className="p-3 border border-gray-200 rounded-lg text-xs font-mono flex justify-between">
          <span>trace-id: 9a8b7c6d-5e4f3a2b</span>
          <span className="text-emerald-700 font-semibold">Duration: 42ms · 3 Spans</span>
        </div>
      </div>
    </div>
  );
}

function EventsSection() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-gray-950 mb-3">Event Bus Stream</h3>
        <div className="p-3 border border-gray-200 rounded-lg text-xs font-mono text-gray-600">
          [Event] user.created -&gt; dispatched to emails-queue (timestamp: 2 min ago)
        </div>
      </div>
    </div>
  );
}

function AiCopilotSection() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am Nova AI Copilot. Describe the feature or infrastructure component you need, and I will generate pure, type-safe TypeScript configuration with zero YAML.'
    }
  ]);

  const handleSend = () => {
    if (!prompt.trim()) return;
    const txt = prompt;
    setMessages((prev) => [...prev, { role: 'user', text: txt }]);
    setPrompt('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Generated infrastructure update for "${txt}":\n\n\`\`\`typescript\nimport { cache } from "novaserve";\n\nexport const redisCache = cache.redis("sessionCache", {\n  ttl: 3600,\n});\n\`\`\``
        }
      ]);
    }, 900);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center font-bold text-gray-950">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-950">Nova AI Terminal Assistant</h2>
            <p className="text-xs text-gray-500">Natural language TypeScript infrastructure builder</p>
          </div>
        </div>

        <div className="space-y-3 min-h-[280px] max-h-[420px] overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-xs leading-relaxed ${m.role === 'user'
                  ? 'bg-amber-50 border border-amber-200 text-gray-900 ml-auto max-w-xl font-medium'
                  : 'bg-gray-50 border border-gray-200 text-gray-800 mr-auto max-w-xl font-mono'
                }`}
            >
              <div className="font-bold text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                {m.role === 'user' ? 'You' : 'Nova AI'}
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <input
            type="text"
            placeholder="e.g. Add a Redis cache worker resource with 1 hour TTL..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:bg-white focus:border-amber-400"
          />
          <button onClick={handleSend} className="btn-primary-yellow text-xs py-2 px-4">
            Generate Code
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-gray-950 pb-2 border-b border-gray-100">
          nova.config.ts Settings & Provider Options
        </h2>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-gray-500 font-semibold mb-1">Target Cloud Provider</label>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono">
              <option value="aws">AWS (Amazon Web Services)</option>
              <option value="gcp">Google Cloud Platform</option>
              <option value="azure">Microsoft Azure</option>
              <option value="cloudflare">Cloudflare Workers</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 font-semibold mb-1">Local Emulator Port</label>
            <input
              type="text"
              defaultValue="4002"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button className="btn-primary-yellow text-xs">Save Configuration</button>
        </div>
      </div>
    </div>
  );
}

function CliSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-gray-950 mb-2">NovaServe CLI Commands</h2>
        <div className="space-y-2 font-mono text-xs">
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex justify-between">
            <span className="font-bold text-gray-900">nova dev</span>
            <span className="text-gray-500">Launch Hono local dev server with hot reload</span>
          </div>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex justify-between">
            <span className="font-bold text-gray-900">nova deploy</span>
            <span className="text-gray-500">Incremental DAG deployment to cloud target</span>
          </div>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex justify-between">
            <span className="font-bold text-gray-900">nova dashboard</span>
            <span className="text-gray-500">Open enterprise control dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-gray-950">Developer Documentation</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          NovaServe replaces hundreds of lines of complex CloudFormation and Terraform YAML with clean, type-safe TypeScript definitions.
        </p>
      </div>
    </div>
  );
}

function CredentialsSection() {
  const [provider, setProvider] = useState<'aws' | 'cloudflare' | 'gcp' | 'azure' | 'docker'>('aws');
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState(false);

  // AWS Credentials State
  const [awsAccessKey, setAwsAccessKey] = useState('AKIA3B92810X92K4LMA1');
  const [awsSecretKey, setAwsSecretKey] = useState('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
  const [awsRegion, setAwsRegion] = useState('ap-south-1');
  const [awsSessionToken, setAwsSessionToken] = useState('');

  // Cloudflare Credentials State
  const [cfToken, setCfToken] = useState('vB981aXm092_Nks8912Lmkqw0912Z');
  const [cfAccount, setCfAccount] = useState('8901a9b2c89f01e');

  // GCP Credentials State
  const [gcpProject, setGcpProject] = useState('novaserve-prod-192');
  const [gcpJsonKey, setGcpJsonKey] = useState('{\n  "type": "service_account",\n  "project_id": "novaserve-prod-192"\n}');

  // Azure Credentials State
  const [azTenant, setAzTenant] = useState('00000000-0000-0000-0000-000000000000');
  const [azClientId, setAzClientId] = useState('11111111-1111-1111-1111-111111111111');
  const [azClientSecret, setAzClientSecret] = useState('secret_value_azure_credential');

  // Environment Secrets State
  const [appSecrets, setAppSecrets] = useState([
    { key: 'DATABASE_URL', value: 'postgresql://admin:p%40ss@db.novaserve.internal:5432/production', env: 'All Envs' },
    { key: 'JWT_SECRET', value: 'sk_live_981230491823091823091', env: 'Production' },
    { key: 'SENDGRID_API_KEY', value: 'SG.x9812309123809.mnk102938102938', env: 'Production' },
  ]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 3500);
    }, 800);
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestSuccessMsg(false);
    setTimeout(() => {
      setIsTesting(false);
      setTestSuccessMsg(true);
    }, 1200);
  };

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    setAppSecrets((prev) => [...prev, { key: newKey.toUpperCase(), value: newValue, env: 'All Envs' }]);
    setNewKey('');
    setNewValue('');
  };

  const handleDeleteSecret = (keyToDelete: string) => {
    setAppSecrets((prev) => prev.filter((s) => s.key !== keyToDelete));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast alert */}
      {saveSuccessToast && (
        <div className="p-3 bg-gray-900 text-white rounded-lg text-xs font-mono flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>{provider.toUpperCase()} credentials encrypted and saved to project vault!</span>
          </div>
          <span className="text-gray-400 text-[10px]">AES-256</span>
        </div>
      )}

      {/* Main Credentials Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Key className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-950">Cloud Provider Credentials</h2>
              <p className="text-xs text-gray-500">Configure authentication tokens for automated cloud deployments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecrets(!showSecrets)}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showSecrets ? 'Hide Secrets' : 'Reveal Secrets'}</span>
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-700" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isTesting ? 'Verifying...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {testSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{provider.toUpperCase()} Health Check Passed:</strong> Credentials valid, IAM permissions active.
              </span>
            </div>
            <span className="font-semibold text-emerald-700">● Live Connection</span>
          </div>
        )}

        {/* Provider Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'aws', label: 'AWS', icon: <Server className="w-3.5 h-3.5" />, badge: 'Active' },
            { id: 'cloudflare', label: 'Cloudflare', icon: <Globe className="w-3.5 h-3.5" />, badge: 'Active' },
            { id: 'gcp', label: 'Google GCP', icon: <Box className="w-3.5 h-3.5" />, badge: 'Ready' },
            { id: 'azure', label: 'Azure', icon: <HardDrive className="w-3.5 h-3.5" />, badge: 'Ready' },
            { id: 'docker', label: 'Docker', icon: <Cpu className="w-3.5 h-3.5" />, badge: 'Local' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id as any); setTestSuccessMsg(false); }}
              className={`p-3 rounded-lg border text-left transition-all ${provider === p.id
                  ? 'bg-amber-50/70 border-amber-400 border-2 shadow-xs'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100/60'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="text-gray-700">{p.icon}</div>
                  <span className="font-bold text-xs text-gray-900">{p.label}</span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-gray-500">{p.badge}</span>
            </button>
          ))}
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSaveCredentials} className="space-y-4 pt-2">
          {provider === 'aws' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">AWS Access Key ID</label>
                <input
                  type="text"
                  value={awsAccessKey}
                  onChange={(e) => setAwsAccessKey(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">AWS Secret Access Key</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={awsSecretKey}
                  onChange={(e) => setAwsSecretKey(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default AWS Region</label>
                <select
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="eu-west-1">eu-west-1 (Ireland)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">AWS Session Token (Optional)</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={awsSessionToken}
                  onChange={(e) => setAwsSessionToken(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="Optional temporary STS session token"
                />
              </div>
            </div>
          )}

          {provider === 'cloudflare' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cloudflare API Token</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={cfToken}
                  onChange={(e) => setCfToken(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="Cloudflare API Bearer Token"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cloudflare Account ID</label>
                <input
                  type="text"
                  value={cfAccount}
                  onChange={(e) => setCfAccount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="32-character account hash"
                />
              </div>
            </div>
          )}

          {provider === 'gcp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">GCP Project ID</label>
                <input
                  type="text"
                  value={gcpProject}
                  onChange={(e) => setGcpProject(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                  placeholder="gcp-project-id"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Account Key JSON</label>
                <textarea
                  rows={4}
                  value={gcpJsonKey}
                  onChange={(e) => setGcpJsonKey(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {provider === 'azure' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tenant ID</label>
                <input
                  type="text"
                  value={azTenant}
                  onChange={(e) => setAzTenant(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  value={azClientId}
                  onChange={(e) => setAzClientId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Client Secret</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={azClientSecret}
                  onChange={(e) => setAzClientSecret(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {provider === 'docker' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Docker Registry Host</label>
                <input
                  type="text"
                  defaultValue="docker.io"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Access Token</label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  defaultValue="dckr_pat_102938109238"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              Credentials stored in system keytar / encrypted vault
            </span>

            <button type="submit" disabled={isSaving} className="btn-primary-yellow text-xs py-2 px-4">
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-950" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-gray-950" />
                  <span>Save {provider.toUpperCase()} Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Secrets Vault Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-950">Application Secrets Vault</h3>
            <p className="text-xs text-gray-500">Inject encrypted environment secrets into functions & handlers</p>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono text-amber-800 bg-amber-100 rounded font-semibold border border-amber-200">
            {appSecrets.length} Secrets Active
          </span>
        </div>

        {/* Add Secret Form */}
        <form onSubmit={handleAddSecret} className="flex flex-col sm:flex-row items-center gap-2 pb-2">
          <input
            type="text"
            placeholder="KEY (e.g. STRIPE_API_KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full sm:w-1/3 bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
          />
          <input
            type="text"
            placeholder="VALUE (e.g. sk_live_...)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full sm:flex-1 bg-gray-50 border border-gray-200 rounded-lg p-2 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none"
          />
          <button type="submit" className="btn-secondary text-xs py-2 px-3 shrink-0 w-full sm:w-auto justify-center">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Secret</span>
          </button>
        </form>

        {/* Secrets Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-semibold border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5">Secret Key</th>
                <th className="px-4 py-2.5">Encrypted Value</th>
                <th className="px-4 py-2.5">Target Env</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appSecrets.map((s, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-bold text-gray-950">{s.key}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {showSecrets ? s.value : '••••••••••••••••••••••••'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                      {s.env}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleDeleteSecret(s.key)}
                      className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                      title="Delete secret"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function JenkinsStyleLoginScreen({
  onSignIn,
  signOutNotice
}: {
  onSignIn: () => void;
  signOutNotice?: boolean;
}) {
  const [username, setUsername] = useState('shadab@novaserve.dev');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSignIn();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 antialiased font-sans text-gray-900">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-amber-400 items-center justify-center text-gray-800 shadow-xs font-semibold mb-1">
            <Zap className="w-6 h-6 fill-gray-800 text-gray-800" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 tracking-tight flex items-center justify-center gap-2">
            NovaServe
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-gray-200 text-gray-700 border border-gray-300">
              v0.1.0
            </span>
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            The next-generation, cloud-agnostic serverless development framework.
          </p>
        </div>

        {/* Sign Out Alert Notice */}
        {signOutNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-mono flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Signed Out Successfully</div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Your session token was invalidated. Please sign in to resume access.
              </div>
            </div>
          </div>
        )}

        {/* Login Form Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-5">
          <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Authentication</h2>
              <p className="text-[11px] text-gray-500">Sign in with your workspace credentials</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 rounded border border-emerald-200 font-medium">
              ● System Online
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                User ID or Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none transition-all"
                placeholder="shadab@novaserve.dev"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Password / API Key</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-gray-500 hover:text-gray-900 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 font-mono text-xs text-gray-900 focus:bg-white focus:border-amber-400 focus:outline-none transition-all"
                placeholder="••••••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />
                <span>Remember session</span>
              </label>

              <span className="text-[11px] font-mono text-gray-400">JWT Token Auth</span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary-yellow w-full justify-center py-2.5 text-xs shadow-xs font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-800" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-gray-800" />
                    <span>Sign In to Dashboard</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onSignIn}
                className="btn-secondary w-full justify-center py-2 text-xs font-medium"
              >
                <span>Quick Demo Sign-In (1-Click)</span>
              </button>
            </div>
          </form>

          {/* Social / OAuth divider */}
          <div className="pt-2 border-t border-gray-100 text-center">
            <span className="text-[11px] text-gray-400 font-mono">Or authenticate via Single Sign-On</span>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={onSignIn}
                className="btn-secondary text-xs py-2 justify-center font-mono font-medium"
              >
                <span>GitHub SSO</span>
              </button>
              <button
                onClick={onSignIn}
                className="btn-secondary text-xs py-2 justify-center font-mono font-medium"
              >
                <span>SAML / Okta</span>
              </button>
            </div>
          </div>
        </div>


        {/* Footer Security Notice */}
        <div className="text-center text-[11px] text-gray-400 font-mono space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-gray-400" />
            <span>Protected by NovaServe Zero-Trust RBAC & Session Manager</span>
          </div>
          <div>NovaServe Engine Local Emulator :4002</div>
        </div>
      </div>
    </div>
  );
}


