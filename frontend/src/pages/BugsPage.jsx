// src/pages/BugsPage.jsx
import { useEffect, useState, useMemo } from "react";
import { Card, CardBody, Typography, Input } from "@material-tailwind/react";
import { supabase } from "../supabaseClient";
import FormField from "../components/FormField";
import SearchableSelect from "../components/SearchableSelect";
import BackButton from "../components/BackButton";

/* PrimaryButton kept local to avoid touching other files */
function PrimaryButton({ children, ...rest }) {
  return (
    <button
      {...rest}
      className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-semibold shadow-lg
                 bg-gradient-to-br from-green-700 to-emerald-600 hover:from-green-800 hover:to-emerald-700
                 transition transform active:scale-95 whitespace-nowrap"
    >
      {children}
    </button>
  );
}

/*
  API helpers: try several base urls (including relative) to be tolerant to dev/prod setups
*/
const API_BASE_CANDIDATES = (() => {
  const list = [];
  // prioritize direct backend ports to avoid proxy 404s
  list.push("http://127.0.0.1:8000");
  list.push("http://localhost:8000");
  try {
    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol && window.location.protocol.startsWith("https") ? "https" : "http";
    list.push(`${protocol}://${host}:8000`);
  } catch (e) {}
  return Array.from(new Set(list));
})();

