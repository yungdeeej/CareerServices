import React from 'react';

const STATUS_CONFIG = {
  pre_req: { label: 'Pre-Req Incomplete', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  ready: { label: 'Ready', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  active: { label: 'Active', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completing: { label: 'Completing', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  complete: { label: 'Complete', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const AGREEMENT_CONFIG = {
  none: { label: 'No Agreement', color: 'bg-red-500/20 text-red-400', icon: '🔴' },
  sent: { label: 'Awaiting Signature', color: 'bg-amber-500/20 text-amber-400', icon: '🟡' },
  host_signed: { label: 'Awaiting Dean', color: 'bg-orange-500/20 text-orange-400', icon: '🟠' },
  executed: { label: 'Active Partner', color: 'bg-green-500/20 text-green-400', icon: '🟢' },
};

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}

export function AgreementBadge({ status }) {
  const config = AGREEMENT_CONFIG[status] || AGREEMENT_CONFIG.none;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

export function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const color = pct >= 100 ? 'bg-accent-green' : pct >= 50 ? 'bg-accent-blue' : 'bg-accent-amber';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-dark-border rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">
        {current} / {total} hrs
      </span>
    </div>
  );
}
