import { Card, CardBody, Typography, Switch } from "@material-tailwind/react";
import { useEffect, useRef, useState } from "react";
import BackButton from "../components/BackButton";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import Modal from "../components/Modal";

export default function Settings() {
  const defaults = {
    notifications: { email: true, desktop: false, sound: false },
    language: "en-US",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };

  // ---------- State ----------
  const [settings, setSettings] = useState(defaults);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("alchemy.settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...defaults, ...parsed });
      }
    } catch {}
  }, []);

  // ---------- Helpers ----------
  const saveSettings = (next) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    localStorage.setItem("alchemy.settings", JSON.stringify(merged));
  };

  const applyTheme = () => {};

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alchemy-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      saveSettings(parsed);
      applyTheme(parsed.theme || settings.theme);
    } catch (e) {
      alert("Invalid settings file.");
    }
  };

  const resetSettings = () => {
    saveSettings({ ...defaults });
    setConfirmReset(false);
  };

  const accentPalette = [];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <div>
              <Typography variant="h6" className="text-primary">Settings</Typography>
              <p className="text-sm text-textMuted">Manage basic preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton variant="outline" title="Export" ariaLabel="Export" onClick={exportSettings}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v8m0 0l-3-3m3 3l3-3M4 19h16"/></svg>
            </IconButton>
            <IconButton variant="outline" title="Import" ariaLabel="Import" onClick={() => fileInputRef.current?.click()}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19V11m0 0l-3 3m3-3l3 3M4 5h16"/></svg>
            </IconButton>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importSettings(e.target.files[0])} />
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>Reset</Button>
          </div>
        </div>
        <Card className="glass-panel mb-6">
          <CardBody>
            <Typography variant="h6" className="text-primary">General</Typography>
            <p className="text-sm text-textMuted">Simplified settings</p>
          </CardBody>
        </Card>

        

        {/* Notifications */}
        <Card className="glass-panel mb-6">
          <CardBody className="grid gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/30 to-accent/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6v-4"/></svg>
              </div>
              <Typography variant="h6" className="text-primary">Notifications</Typography>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SettingRow
                icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 5l-11 11-3-3L2 19l4-6 3 3L21 4z"/></svg>}
                title="Email alerts"
                desc="Receive updates via email"
                right={<Switch color="green" checked={settings.notifications.email} onChange={() => saveSettings({ notifications: { ...settings.notifications, email: !settings.notifications.email } })} />}
              />
              <SettingRow
                icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 20h8"/></svg>}
                title="Desktop alerts"
                desc="Show system notifications"
                right={<Switch color="green" checked={settings.notifications.desktop} onChange={() => saveSettings({ notifications: { ...settings.notifications, desktop: !settings.notifications.desktop } })} />}
              />
              <SettingRow
                icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10v4l4-2-4-2zm7-1h8l3-3v12l-3-3h-8V9z"/></svg>}
                title="Sound"
                desc="Play a chime for events"
                right={<Switch color="green" checked={settings.notifications.sound} onChange={() => saveSettings({ notifications: { ...settings.notifications, sound: !settings.notifications.sound } })} />}
              />
            </div>
          </CardBody>
        </Card>

        {/* Locale */}
        <Card className="glass-panel mb-6">
          <CardBody className="grid gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/30 to-accent/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v8m-4-4h8"/></svg>
              </div>
              <Typography variant="h6" className="text-primary">Locale</Typography>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SettingRow
                icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M2 12h20"/></svg>}
                title="Language"
                desc="Interface language"
                right={(
                  <select value={settings.language} onChange={(e) => saveSettings({ language: e.target.value })} className="w-40 rounded-lg border border-borderLight px-3 py-2">
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="fr-FR">Français</option>
                    <option value="es-ES">Español</option>
                  </select>
                )}
              />
              <SettingRow
                icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="6"/><path d="M12 6v6l4 2"/></svg>}
                title="Timezone"
                desc="Date/time display"
                right={(
                  <select value={settings.timezone} onChange={(e) => saveSettings({ timezone: e.target.value })} className="w-56 rounded-lg border border-borderLight px-3 py-2">
                    {[
                      "UTC",
                      "America/Los_Angeles",
                      "America/New_York",
                      "Europe/London",
                      "Europe/Paris",
                      "Asia/Kolkata",
                      "Asia/Singapore",
                    ].map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
                  </select>
                )}
              />
            </div>
          </CardBody>
        </Card>

        {/* Confirm Reset */}
        {confirmReset && (
          <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset Settings" confirmText="Reset" onConfirm={resetSettings} variant="modern">
            <p className="text-text">This will revert all preferences to defaults. You can export settings first if needed.</p>
          </Modal>
        )}
      </div>
    </div>
  );
}
  // Inline helper: consistent row with icon, title, description, and control
  const SettingRow = ({ icon, title, desc, right }) => (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-borderLight bg-white/70 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-text">{title}</p>
          {desc && <p className="text-sm text-textMuted">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