const fetchJsonWithFallback = async (path, options = {}) => {
  let lastErr = null;
  for (const base of API_BASE_CANDIDATES) {
    const url = `${base}${path}`;
    try {
      // For FormData (file uploads) do not set Content-Type here (browser will set it)
      const res = await fetch(url, options);
      const text = await res.text();
      // try to parse JSON if possible
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        // not JSON
        json = text;
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} on ${url} — ${JSON.stringify(json)}`);
        // continue trying other bases
        continue;
      }
      return json;
    } catch (err) {
      lastErr = err;
      // try next base
      continue;
    }
  }
  throw lastErr || new Error("Fetch failed for all candidate bases");
};

// normalize rows we receive (handles DB with spaced names or snake_case)
const normalizeBug = (row) => ({
  "Bug ID": row?.["Bug ID"] ?? row?.bug_id ?? row?.id ?? row?.bugid ?? null,
  "Summary": row?.["Summary"] ?? row?.summary ?? row?.title ?? row?.["Component"] ?? row?.component ?? "",
  "Priority": row?.["Priority"] ?? row?.priority ?? row?.severity ?? "",
  "Status": row?.["Status"] ?? row?.status ?? "",
  "Assignee": row?.["Assignee"] ?? row?.assignee ?? row?.assignee_name ?? "",
  "Changed": row?.["Changed"] ?? row?.changed ?? row?.updated_at ?? new Date().toISOString(),
  "Product": row?.["Product"] ?? row?.product ?? row?.["Project"] ?? row?.project ?? "",
});

export default function BugsPage() {
  const [view, setView] = useState("list"); // list | form | details
  const [bugs, setBugs] = useState([]);
  const [selectedBug, setSelectedBug] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState([]); // selected File objects
  const [uploadedFiles, setUploadedFiles] = useState([]); // returned {filename,url}

  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const data = await fetchJsonWithFallback("/api/bugs");
      if (data && data.status === "success") {
        const arr = Array.isArray(data.data) ? data.data : [];
        if (arr.length > 0) {
          const formatted = arr.map(normalizeBug);
          setBugs(formatted);
        } else {
          // Fallback to Supabase directly if API returns empty
          const tables = ["bugs", "Bugs_file", "bugs_file"];
          let fetched = [];
          for (const t of tables) {
            try {
              const resp = await supabase.from(t).select("*").order("Changed", { ascending: false });
              if (resp?.data && resp.data.length) { fetched = resp.data; break; }
            } catch {}
          }
          setBugs((fetched || []).map(normalizeBug));
        }
        } else {
          const tables = ["bugs", "Bugs_file", "bugs_file"];
          let fetched = [];
          for (const t of tables) {
            try {
              const resp = await supabase.from(t).select("*").limit(2000);
              if (resp?.data && resp.data.length) { fetched = resp.data; break; }
            } catch {}
          }
          setBugs((fetched || []).map(normalizeBug));
        }
    } catch (err) {
      const tables = ["bugs", "Bugs_file", "bugs_file"];
      let fetched = [];
      for (const t of tables) {
        try {
          const resp = await supabase.from(t).select("*").limit(2000);
          if (resp?.data && resp.data.length) { fetched = resp.data; break; }
        } catch {}
      }
      setBugs((fetched || []).map(normalizeBug));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const handleChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  };

  const uploadAttachments = async (bugId, filesArray) => {
    if (!filesArray || filesArray.length === 0) return [];
    try {
      const formData = new FormData();
      filesArray.forEach((f) => formData.append("files", f, f.name));
      // use fetchJsonWithFallback which attempts multiple bases
      const data = await fetchJsonWithFallback(`/api/bugs/${bugId}/attachments`, {
        method: "POST",
        body: formData,
      });
      // data expected: {status:"success", files:[{filename,url},...]}
      if (!data || data.status !== "success") {
        console.warn("Attachment upload returned:", data);
        return [];
      }
      return data.files || [];
    } catch (err) {
      console.error("Attachment upload error:", err);
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Auto-generate ID
    const bugId = Date.now();

    // Build payload
    const payload = {
      ...form,
      "Bug ID": bugId,
      "Changed": new Date().toISOString(),
    };

    try {
      // 1) Create bug
      const result = await fetchJsonWithFallback("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!result || result.status !== "success") {
        const msg = result?.detail || JSON.stringify(result);
        alert("Failed to create bug: " + msg);
        setLoading(false);
        return;
      }

      // If server returned record(s), add first to UI immediately (optimistic)
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const created = normalizeBug(result.data[0]);
        setBugs((prev) => [created, ...prev]);
      }

      // 2) Upload attachments (if any)
      let uploaded = [];
      if (files && files.length > 0) {
        uploaded = await uploadAttachments(bugId, files);
        setUploadedFiles(uploaded);
      }

      // 3) Refresh list from server to ensure consistent state
      await fetchBugs();
      setFiles([]);
      setForm({});
      setView("list");
      alert("✅ Bug created successfully");
    } catch (err) {
      console.error("Submit error:", err);
      alert("Network/server error while creating bug (check console)");
    } finally {
      setLoading(false);
    }
  };

  // Search + pagination:
  const filteredBugs = useMemo(() => {
    const lower = (s) => String(s || "").toLowerCase();
    const filtered = bugs.filter((b) =>
      lower(b["Summary"]).includes(lower(search)) ||
      lower(b["Product"]).includes(lower(search)) ||
      lower(b["Assignee"]).includes(lower(search)) ||
      String(b["Bug ID"]).includes(search)
    );
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [bugs, search, page]);

  const totalPages = Math.max(1, Math.ceil(
    bugs.filter((b) =>
      (String(b["Summary"] || "") + " " + String(b["Product"] || "") + " " + String(b["Assignee"] || "")).toLowerCase().includes(search.toLowerCase())
      || String(b["Bug ID"] || "").includes(search)
    ).length / itemsPerPage
  ));

  // ---------- RENDER HELPERS ----------
  const renderList = () => (
    <div>
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-8">
        <div>
          <Typography variant="h4" className="text-primary font-bold flex items-center gap-2">
            🪲 Bug Tracker
          </Typography>
          <p className="text-textMuted text-sm mt-1">Manage and track all identified issues</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              type="text"
              placeholder="Search bugs, product, assignee..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="!pl-10 !rounded-lg !border-borderLight focus:!border-accent"
              containerProps={{ className: "min-w-0" }}
            />
          </div>
          <PrimaryButton onClick={() => { setForm({}); setUploadedFiles([]); setView("form"); }} className="bg-gradient-to-r from-accent to-accentLight hover:from-accentDark hover:to-accent shadow-lg hover:shadow-xl">
            + Create Bug
          </PrimaryButton>
        </div>
      </div>

      <Card className="glass-panel overflow-hidden">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary/95 to-primaryLight/95 text-white">
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider">Bug ID</th>
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider">Summary</th>
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left font-semibold uppercase text-xs tracking-wider">Assignee</th>
                  <th className="px-6 py-4 text-right font-semibold uppercase text-xs tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <div className="text-center">
                        <Typography className="text-textMuted">No bugs found</Typography>
                        <p className="text-xs text-textMuted/60 mt-1">Create your first bug to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBugs.map((b) => (
                    <tr key={`${b["Bug ID"]}_${b["Changed"]}`} className="border-b border-borderLight/60 hover:bg-gradient-to-r hover:from-accent/5 hover:to-accent/3 transition-all duration-200">
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-primary">{b["Bug ID"]}</td>
                      <td className="px-6 py-4 max-w-2xl text-text font-medium truncate" title={b["Summary"]}>{b["Summary"]}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${
                          b["Priority"] === "Critical" ? "bg-rose-100 text-rose-700" :
                          b["Priority"] === "High" ? "bg-orange-100 text-orange-700" :
                          b["Priority"] === "Medium" ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {b["Priority"] || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${
                          b["Status"] === "OPEN" ? "bg-red-100 text-red-700" :
                          b["Status"] === "IN PROGRESS" ? "bg-blue-100 text-blue-700" :
                          b["Status"] === "RESOLVED" ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {b["Status"] || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text">{b["Assignee"] || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => { setSelectedBug(b); setView("details"); }} 
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all text-sm font-medium"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-borderLight/60 bg-gradient-to-r from-white/50 to-accent/5">
            <div className="text-sm text-textMuted font-medium">
              Showing {filteredBugs.length ? (page - 1) * itemsPerPage + 1 : 0} - {Math.min(page * itemsPerPage, bugs.length)} of {bugs.length} bugs
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
              <button 
                disabled={page <= 1} 
                onClick={() => setPage(1)} 
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                First
              </button>
              <button 
                disabled={page <= 1} 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Prev
              </button>
              <div className="px-4 py-2 bg-primary/10 rounded-lg text-primary font-bold text-sm">{page} / {totalPages}</div>
              <button 
                disabled={page >= totalPages} 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Next
              </button>
              <button 
                disabled={page >= totalPages} 
                onClick={() => setPage(totalPages)} 
                className="px-3 py-2 rounded-lg border border-borderLight bg-white text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Last
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  const renderForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Typography variant="h4" className="text-primary font-bold flex items-center gap-2">
            📝 Create New Bug
          </Typography>
          <p className="text-textMuted text-sm mt-1">Capture details with smart dropdowns</p>
        </div>
        <BackButton label="Back to List" />
      </div>

      <Card className="glass-panel">
        <CardBody className="p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SearchableSelect label="Defect Type" value={form["Defect type"] || "Functional"} onChange={(v) => handleChange("Defect type", v)} options={[
              {label:"Functional",value:"Functional"},{label:"UI",value:"UI"},{label:"Performance",value:"Performance"},{label:"Security",value:"Security"}
            ]} />
            <FormField label="Summary" value={form["Summary"]||""} onChange={(e)=>handleChange("Summary", e.target.value)} placeholder="Brief description of the bug" />
            <SearchableSelect label="Priority" value={form["Priority"]||"Medium"} onChange={(v)=>handleChange("Priority", v)} options={[
              {label:"Low",value:"Low"},{label:"Medium",value:"Medium"},{label:"High",value:"High"},{label:"Critical",value:"Critical"}
            ]} />
            <FormField label="Product" value={form["Product"]||""} onChange={(e)=>handleChange("Product", e.target.value)} placeholder="Product name" />
            <FormField label="Component" value={form["Component"]||""} onChange={(e)=>handleChange("Component", e.target.value)} placeholder="Component affected" />
            <FormField label="Assignee" value={form["Assignee"]||""} onChange={(e)=>handleChange("Assignee", e.target.value)} placeholder="Team member" />
            <FormField label="Assignee Real Name" value={form["Assignee Real Name"]||""} onChange={(e)=>handleChange("Assignee Real Name", e.target.value)} placeholder="Full name" />
            <FormField label="Reporter" value={form["Reporter"]||""} onChange={(e)=>handleChange("Reporter", e.target.value)} placeholder="Bug reporter" />
            <SearchableSelect label="Status" value={form["Status"]||"OPEN"} onChange={(v)=>handleChange("Status", v)} options={[
              {label:"OPEN",value:"OPEN"},{label:"IN PROGRESS",value:"IN PROGRESS"},{label:"RESOLVED",value:"RESOLVED"},{label:"CLOSED",value:"CLOSED"}
            ]} />
            <FormField label="Resolution" value={form["Resolution"]||""} onChange={(e)=>handleChange("Resolution", e.target.value)} placeholder="Resolution details" />
            <FormField label="Sprint details" value={form["Sprint details"]||""} onChange={(e)=>handleChange("Sprint details", e.target.value)} placeholder="Sprint info" />
            <SearchableSelect label="Automation Intent" value={form["Automation Intent"]||"No"} onChange={(v)=>handleChange("Automation Intent", v)} options={[
              {label:"Yes",value:"Yes"},{label:"No",value:"No"}
            ]} />
            <FormField label="Automation Owner" value={form["automation_owner"]||""} onChange={(e)=>handleChange("automation_owner", e.target.value)} placeholder="Owner name" />
            <SearchableSelect label="Automation Status" value={form["automation status"]||"Pending"} onChange={(v)=>handleChange("automation status", v)} options={[
              {label:"Pending",value:"Pending"},{label:"Automated",value:"Automated"},{label:"Skipped",value:"Skipped"}
            ]} />
            <SearchableSelect label="Device type" value={form["Device type"]||"Web"} onChange={(v)=>handleChange("Device type", v)} options={[
              {label:"Web",value:"Web"},{label:"Mobile",value:"Mobile"},{label:"Tablet",value:"Tablet"}
            ]} />
            <FormField label="Browser tested" value={form["Browser tested"]||""} onChange={(e)=>handleChange("Browser tested", e.target.value)} placeholder="Browser name" />

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-primary mb-3">📎 Attachments (screenshots, logs)</label>
              <div className="border-2 border-dashed border-borderLight rounded-lg p-6 hover:border-accent hover:bg-accent/5 transition-all cursor-pointer">
                <input 
                  type="file" 
                  multiple 
                  onChange={onFilesChange} 
                  className="block w-full cursor-pointer opacity-0 absolute"
                />
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-textMuted" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-8-12v12m0 0l-4-4m4 4l4-4" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p className="mt-2 text-sm text-textMuted">
                    Drag and drop files or <span className="font-semibold text-accent">click to browse</span>
                  </p>
                </div>
              </div>
              {files.length > 0 && (
                <div className="mt-4 p-4 bg-success/10 rounded-lg border border-success/30">
                  <p className="text-sm font-semibold text-success mb-2">Selected files:</p>
                  <ul className="space-y-1">
                    {files.map((f, i) => <li key={i} className="text-sm text-text">✓ {f.name} ({Math.round(f.size/1024)} KB)</li>)}
                  </ul>
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 p-4 bg-info/10 rounded-lg border border-info/30">
                  <p className="text-sm font-semibold text-info mb-2">Uploaded:</p>
                  <ul className="space-y-1">
                    {uploadedFiles.map((u,i) => <li key={i}><a href={u.url} target="_blank" rel="noreferrer" className="text-sm text-info hover:underline">📎 {u.filename}</a></li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="col-span-2 flex justify-end gap-3 mt-6 pt-6 border-t border-borderLight">
              <button type="button" onClick={() => setView("list")} className="px-6 py-2.5 rounded-lg border-2 border-borderLight text-text hover:bg-backgroundAlt font-medium transition-all">
                Cancel
              </button>
              <PrimaryButton type="submit" className="bg-gradient-to-r from-accent to-accentLight hover:from-accentDark hover:to-accent shadow-lg hover:shadow-xl">
                {loading ? "Saving..." : "✓ Save Bug"}
              </PrimaryButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  const renderDetails = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Typography variant="h4" className="text-primary font-bold flex items-center gap-2">
            🔍 Bug Details
          </Typography>
          <p className="text-textMuted text-sm mt-1">Bug ID: <span className="font-mono font-semibold text-primary">{selectedBug?.["Bug ID"]}</span></p>
        </div>
        <button 
          onClick={() => setView("list")} 
          className="px-4 py-2 rounded-lg border-2 border-borderLight text-text hover:bg-backgroundAlt font-medium transition-all"
        >
          ← Back
        </button>
      </div>

      {selectedBug ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Card className="glass-panel">
              <CardBody className="space-y-6">
                {/* Summary */}
                <div>
                  <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2">Summary</Typography>
                  <Typography className="text-lg font-semibold text-text">{selectedBug["Summary"] || "N/A"}</Typography>
                </div>

                {/* Grid of key info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2">Priority</Typography>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${
                      selectedBug["Priority"] === "Critical" ? "bg-rose-100 text-rose-700" :
                      selectedBug["Priority"] === "High" ? "bg-orange-100 text-orange-700" :
                      selectedBug["Priority"] === "Medium" ? "bg-amber-100 text-amber-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {selectedBug["Priority"] || "-"}
                    </span>
                  </div>
                  <div>
                    <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-2">Status</Typography>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-bold ${
                      selectedBug["Status"] === "OPEN" ? "bg-red-100 text-red-700" :
                      selectedBug["Status"] === "IN PROGRESS" ? "bg-blue-100 text-blue-700" :
                      selectedBug["Status"] === "RESOLVED" ? "bg-yellow-100 text-yellow-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {selectedBug["Status"] || "-"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-borderLight/60 pt-6 grid grid-cols-2 gap-6">
                  {Object.keys(selectedBug).map((k) => 
                    k !== "Bug ID" && k !== "Summary" && k !== "Priority" && k !== "Status" ? (
                      <div key={k}>
                        <Typography className="text-xs font-bold text-textMuted uppercase tracking-wide mb-1">{k}</Typography>
                        <Typography className="text-sm text-text font-medium break-words">{String(selectedBug[k] ?? "-")}</Typography>
                      </div>
                    ) : null
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Side info panel */}
          <div>
            <Card className="glass-panel">
              <CardBody>
                <Typography className="text-sm font-bold text-primary mb-4 uppercase tracking-wide">Quick Info</Typography>
                <div className="space-y-4">
                  <div className="bg-accent/10 rounded-lg p-3 border border-accent/30">
                    <div className="text-xs text-textMuted font-semibold mb-1">Assignee</div>
                    <div className="text-sm font-bold text-text">{selectedBug["Assignee"] || "Unassigned"}</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 border border-primary/30">
                    <div className="text-xs text-textMuted font-semibold mb-1">Product</div>
                    <div className="text-sm font-bold text-primary">{selectedBug["Product"] || "-"}</div>
                  </div>
                  <div className="bg-info/10 rounded-lg p-3 border border-info/30">
                    <div className="text-xs text-textMuted font-semibold mb-1">Last Updated</div>
                    <div className="text-sm font-bold text-text">{selectedBug["Changed"] ? new Date(selectedBug["Changed"]).toLocaleDateString() : "-"}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (<Typography>No bug selected</Typography>)}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-backgroundAlt to-cardDark">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {view === "list" && renderList()}
          {view === "form" && renderForm()}
          {view === "details" && renderDetails()}
        </div>
      </div>
    </div>
  );
}
