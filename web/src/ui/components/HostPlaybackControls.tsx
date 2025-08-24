import React, { useEffect, useMemo, useState } from 'react';
import { Card } from './Card';
import { GradientButton } from './GradientButton';
import { ConnectDevice, getDevices, transfer } from '../../utils/playback';

interface HostPlaybackControlsProps {
  currentTrackId?: string;
  selectedDeviceId: string | null;
  onDeviceSelect: (deviceId: string | null) => void;
}

export function HostPlaybackControls({ currentTrackId, selectedDeviceId, onDeviceSelect }: HostPlaybackControlsProps) {
  const [devices, setDevices] = useState<ConnectDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDevice = useMemo(() => devices.find(d => d.id === selectedDeviceId) || null, [devices, selectedDeviceId]);

  // Auto-select active device when devices are loaded
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      const activeDevice = devices.find(d => d.is_active);
      if (activeDevice) {
        onDeviceSelect(activeDevice.id);
      }
    }
  }, [devices, selectedDeviceId, onDeviceSelect]);

  async function refreshDevices() {
    setError(null);
    setLoading(true);
    try {
      const list = await getDevices();
      setDevices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshDevices(); }, []);

  const handleSelect = (id: string) => {
    onDeviceSelect(id);
  };

  return (
    <Card title="Host Playback (Spotify Connect)" icon="🖥️" className="mb-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center flex-wrap">
          <select
            className="bg-slate-800 text-white px-3 py-2 rounded border border-slate-700 min-w-[260px]"
            value={selectedDeviceId || ''}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="" disabled>Select a device…</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} {d.is_active ? '(active)' : ''} — {d.type}
              </option>
            ))}
          </select>
          <GradientButton variant="blue" icon="🔄" onClick={refreshDevices} disabled={loading}>Refresh</GradientButton>
          <span className="text-slate-300 text-sm">
            Selected: {selectedDevice ? `${selectedDevice.name} — ${selectedDevice.is_active ? 'active' : 'inactive'}` : 'None'}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <GradientButton
            icon="📡"
            disabled={!selectedDeviceId}
            onClick={async () => {
              if (!selectedDeviceId) return;
              try { await transfer(selectedDeviceId, false); } catch { setError('Failed to activate device'); }
            }}
          >Activate Device</GradientButton>

          {/* Removed Re-play Current; Start/Next handle playback */}

          {/* Pause moved to Host Controls */}

          {/* Removed Next and Seek controls; use main Next Track button */}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2 rounded">
            ⚠️ {error}
          </div>
        )}
        <div className="text-xs text-slate-400">
          Tip: Open the Spotify app on your device and press play/pause once to activate it if transfer fails.
        </div>
      </div>
    </Card>
  );
}
