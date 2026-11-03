import React, { useState } from 'react';
import QRCode from 'qrcode';
import { 
  Server, 
  Activity, 
  ShieldCheck, 
  Users, 
  Plus, 
  Trash2, 
  Clock, 
  RefreshCw, 
  QrCode, 
  Copy, 
  Cpu, 
  HardDrive,
  Layers,
  Zap,
  ExternalLink
} from 'lucide-react';
import { InboundItem, VpnConfigItem } from '../types';

interface XuiConsoleProps {
  inbounds: InboundItem[];
  configs: VpnConfigItem[];
  onDeleteConfig: (configId: number) => void;
  onExtendConfig: (configId: number, addGb: number, addDays: number) => void;
}

export const XuiConsole: React.FC<XuiConsoleProps> = ({
  inbounds,
  configs,
  onDeleteConfig,
  onExtendConfig
}) => {
  const [selectedInboundId, setSelectedInboundId] = useState<number>(1);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [qrModalData, setQrModalData] = useState<{ title: string; qrUrl: string; rawText: string } | null>(null);

  const selectedInbound = inbounds.find(i => i.id === selectedInboundId) || inbounds[0];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleShowQr = async (title: string, rawText: string) => {
    const qrUrl = await QRCode.toDataURL(rawText, { margin: 2, scale: 6 });
    setQrModalData({ title, qrUrl, rawText });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100 space-y-6">
      {/* 3x-UI Panel Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold tracking-tight text-white">3x-UI Panel Virtual Node</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Endpoint: https://panel.fastvpn.net:2053 • Core: Xray 1.8.23 • Single Server Mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">CPU:</span>
            <span className="font-semibold text-slate-200">12%</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">RAM:</span>
            <span className="font-semibold text-slate-200">284 MB</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Clients:</span>
            <span className="font-semibold text-emerald-400 font-mono">{configs.length}</span>
          </div>
        </div>
      </div>

      {/* Inbounds Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inbounds.map((ib) => {
          const isSelected = ib.id === selectedInboundId;
          const matchingConfigs = configs.filter(c => c.inboundId === ib.id);

          return (
            <div
              key={ib.id}
              onClick={() => setSelectedInboundId(ib.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-blue-600/10 border-blue-500/80 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase font-mono text-cyan-400">
                  {ib.protocol}
                </span>
                <span className="text-xs font-mono text-slate-400">Port {ib.port}</span>
              </div>
              <h3 className="font-bold text-white text-sm mb-1">{ib.remark}</h3>
              <p className="text-xs text-slate-400 mb-3">
                Security: <span className="text-slate-200 font-medium">{ib.streamSettings.security || 'none'}</span> ({ib.streamSettings.network})
              </p>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-slate-400">Active Clients:</span>
                <span className="font-semibold text-white font-mono">{matchingConfigs.length}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Inbound Details & Clients Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              Clients on Inbound #{selectedInbound.id} ({selectedInbound.remark})
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Synchronized automatically via 3x-UI REST API (/panel/api/inbounds/addClient)
            </p>
          </div>

          {selectedInbound.streamSettings.realitySettings && (
            <div className="text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Reality SNI:</span>
                <span className="text-emerald-400 font-mono font-medium">
                  {selectedInbound.streamSettings.realitySettings.serverNames.join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Public Key:</span>
                <span className="text-cyan-300 font-mono text-[11px] truncate max-w-xs">
                  {selectedInbound.streamSettings.realitySettings.publicKey}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Clients Table */}
        {configs.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-300">No client configurations generated yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Use the Telegram Bot Simulator to buy a plan or claim a Free Trial to trigger automatic 3x-ui provisioning.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Client Email</th>
                  <th className="py-3 px-4">UUID / Key</th>
                  <th className="py-3 px-4">Protocol</th>
                  <th className="py-3 px-4">Traffic Limit</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {configs.map((cfg) => {
                  const trafficLimitStr = cfg.trafficLimitBytes === 0 
                    ? 'Unlimited' 
                    : `${(cfg.trafficLimitBytes / (1024**3)).toFixed(1)} GB`;

                  return (
                    <tr key={cfg.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-medium text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {cfg.email}
                      </td>
                      <td className="py-3.5 px-4 text-cyan-300 text-[11px] truncate max-w-xs">
                        {cfg.clientUuid}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {cfg.protocol}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {trafficLimitStr}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans space-x-1.5">
                        <button
                          onClick={() => handleShowQr(`Config #${cfg.id} (${cfg.email})`, cfg.configLink)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Show QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(cfg.configLink, `cfg-${cfg.id}`)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all"
                          title="Copy URI"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onExtendConfig(cfg.id, 50, 30)}
                          className="p-1.5 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded-lg transition-all"
                          title="Extend +30 Days / +50 GB"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteConfig(cfg.id)}
                          className="p-1.5 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded-lg transition-all"
                          title="Delete from 3x-ui"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code Inspection Modal */}
      {qrModalData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <QrCode className="w-5 h-5 text-cyan-400" />
                {qrModalData.title}
              </h3>
              <button 
                onClick={() => setQrModalData(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl flex items-center justify-center">
              <img src={qrModalData.qrUrl} alt="QR Code" className="w-56 h-56 object-contain" />
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 break-all max-h-24 overflow-y-auto">
              {qrModalData.rawText}
            </div>

            <button
              onClick={() => setQrModalData(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
