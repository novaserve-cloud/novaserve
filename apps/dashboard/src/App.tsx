import { useState } from 'react';
import { Activity, Box, Database, Globe, Play, Settings, Terminal, Zap } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 glass flex flex-col border-r">
        <div className="h-16 flex items-center px-6 border-b border-slate-700/50">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Zap className="w-6 h-6 fill-primary" />
            NovaServe
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'overview'} icon={<Activity />} label="Overview" onClick={() => setActiveTab('overview')} />
          <NavItem active={activeTab === 'resources'} icon={<Box />} label="Resources" onClick={() => setActiveTab('resources')} />
          <NavItem active={activeTab === 'logs'} icon={<Terminal />} label="Live Logs" onClick={() => setActiveTab('logs')} />
          <NavItem active={activeTab === 'settings'} icon={<Settings />} label="Settings" onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="glass rounded-lg p-3 text-sm">
            <div className="text-slate-400 mb-1">Environment</div>
            <div className="font-semibold text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Local Dev
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 glass border-b flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold capitalize">{activeTab}</h1>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-medium transition-colors flex items-center gap-2 text-sm">
              <Play className="w-4 h-4" />
              Deploy to Cloud
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'resources' && <Resources />}
          {activeTab === 'logs' && <Logs />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
        active 
          ? 'bg-primary/10 text-primary font-medium' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
      }`}
    >
      <div className={`w-5 h-5 ${active ? 'text-primary' : ''}`}>
        {icon}
      </div>
      {label}
    </button>
  );
}

function Overview() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <StatCard title="Total Resources" value="12" icon={<Box />} trend="+2 this week" />
        <StatCard title="Avg Latency" value="45ms" icon={<Activity />} trend="-12ms this week" positive />
        <StatCard title="Est. Cost" value="$12.40" icon={<Database />} trend="+$1.20 this month" />
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          Architecture Graph
        </h2>
        <div className="h-64 border border-slate-700/50 rounded-lg border-dashed flex items-center justify-center text-slate-500 bg-slate-800/30">
          (React Flow Diagram will go here)
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, positive }: any) {
  return (
    <div className="glass rounded-xl p-5 hover:bg-surface/70 transition-colors">
      <div className="flex items-center justify-between mb-3 text-slate-400">
        <span className="font-medium">{title}</span>
        <div className="w-5 h-5">{icon}</div>
      </div>
      <div className="text-3xl font-bold mb-2">{value}</div>
      <div className={`text-sm ${positive ? 'text-emerald-400' : 'text-slate-400'}`}>
        {trend}
      </div>
    </div>
  );
}

function Resources() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-800/50 text-slate-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Memory</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[
              { name: 'api-get-users', type: 'Function', status: 'Deployed', memory: '256MB' },
              { name: 'process-emails', type: 'Queue Handler', status: 'Deployed', memory: '512MB' },
              { name: 'avatars', type: 'Storage Bucket', status: 'Deployed', memory: '-' },
            ].map((r, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-medium">{r.name}</td>
                <td className="px-6 py-4 text-slate-400">{r.type}</td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 bg-emerald-400/10 text-emerald-400 text-xs rounded-full font-medium">
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">{r.memory}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Logs() {
  return (
    <div className="h-full glass rounded-xl p-4 font-mono text-sm overflow-auto">
      <div className="text-slate-500 mb-4">// Streaming logs from local emulator...</div>
      {[
        '[10:42:01] GET /users - 200 OK (45ms)',
        '[10:42:05] POST /users - 201 Created (120ms)',
        '[10:45:12] Queue emails triggered processing',
        '[10:45:13] S3 upload successful',
      ].map((log, i) => (
        <div key={i} className="mb-2 text-slate-300">
          <span className="text-primary">{log.split(' ')[0]}</span>
          <span className="ml-2">{log.substring(log.indexOf(' ') + 1)}</span>
        </div>
      ))}
    </div>
  );
}

export default App;
