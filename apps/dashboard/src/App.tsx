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
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  ChevronRight,
  Filter,
  Plus,
  PlayCircle,
  PauseCircle,
  Trash2,
  Info
} from 'lucide-react';


export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'logs' | 'ai' | 'settings'>('overview');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccessToast, setDeploySuccessToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setDeploySuccessToast(true);
      setTimeout(() => setDeploySuccessToast(false), 4000);
    }, 1800);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-radial-grid text-slate-100 font-sans">
      {/* Toast Notification */}
      {deploySuccessToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-yellow-400 text-black font-semibold shadow-yellow-glow-lg border border-yellow-300 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-black" />
          <span>Application successfully deployed to AWS (ap-south-1)!</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 glass flex flex-col border-r border-white/10 relative z-20">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-white/10 justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 flex items-center justify-center shadow-yellow-glow transition-all duration-300 group-hover:scale-105 group-hover:rotate-6">
              <Zap className="w-6 h-6 text-black fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-yellow-400 transition-colors">
                  NovaServe
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                  v0.1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Serverless Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Platform Operations
          </div>

          <NavItem
            active={activeTab === 'overview'}
            icon={<Activity className="w-5 h-5" />}
            label="Overview & Topology"
            badge="Live"
            onClick={() => setActiveTab('overview')}
          />
          <NavItem
            active={activeTab === 'resources'}
            icon={<Box className="w-5 h-5" />}
            label="Cloud Resources"
            count={6}
            onClick={() => setActiveTab('resources')}
          />
          <NavItem
            active={activeTab === 'logs'}
            icon={<Terminal className="w-5 h-5" />}
            label="Live Console Stream"
            onClick={() => setActiveTab('logs')}
          />

          <div className="pt-6 pb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Developer Tools
          </div>

          <NavItem
            active={activeTab === 'ai'}
            icon={<Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />}
            label="Nova AI Copilot"
            badge="AI"
            badgeColor="yellow"
            onClick={() => setActiveTab('ai')}
          />
          <NavItem
            active={activeTab === 'settings'}
            icon={<Settings className="w-5 h-5" />}
            label="Config & Runtime"
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        {/* Bottom Environment Status Card */}
        <div className="p-4 border-t border-white/10">
          <div className="yellow-hover-card p-4 rounded-xl border border-white/10 bg-surface-elevated/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Environment</span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-400"></span>
              </span>
            </div>
            <div className="font-bold text-white flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Server className="w-4 h-4 text-yellow-400" />
                Local Hono Engine
              </span>
              <span className="font-mono text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                :4002
              </span>
            </div>
            <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Hot Reload</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background/50">
        {/* Topbar */}
        <header className="h-20 glass border-b border-white/10 flex items-center justify-between px-8 relative z-10">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-extrabold capitalize text-white tracking-tight flex items-center gap-3">
              {activeTab === 'overview' && 'System Overview & DAG Graph'}
              {activeTab === 'resources' && 'Active Cloud Resources'}
              {activeTab === 'logs' && 'Real-time Execution Logs'}
              {activeTab === 'ai' && 'Nova AI Terminal Assistant'}
              {activeTab === 'settings' && 'Framework Configuration'}
            </h1>

            {/* Global Search Bar */}
            <div className="relative hidden md:block w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search functions, APIs, buckets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-elevated/70 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-yellow-400/60 focus:ring-1 focus:ring-yellow-400/60 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('ai')}
              className="white-outline-btn hidden sm:flex"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Ask AI</span>
            </button>

            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="yellow-glow-btn text-sm py-2.5 px-5"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Deploying DAG...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-black fill-black" />
                  <span>Deploy to Cloud</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {activeTab === 'overview' && <OverviewTab onNavigate={setActiveTab} />}
          {activeTab === 'resources' && <ResourcesTab searchQuery={searchQuery} />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'ai' && <AIAssistantTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}

// Custom Sidebar Item with White/Yellow Glow Hover Effects
function NavItem({
  icon,
  label,
  active,
  badge,
  badgeColor,
  count,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
  badgeColor?: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-semibold ${
        active
          ? 'bg-yellow-400 text-black shadow-yellow-glow font-bold'
          : 'text-slate-300 hover:text-white hover:bg-white/10 hover:border hover:border-yellow-400/40 hover:shadow-white-glow'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-black' : 'text-yellow-400'}`}>
          {icon}
        </div>
        <span>{label}</span>
      </div>

      {badge && (
        <span
          className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
            active
              ? 'bg-black text-yellow-400'
              : badgeColor === 'yellow'
              ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/40'
              : 'bg-white/10 text-white border border-white/20'
          }`}
        >
          {badge}
        </span>
      )}

      {count !== undefined && (
        <span
          className={`px-2 py-0.5 text-xs font-mono rounded-full ${
            active ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-slate-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Overview Component with Topology Graph
function OverviewTab({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [selectedNode, setSelectedNode] = useState<string | null>('api-gateway');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Highlight Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Cloud Resources"
          value="6 active"
          subtitle="API, 2 Functions, Bucket, SQS, Postgres"
          icon={<Box className="w-5 h-5 text-yellow-400" />}
          trend="+2 created today"
          glow="yellow"
        />
        <StatCard
          title="Average Latency"
          value="24ms"
          subtitle="Local emulator response time"
          icon={<Activity className="w-5 h-5 text-white" />}
          trend="-8ms vs baseline"
          positive
          glow="white"
        />
        <StatCard
          title="Throughput (RPM)"
          value="1,420 / min"
          subtitle="Aggregated traffic across routes"
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          trend="+18.4% peak load"
          positive
          glow="yellow"
        />
        <StatCard
          title="Est. Monthly Cost"
          value="$0.00"
          subtitle="Local serverless emulation mode"
          icon={<HardDrive className="w-5 h-5 text-white" />}
          trend="Cloud cost estimate: ~$4.12"
          glow="white"
        />
      </div>

      {/* DAG Topology Visualizer */}
      <div className="yellow-hover-card p-6 border border-white/10 bg-surface-elevated/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-yellow-400" />
              Architecture DAG Dependency Graph
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Visual topology auto-generated from <code className="text-yellow-400 font-mono">nova.config.ts</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-mono rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              Real-time DAG Active
            </span>
            <button
              onClick={() => onNavigate('resources')}
              className="white-outline-btn text-xs py-1.5 px-3"
            >
              <span>Manage Items</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Visual Graph Viewport */}
        <div className="relative min-h-[340px] rounded-xl border border-white/10 bg-black/50 p-6 flex flex-col justify-between overflow-hidden">
          {/* Animated Connecting Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-yellow-400/40" strokeWidth="2">
            <line x1="20%" y1="50%" x2="50%" y2="30%" strokeDasharray="4 4" className="animate-flow-line" />
            <line x1="20%" y1="50%" x2="50%" y2="70%" strokeDasharray="4 4" className="animate-flow-line" />
            <line x1="50%" y1="30%" x2="80%" y2="25%" strokeDasharray="4 4" className="animate-flow-line" />
            <line x1="50%" y1="70%" x2="80%" y2="75%" strokeDasharray="4 4" className="animate-flow-line" />
          </svg>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center h-full my-auto">
            {/* Input Column */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ingress Endpoint</div>
              <NodeCard
                id="api-gateway"
                title="API Gateway v2"
                type="REST API"
                status="Healthy"
                details="GET /users, POST /users"
                icon={<Globe className="w-5 h-5 text-yellow-400" />}
                selected={selectedNode === 'api-gateway'}
                onClick={() => setSelectedNode('api-gateway')}
              />
            </div>

            {/* Compute Handlers Column */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Serverless Compute</div>
              <NodeCard
                id="fn-list-users"
                title="src/handlers/users.list"
                type="Node20 Function"
                status="Deployed"
                details="256MB · 42ms avg"
                icon={<Cpu className="w-5 h-5 text-white" />}
                selected={selectedNode === 'fn-list-users'}
                onClick={() => setSelectedNode('fn-list-users')}
              />
              <NodeCard
                id="fn-email-process"
                title="src/handlers/email.process"
                type="Queue Consumer"
                status="Deployed"
                details="512MB · Retries: 3"
                icon={<Layers className="w-5 h-5 text-white" />}
                selected={selectedNode === 'fn-email-process'}
                onClick={() => setSelectedNode('fn-email-process')}
              />
            </div>

            {/* Storage & Queue Column */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Persistence & Messaging</div>
              <NodeCard
                id="db-main"
                title="postgres-db"
                type="Managed Postgres"
                status="Active"
                details="v16 · 1.2GB data"
                icon={<Database className="w-5 h-5 text-yellow-400" />}
                selected={selectedNode === 'db-main'}
                onClick={() => setSelectedNode('db-main')}
              />
              <NodeCard
                id="bucket-uploads"
                title="uploads-bucket"
                type="S3 Storage"
                status="Ready"
                details="Max 10MB per object"
                icon={<HardDrive className="w-5 h-5 text-white" />}
                selected={selectedNode === 'bucket-uploads'}
                onClick={() => setSelectedNode('bucket-uploads')}
              />
            </div>
          </div>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-yellow-400/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-400 text-black">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wide">Selected Node Inspector</span>
                <div className="text-white font-bold text-sm font-mono">{selectedNode}</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">Status: </span>
                <span className="text-emerald-400 font-bold">● Operational</span>
              </div>
              <div>
                <span className="text-slate-500">Runtime: </span>
                <span className="text-white font-bold">Node.js 20.x</span>
              </div>
              <div>
                <span className="text-slate-500">Memory Allocation: </span>
                <span className="text-yellow-400 font-bold">256 MB</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Activity Stream Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 yellow-hover-card p-6 border border-white/10 bg-surface-elevated/70">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Recent Execution Requests
            </h3>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-yellow-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>View full log stream</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 font-bold">GET 200</span>
                <span className="text-white">/users</span>
              </div>
              <span className="text-slate-400">18ms · 256KB</span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 font-bold">POST 201</span>
                <span className="text-white">/users (created id: 9812)</span>
              </div>
              <span className="text-slate-400">45ms · 512KB</span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-blue-400/20 text-blue-400 font-bold">QUEUE</span>
                <span className="text-white">emails-queue -&gt; src/handlers/email.process</span>
              </div>
              <span className="text-slate-400">110ms · Batch 1</span>
            </div>
          </div>
        </div>

        {/* Quick Launch Card */}
        <div className="white-hover-card p-6 border border-white/10 bg-surface-elevated/70 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">CLI Quick Reference</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Run NovaServe commands directly in your local terminal.
            </p>
            <div className="space-y-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-black/60 text-yellow-400 border border-white/10 flex items-center justify-between">
                <span>nova dev</span>
                <span className="text-slate-400">Dev Server</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/60 text-white border border-white/10 flex items-center justify-between">
                <span>nova deploy</span>
                <span className="text-slate-400">Cloud Push</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ai')}
            className="yellow-outline-btn w-full mt-6 text-xs"
          >
            <span>Launch AI Assistant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Node Card Component for DAG Graph
function NodeCard({
  title,
  type,
  status,
  details,
  icon,
  selected,
  onClick
}: {
  id: string;
  title: string;
  type: string;
  status: string;
  details: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
        selected
          ? 'bg-surface-elevated border-yellow-400 shadow-yellow-glow scale-102'
          : 'bg-surface/80 border-white/10 hover:border-white/40 hover:bg-surface-elevated'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">{icon}</div>
          <div>
            <div className="font-bold text-sm text-white font-mono">{title}</div>
            <div className="text-[11px] text-slate-400">{type}</div>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
          {status}
        </span>
      </div>
      <div className="text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
        <span>{details}</span>
        <ChevronRight className="w-3.5 h-3.5 text-yellow-400" />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  positive,
  glow
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: string;
  positive?: boolean;
  glow?: 'yellow' | 'white';
}) {
  return (
    <div
      className={
        glow === 'yellow'
          ? 'yellow-hover-card p-6 border border-white/10 bg-surface-elevated/70'
          : 'white-hover-card p-6 border border-white/10 bg-surface-elevated/70'
      }
    >
      <div className="flex items-center justify-between mb-3 text-slate-400">
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        <div className="p-2 rounded-xl bg-white/5 border border-white/10">{icon}</div>
      </div>
      <div className="text-3xl font-extrabold text-white tracking-tight mb-1 font-mono">{value}</div>
      <div className="text-xs text-slate-400 mb-3">{subtitle}</div>
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className={`font-semibold ${positive ? 'text-emerald-400' : 'text-yellow-400'}`}>
          {trend}
        </span>
        <span className="text-slate-400">Live Metric</span>
      </div>
    </div>
  );
}

// Resources View
function ResourcesTab({ searchQuery }: { searchQuery: string }) {
  const [filter, setFilter] = useState('all');

  const resources = [
    { name: 'api-users', type: 'REST API', runtime: 'AWS API Gateway', status: 'Healthy', memory: '-', routes: '2 routes' },
    { name: 'src/handlers/users.list', type: 'Function', runtime: 'Node20.x', status: 'Active', memory: '256 MB' },
    { name: 'src/handlers/users.create', type: 'Function', runtime: 'Node20.x', status: 'Active', memory: '256 MB' },
    { name: 'src/handlers/email.process', type: 'Queue Handler', runtime: 'Node20.x', status: 'Active', memory: '512 MB' },
    { name: 'uploads-bucket', type: 'Storage Bucket', runtime: 'AWS S3', status: 'Ready', memory: '10 MB max' },
    { name: 'postgres-database', type: 'Database', runtime: 'PostgreSQL 16', status: 'Healthy', memory: 'Auto-scaled' },
  ];

  const filteredResources = resources.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.type.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'functions') return matchesSearch && (r.type === 'Function' || r.type === 'Queue Handler');
    if (filter === 'api') return matchesSearch && r.type === 'REST API';
    if (filter === 'storage') return matchesSearch && (r.type === 'Storage Bucket' || r.type === 'Database');
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl glass border border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto">
          {['all', 'functions', 'api', 'storage'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                filter === f
                  ? 'bg-yellow-400 text-black shadow-yellow-glow'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="white-outline-btn text-xs py-2 px-4">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
          <button className="yellow-glow-btn text-xs py-2 px-4">
            <Plus className="w-3.5 h-3.5 text-black" />
            <span>Add Resource</span>
          </button>
        </div>
      </div>

      {/* Table View */}
      <div className="yellow-hover-card border border-white/10 bg-surface-elevated/80 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans">
            <thead className="bg-black/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Resource Identifier</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Target Runtime</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Memory / Size</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filteredResources.map((res, i) => (
                <tr
                  key={i}
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="px-6 py-4 font-mono font-bold text-white flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 group-hover:scale-110 transition-transform">
                      {res.type.includes('Function') ? <Cpu className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                    </div>
                    <span>{res.name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-medium">{res.type}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{res.runtime}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 text-xs rounded-full font-bold inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {res.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{res.memory}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-yellow-400/20 hover:text-yellow-400 transition-colors">
                        <PlayCircle className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg bg-white/5 hover:bg-white/20 transition-colors">
                        <Terminal className="w-4 h-4" />
                      </button>
                    </div>
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

// Real-time Console Log Terminal
function LogsTab() {
  const [logs, setLogs] = useState<string[]>([
    '[INIT] NovaServe Local Dev Engine v0.1.0 started on http://localhost:4002',
    '[ROUTER] Mounted route GET /users -> src/handlers/users.list',
    '[ROUTER] Mounted route POST /users -> src/handlers/users.create',
    '[14:42:01] INFO GET /users 200 OK (22ms)',
    '[14:42:15] INFO POST /users 201 Created (48ms) payload: { name: "Shadab" }',
    '[14:43:02] QUEUE Triggered job: email-dispatch -> 1 item processed',
    '[14:45:00] WATCH Hot reload triggered: nova.config.ts updated successfully',
  ]);

  const [isStreaming, setIsStreaming] = useState(true);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      const ms = Math.floor(Math.random() * 80) + 12;
      const routes = ['GET /users', 'POST /users', 'GET /health', 'POST /events'];
      const randomRoute = routes[Math.floor(Math.random() * routes.length)];
      const now = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-30), `[${now}] INFO ${randomRoute} 200 OK (${ms}ms)`]);
    }, 3000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 rounded-2xl glass border border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
          </div>
          <span className="font-mono text-xs text-slate-400 border-l border-white/10 pl-3">
            Local Hono Execution Log Terminal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="white-outline-btn text-xs py-1.5 px-3"
          >
            {isStreaming ? <PauseCircle className="w-4 h-4 text-yellow-400" /> : <PlayCircle className="w-4 h-4 text-emerald-400" />}
            <span>{isStreaming ? 'Pause Stream' : 'Resume Stream'}</span>
          </button>
          <button
            onClick={() => setLogs([])}
            className="white-outline-btn text-xs py-1.5 px-3 text-slate-400 hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Screen */}
      <div className="yellow-hover-card border border-white/10 bg-black/90 p-6 rounded-2xl font-mono text-xs leading-relaxed min-h-[450px] shadow-2xl overflow-y-auto">
        {logs.map((log, index) => (
          <div key={index} className="py-1 border-b border-white/5 hover:bg-white/5 px-2 rounded transition-colors flex items-start gap-3">
            <span className="text-slate-500 select-none">{index + 1}</span>
            <span className={log.includes('200') ? 'text-emerald-400' : log.includes('201') ? 'text-yellow-400' : 'text-slate-300'}>
              {log}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Copilot View
function AIAssistantTab() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Hello! I am **Nova AI Copilot**. I can automatically generate handlers, modify `nova.config.ts`, or optimize your cloud deployments. What would you like to build today?'
    }
  ]);
  const [prompt, setPrompt] = useState('');

  const handleSend = () => {
    if (!prompt.trim()) return;
    const userMsg = prompt;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setPrompt('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Analyzed request: "${userMsg}". Generated updated resource definition with zero YAML.`
        }
      ]);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="yellow-hover-card p-6 border border-white/10 bg-surface-elevated/80 rounded-2xl">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-6">
          <div className="p-3 rounded-xl bg-yellow-400 text-black shadow-yellow-glow">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Nova AI Terminal Assistant</h2>
            <p className="text-xs text-slate-400">Natural language infrastructure and handler code generator</p>
          </div>
        </div>

        <div className="space-y-4 min-h-[350px] max-h-[500px] overflow-y-auto mb-6 pr-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-4 p-4 rounded-2xl text-sm ${
                m.role === 'user'
                  ? 'bg-yellow-400/10 border border-yellow-400/30 text-white ml-auto max-w-xl'
                  : 'bg-black/60 border border-white/10 text-slate-200 mr-auto max-w-2xl'
              }`}
            >
              <div className="shrink-0 font-bold font-mono text-xs uppercase tracking-wider text-yellow-400">
                {m.role === 'user' ? 'You' : 'Nova AI'}
              </div>
              <div className="leading-relaxed">{m.text}</div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="e.g. Add a Redis cache resource and worker handler..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
          />
          <button onClick={handleSend} className="yellow-glow-btn px-6 py-3">
            <span>Generate</span>
            <ChevronRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Settings View
function SettingsTab() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="yellow-hover-card p-6 border border-white/10 bg-surface-elevated/80 rounded-2xl space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2.5 border-b border-white/10 pb-4">
          <Settings className="w-5 h-5 text-yellow-400" />
          Framework & Emulator Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Local Dev Port</label>
            <input
              type="text"
              defaultValue="4002"
              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm text-yellow-400 focus:outline-none focus:border-yellow-400"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Default Cloud Provider</label>
            <select className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-yellow-400">
              <option value="aws">AWS (Amazon Web Services)</option>
              <option value="gcp">GCP (Google Cloud)</option>
              <option value="azure">Microsoft Azure</option>
              <option value="cloudflare">Cloudflare Workers</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button className="yellow-glow-btn px-6 py-2.5">Save Settings</button>
        </div>
      </div>
    </div>
  );
}

