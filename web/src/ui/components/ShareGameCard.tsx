import React from 'react';
import { Card } from './Card';
import { GradientButton } from './GradientButton';

interface ShareGameCardProps {
  group: string;
  qrVisible: boolean;
  qrDataUrl: string | null;
  shareLink: string;
  onToggleQR: () => void;
  onCopyGameCode: () => void;
  onCopyShareLink: () => void;
}

export function ShareGameCard({
  group,
  qrVisible,
  qrDataUrl,
  shareLink,
  onToggleQR,
  onCopyGameCode,
  onCopyShareLink
}: ShareGameCardProps) {
  return (
    <Card title="Share Game" icon="🔗" className="mb-6">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Game Code</label>
          <code className="bg-slate-900/70 text-green-400 font-mono text-lg font-bold px-3 py-2 rounded-lg border border-slate-600 block">
            {group}
          </code>
        </div>
        <GradientButton
          variant="blue"
          size="sm"
          icon="📋"
          onClick={onCopyGameCode}
        >
          Copy
        </GradientButton>
        <GradientButton
          variant="purple"
          size="sm"
          icon={qrVisible ? '🙈' : '📱'}
          onClick={onToggleQR}
        >
          {qrVisible ? 'Hide QR' : 'Show QR'}
        </GradientButton>
        <GradientButton
          variant="green"
          size="sm"
          icon="🔗"
          onClick={onCopyShareLink}
        >
          Copy Invitation Link
        </GradientButton>
      </div>
      {qrVisible && (
        <div className="mt-6 flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl shadow-lg">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Join QR" width={200} height={200} className="rounded-lg" />
            ) : (
              <div className="w-50 h-50 bg-slate-200 rounded-lg flex items-center justify-center">
                <span className="text-slate-500">Generating QR…</span>
              </div>
            )}
          </div>
          {window.location.hostname === '127.0.0.1' && (
            <div className="mt-3 text-amber-400 text-sm text-center bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              ⚠️ 127.0.0.1 works only on this device. For others on your network, set WEB_URL and open the app using your LAN IP.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}