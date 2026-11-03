import React, { useState } from 'react';
import { 
  CreditCard, 
  Settings, 
  Gift, 
  Shield, 
  Globe, 
  Save, 
  Check, 
  Server, 
  KeyRound,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { ProtocolItem } from '../types';

interface ConfigSettingsProps {
  cardNumber: string;
  cardHolder: string;
  protocols: ProtocolItem[];
  trialSettings: { enabled: boolean; days: number; trafficGb: number; protocol: string };
  onUpdateCardSettings: (cardNumber: string, cardHolder: string) => void;
  onUpdateTrialSettings: (settings: { enabled: boolean; days: number; trafficGb: number; protocol: string }) => void;
  onToggleProtocol: (key: string) => void;
  onResetData: () => void;
}

export const ConfigSettings: React.FC<ConfigSettingsProps> = ({
  cardNumber,
  cardHolder,
  protocols,
  trialSettings,
  onUpdateCardSettings,
  onUpdateTrialSettings,
  onToggleProtocol,
  onResetData
}) => {
  const [localCardNumber, setLocalCardNumber] = useState(cardNumber);
  const [localCardHolder, setLocalCardHolder] = useState(cardHolder);
  const [localTrialDays, setLocalTrialDays] = useState(trialSettings.days);
  const [localTrialGb, setLocalTrialGb] = useState(trialSettings.trafficGb);
  const [savedNotice, setSavedNotice] = useState(false);

  const [xuiUrl, setXuiUrl] = useState('https://panel.fastvpn.net:2053');
  const [xuiUser, setXuiUser] = useState('admin');
  const [xuiPass, setXuiPass] = useState('••••••••••••');
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCardSettings(localCardNumber, localCardHolder);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleSaveTrial = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTrialSettings({
      ...trialSettings,
      days: Number(localTrialDays),
      trafficGb: Number(localTrialGb)
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleTestConnection = () => {
    setConnectionStatus('testing');
    setTimeout(() => {
      setConnectionStatus('success');
      setTimeout(() => setConnectionStatus(null), 3500);
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 text-slate-100 space-y-8">
      {/* Settings Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Bot &amp; Panel Configuration</h2>
            <p className="text-xs text-slate-400">
              Control merchant bank card details, free trial rules, protocols, and 3x-UI connection parameters.
            </p>
          </div>
        </div>

        {savedNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>Changes Saved!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Payment Card Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              Merchant Payment Card (Editable from Bot)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              Admin Only
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            These values are displayed to customers when paying by card. Admins can update these either here or directly from inside Telegram using the inline bot menu.
          </p>

          <form onSubmit={handleSaveCard} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Bank Card Number
              </label>
              <input
                type="text"
                value={localCardNumber}
                onChange={(e) => setLocalCardNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
                placeholder="4400 1234 5678 9012"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Cardholder Name
              </label>
              <input
                type="text"
                value={localCardHolder}
                onChange={(e) => setLocalCardHolder(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="John Doe (FastVPN Sales)"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Payment Card</span>
            </button>
          </form>
        </div>

        {/* 2. Free Trial Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-400" />
              Free Trial / Test Account Rules
            </h3>
            <button
              onClick={() => onUpdateTrialSettings({ ...trialSettings, enabled: !trialSettings.enabled })}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                trialSettings.enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}
            >
              {trialSettings.enabled ? 'Enabled 🟢' : 'Disabled 🔴'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Allow new users to claim a 1-time test account before purchasing. The bot creates the client with these limits.
          </p>

          <form onSubmit={handleSaveTrial} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={localTrialDays}
                  onChange={(e) => setLocalTrialDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Traffic Limit (GB)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={localTrialGb}
                  onChange={(e) => setLocalTrialGb(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Default Protocol
              </label>
              <select
                value={trialSettings.protocol}
                onChange={(e) => onUpdateTrialSettings({ ...trialSettings, protocol: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Tunnel (VLESS-Reality)">Tunnel (VLESS-Reality)</option>
                <option value="WireGuard-Tunnel">WireGuard-Tunnel</option>
                <option value="Direct (VLESS / VMess / Trojan)">Direct (VLESS / VMess / Trojan)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Update Trial Rules</span>
            </button>
          </form>
        </div>

        {/* 3. Protocols Visibility */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Active Protocols (Admin Toggle)
            </h3>
            <span className="text-xs text-slate-400">Controls user menus</span>
          </div>

          <div className="space-y-3">
            {protocols.map((proto) => (
              <div
                key={proto.key}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-semibold text-white">{proto.name}</h4>
                  <p className="text-[11px] text-slate-400">{proto.description}</p>
                </div>
                <button
                  onClick={() => onToggleProtocol(proto.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    proto.isEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {proto.isEnabled ? 'Visible 🟢' : 'Hidden 🔴'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 3x-UI Connection Diagnostics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Connected 3x-UI Panel API
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
              Xray Core 1.8.23
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Panel REST Base URL</label>
              <input
                type="text"
                value={xuiUrl}
                onChange={(e) => setXuiUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-cyan-300 text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">API User</label>
                <input
                  type="text"
                  value={xuiUser}
                  onChange={(e) => setXuiUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">API Password</label>
                <input
                  type="password"
                  value={xuiPass}
                  onChange={(e) => setXuiPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {connectionStatus === 'testing' 
                  ? 'Testing REST Handshake...' 
                  : connectionStatus === 'success'
                  ? '✓ Handshake OK (Status 200)'
                  : 'Test Panel API Connection'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset State Option */}
      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="font-semibold text-slate-300">Reset Simulator State</span>
          <p className="text-slate-500 mt-0.5">Clears simulated chats, configs, and resets back to starter seed data.</p>
        </div>
        <button
          onClick={onResetData}
          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800/40 font-medium transition-all flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Data</span>
        </button>
      </div>
    </div>
  );
};
