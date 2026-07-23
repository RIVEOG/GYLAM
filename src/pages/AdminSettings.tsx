import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Server, Gauge } from 'lucide-react';
import { fetchSettings, updateSetting } from '@/lib/db';
import type { Settings } from '@/lib/types';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Spinner } from '@/components/Spinner';

export function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // local editable copies
  const [freeEnabled, setFreeEnabled] = useState(true);
  const [freeRam, setFreeRam] = useState(2048);
  const [freeDisk, setFreeDisk] = useState(5120);
  const [freeCpu, setFreeCpu] = useState(100);
  const [panelName, setPanelName] = useState('Panel');
  const [panelUrl, setPanelUrl] = useState('');

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setFreeEnabled(s.free_servers_enabled);
        setFreeRam(s.free_ram_mb);
        setFreeDisk(s.free_disk_mb);
        setFreeCpu(s.free_cpu_percent);
        setPanelName(s.panel_name);
        setPanelUrl(s.panel_url);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting('free_servers_enabled', String(freeEnabled)),
        updateSetting('free_ram_mb', String(freeRam)),
        updateSetting('free_disk_mb', String(freeDisk)),
        updateSetting('free_cpu_percent', String(freeCpu)),
        updateSetting('panel_name', panelName),
        updateSetting('panel_url', panelUrl),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // update document title
      document.title = `${panelName} — Game Server Management`;
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Free server limits */}
      <Card>
        <CardHeader title="Free Server Limits" subtitle="Resource caps for user-created free servers" />
        <div className="space-y-5 p-5">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Enable Free Servers</p>
              <p className="text-xs text-slate-500">Allow users to create free servers</p>
            </div>
            <button
              onClick={() => setFreeEnabled(!freeEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${freeEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${freeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Max RAM (MB)" name="freeram" type="number" min={256} step={256} value={freeRam} onChange={(e) => setFreeRam(Number(e.target.value))} />
            <Input label="Max Disk (MB)" name="freedisk" type="number" min={256} step={256} value={freeDisk} onChange={(e) => setFreeDisk(Number(e.target.value))} />
            <Input label="Max CPU (%)" name="freecpu" type="number" min={10} value={freeCpu} onChange={(e) => setFreeCpu(Number(e.target.value))} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/50 py-2">
              <Gauge size={14} className="mx-auto mb-1 text-amber-400" />
              <p className="text-xs text-slate-500">RAM</p>
              <p className="text-sm text-slate-200">{freeRam >= 1024 ? `${(freeRam / 1024).toFixed(1)} GB` : `${freeRam} MB`}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 py-2">
              <Server size={14} className="mx-auto mb-1 text-sky-400" />
              <p className="text-xs text-slate-500">Disk</p>
              <p className="text-sm text-slate-200">{freeDisk >= 1024 ? `${(freeDisk / 1024).toFixed(1)} GB` : `${freeDisk} MB`}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 py-2">
              <SettingsIcon size={14} className="mx-auto mb-1 text-blue-400" />
              <p className="text-xs text-slate-500">CPU</p>
              <p className="text-sm text-slate-200">{freeCpu}%</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Panel branding */}
      <Card>
        <CardHeader title="Panel Branding" subtitle="Name and URL shown across the panel" />
        <div className="space-y-4 p-5">
          <Input label="Panel Name" name="panelname" value={panelName} onChange={(e) => setPanelName(e.target.value)} placeholder="My Panel" />
          <Input label="Panel URL" name="panelurl" value={panelUrl} onChange={(e) => setPanelUrl(e.target.value)} placeholder="https://panel.example.com" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner size={14} /> : <><Save size={14} /> Save Settings</>}
        </Button>
        {saved && <span className="text-sm text-emerald-400">Settings saved!</span>}
      </div>
    </div>
  );
}
