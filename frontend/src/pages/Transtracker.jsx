// src/pages/Transtracker.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

/**
 * Transtracker.jsx — adapted to the provided schema.
 * Assumes DB generates `id` (uuid DEFAULT gen_random_uuid()) so client does not send id.
 */

export default function Transtracker() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [editRowId, setEditRowId] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);

  const [selectedSet, setSelectedSet] = useState(new Set());
  const [showValidationPrompt, setShowValidationPrompt] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const pad2 = (n) => String(n).padStart(2, "0");
  const normalizeDate = (val) => {
    if (!val) return null;
    if (typeof val === "string" && val.includes("T")) return val.slice(0, 10);
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  })();

  // initial form matches schema column names
  const initialForm = {
    applicationtype: "",
    productsegregated: "",
    productowner: "",
    spoc: "",
    projects_products: "",
    buildnumber: "",
    buildreceiveddate: "",
    year: "",
    monthname: "",
    quarternumber: "",
    monthnumber: "",
    weeknumber: "",
    dayname: "",
    y_q: "",
    y_q_m_w: "",
    m_y: "",
    buildreceivedtime: "",
    buildmailfrom: "",
    maildetails: "",
    testreportsentdate: "",
    testreportsenttime: "",
    testreportsentby: "",
    signoffstatus: "",
    signoffrationale: "",
    totalopenbugs: "",
    blocker: "",
    high: "",
    med: "",
    low: "",
    sit: "",
    sitactualhours: "",
    pt: "",
    ptactualhours: "",
    cbt: "",
    cbtactualhours: "",
    android: "",
    androidactualhours: "",
    ios: "",
    iosactualhours: "",
    securitytesting: "",
    totalttestcases: "",
    automatedtestcases: "",
    manualexecutiontime: "",
    automationexecutiontime: "",
    timesaved: "",
    timesavedpercent: "",
  };
  const [form, setForm] = useState({ ...initialForm });

  // which fields are dates in DB
  const DATE_FIELDS = ["buildreceiveddate", "testreportsentdate"];

  // default field definitions for rendering
  const DEFAULT_FORM_FIELDS = [
    { name: "applicationtype", label: "Application Type", required: true, type: "text" },
    { name: "productsegregated", label: "Product Segregated", type: "text" },
    { name: "productowner", label: "Product Owner", required: true, type: "text" },
    { name: "spoc", label: "SPOC", required: true, type: "text" },
    { name: "projects_products", label: "Projects / Products", type: "text" },
    { name: "buildnumber", label: "Build Number", type: "number" },
    { name: "buildreceiveddate", label: "Build Received Date", required: true, type: "date", max: todayStr },
    { name: "buildreceivedtime", label: "Build Received Time", type: "text" },
    { name: "buildmailfrom", label: "Build Mail From", type: "text" },
    { name: "maildetails", label: "Mail Details", type: "textarea" },
    { name: "testreportsentdate", label: "Test Report Sent Date", type: "date", max: todayStr },
    { name: "testreportsenttime", label: "Test Report Sent Time", type: "text" },
    { name: "testreportsentby", label: "Test Report Sent By", type: "text" },
    { name: "year", label: "Year", type: "number" },
    { name: "monthname", label: "Month Name", type: "text" },
    { name: "quarternumber", label: "Quarter Number", type: "number" },
    { name: "monthnumber", label: "Month Number", type: "number" },
    { name: "weeknumber", label: "Week Number", type: "text" },
    { name: "dayname", label: "Day Name", type: "text" },
    { name: "y_q", label: "Y_Q", type: "text" },
    { name: "y_q_m_w", label: "Y_Q_M_W", type: "text" },
    { name: "m_y", label: "M_Y", type: "text" },
    { name: "signoffstatus", label: "Sign Off Status", required: true, type: "text" },
    { name: "signoffrationale", label: "Sign Off Rationale", type: "textarea" },
    { name: "totalopenbugs", label: "Total Open Bugs", required: true, type: "number" },
    // ints/doubles for numeric fields
    { name: "blocker", label: "Blocker", type: "number" },
    { name: "high", label: "High", type: "number" },
    { name: "med", label: "Med", type: "number" },
    { name: "low", label: "Low", type: "number" },
    { name: "sit", label: "SIT", type: "text" },
    { name: "sitactualhours", label: "SIT (Actual Hours)", type: "number", step: "0.01" },
    { name: "pt", label: "PT", type: "text" },
    { name: "ptactualhours", label: "PT (Actual Hours)", type: "number", step: "0.01" },
    { name: "cbt", label: "CBT", type: "text" },
    { name: "cbtactualhours", label: "CBT (Actual Hours)", type: "number", step: "0.01" },
    { name: "android", label: "Android", type: "text" },
    { name: "androidactualhours", label: "Android (Actual Hours)", type: "number", step: "0.01" },
    { name: "ios", label: "iOS", type: "text" },
    { name: "iosactualhours", label: "iOS (Actual Hours)", type: "number", step: "0.01" },
    { name: "securitytesting", label: "Security Testing", type: "text" },
    { name: "totalttestcases", label: "Total Test Cases", type: "number" },
    { name: "automatedtestcases", label: "Automated Test Cases", type: "number" },
    { name: "manualexecutiontime", label: "Manual Execution Time (Hours)", type: "number", step: "0.01" },
    { name: "automationexecutiontime", label: "Automation Execution Time (Hours)", type: "number", step: "0.01" },
    { name: "timesaved", label: "Time Saved (Hours)", type: "number", step: "0.01" },
    { name: "timesavedpercent", label: "Time Saved (%)", type: "number", step: "0.01" },
  ];

  const [FORM_FIELDS, set_FORM_FIELDS] = useState(DEFAULT_FORM_FIELDS);

  useEffect(() => {
    // (templateMapping override logic could go here)
    // eslint-disable-next-line
  }, [/* templateMapping */]);

  // numericFields used for coercion before insert
  const numericFields = FORM_FIELDS.filter((f) => f.type === "number").map((f) => f.name);

  const renderFormField = (f) => {
    const common = {
      name: f.name,
      value: form[f.name] ?? "",
      onChange: (e) => setForm((p) => ({ ...p, [f.name]: e.target.value })),
      className: "w-full border p-2 rounded",
      ...(f.required ? { required: true } : {}),
    };

    if (f.type === "textarea") {
      return (
        <label key={f.name} className="block col-span-1 md:col-span-2">
          <div className="text-sm font-medium">{f.label}{f.required ? " *" : ""}</div>
          <textarea rows={2} {...common} />
        </label>
      );
    }

    if (f.type === "date") {
      return (
        <label key={f.name} className="block">
          <div className="text-sm font-medium">{f.label}{f.required ? " *" : ""}</div>
          <input {...common} type="date" max={f.max ?? todayStr} />
        </label>
      );
    }

    return (
      <label key={f.name} className="block">
        <div className="text-sm font-medium">{f.label}{f.required ? " *" : ""}</div>
        <input
          {...common}
          type={f.type === "number" ? "number" : "text"}
          step={f.step}
          min={f.type === "number" ? "0" : undefined}
        />
      </label>
    );
  };

  // fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("transtrackers").select("*").order("buildreceiveddate", { ascending: true });
      if (error) {
        console.error("Fetch error:", error);
        setStatusMsg(`❌ Fetch error: ${error.message}`);
        setRows([]);
      } else {
        // normalize dates to yyyy-mm-dd for display
        const stamped = (data || []).map((d, i) => ({
          ...d,
          buildreceiveddate: d.buildreceiveddate ? normalizeDate(d.buildreceiveddate) : null,
          testreportsentdate: d.testreportsentdate ? normalizeDate(d.testreportsentdate) : null,
          __uid: d.id != null ? String(d.id) : `__r_${i}_${Date.now()}`,
        }));
        setRows(stamped);
        setStatusMsg("");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Unexpected fetch error");
      setRows([]);
    } finally {
      setLoading(false);
      setSelectedSet(new Set());
    }
  };

  useEffect(() => {
    fetchData();
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
    // eslint-disable-next-line
  }, []);

  const handleAddClick = () => {
    setForm({ ...initialForm });
    setEditRowId(null);
    setShowAddForm(true);
    setStatusMsg("");
    setSelectedSet(new Set());
  };

  const toggleMenu = (e, uid) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160, menuHeight = 120, padding = 8;
    let top = rect.bottom + 6, left = rect.right - menuWidth;
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding;
    if (top + menuHeight > window.innerHeight - padding) top = Math.max(padding, rect.top - menuHeight - 6);
    if (openMenuId === uid) { setOpenMenuId(null); setMenuPosition(null); } else { setOpenMenuId(uid); setMenuPosition({ left, top }); }
  };

  const renderCell = (val) => {
    if (val === null || val === undefined || val === "") return "—";
    if (typeof val === "string" && val.includes("T")) return val.slice(0, 10);
    return String(val);
  };

  const toggleSelect = (uid) =>
    setSelectedSet((prev) => {
      const copy = new Set(prev);
      if (copy.has(uid)) copy.delete(uid);
      else copy.add(uid);
      return copy;
    });

  const toggleSelectAll = () => {
    setSelectedSet((prev) => {
      const all = rows.map((r) => r.__uid);
      if (prev.size === all.length && all.length > 0) return new Set();
      return new Set(all);
    });
  };

  const validateRequired = (payload) => {
    const required = ["applicationtype", "productowner", "spoc", "buildreceiveddate", "signoffstatus", "totalopenbugs"];
    for (const r of required) {
      const v = payload[r];
      if (v === null || v === undefined) return { ok: false, field: r };
      if (typeof v === "string" && v.trim() === "") return { ok: false, field: r };
    }
    return { ok: true };
  };

  const htmlTagRegex = /<[^>]+>/i;
  const validateNoNegativeOrHtml = (frm) => {
    const negatives = [], htmlFields = [];
    for (const k of numericFields) {
      const v = frm[k];
      if (v === "" || v === null || v === undefined) continue;
      const n = Number(v);
      if (!Number.isNaN(n) && n < 0) negatives.push(k);
    }
    for (const [k, v] of Object.entries(frm)) {
      if (v === "" || v === null || v === undefined) continue;
      if (typeof v === "string" && htmlTagRegex.test(v)) htmlFields.push(k);
    }
    return { negatives, htmlFields };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setStatusMsg("Saving...");

    const { negatives, htmlFields } = validateNoNegativeOrHtml(form);
    if (negatives.length || htmlFields.length) {
      const parts = [];
      if (negatives.length) parts.push("negative numbers in: " + negatives.join(", "));
      if (htmlFields.length) parts.push("HTML tags detected in: " + htmlFields.join(", "));
      const msg = `Invalid input detected — please remove ${parts.join(" and ")} before saving.`;
      setValidationMessage(msg); setShowValidationPrompt(true); setStatusMsg(`❌ ${msg}`);
      return;
    }

    // Check future dates
    const future = [];
    for (const f of DATE_FIELDS) {
      const v = form[f];
      if (!v) continue;
      const norm = normalizeDate(v);
      if (!norm) continue;
      if (norm > todayStr) future.push(f);
    }
    if (future.length) {
      const prettyMap = { buildreceiveddate: "Build Received Date", testreportsentdate: "Test Report Sent Date" };
      const pretty = future.map((f) => prettyMap[f] || f);
      const msg = `Date cannot be in the future: ${pretty.join(", ")}`;
      setValidationMessage(msg); setShowValidationPrompt(true); setStatusMsg(`❌ ${msg}`);
      return;
    }

    // prepare payload: normalize dates + coerce numbers (ints and doubles)
    const payload = { ...form };
    payload.buildreceiveddate = normalizeDate(form.buildreceiveddate);
    payload.testreportsentdate = normalizeDate(form.testreportsentdate);

    for (const k of numericFields) {
      const v = form[k];
      if (v === "" || v === null || v === undefined) {
        payload[k] = null;
      } else {
        // choose integer or float depending on field definition in DEFAULT_FORM_FIELDS
        const def = DEFAULT_FORM_FIELDS.find((x) => x.name === k);
        if (def && def.step) {
          payload[k] = parseFloat(String(v));
        } else {
          // attempt integer first
          if (Number.isInteger(Number(v))) payload[k] = parseInt(String(v), 10);
          else payload[k] = parseFloat(String(v));
        }
      }
    }

    const vr = validateRequired(payload);
    if (!vr.ok) {
      const friendly = {
        applicationtype: "Application Type",
        productowner: "Product Owner",
        spoc: "SPOC",
        buildreceiveddate: "Build Received Date",
        signoffstatus: "Sign Off Status",
        totalopenbugs: "Total Open Bugs",
      }[vr.field] || vr.field;
      setStatusMsg(`❌ ${friendly} is required`);
      try { const el = document.querySelector(`[name="${vr.field}"]`); if (el && el.focus) el.focus(); } catch { }
      return;
    }

    try {
      if (editRowId) {
        const { data, error } = await supabase.from("transtrackers").update(payload).eq("id", editRowId).select();
        if (error) { setStatusMsg(`❌ Update failed: ${error.message}`); console.error(error); }
        else { setStatusMsg("✅ Updated successfully"); setShowAddForm(false); setEditRowId(null); await fetchData(); }
      } else {
        // INSERT: do NOT send id; DB will generate it
        const { data, error } = await supabase.from("transtrackers").insert([payload]).select();
        if (error) { setStatusMsg(`❌ Insert failed: ${error.message}`); console.error(error); }
        else { setStatusMsg("✅ Inserted successfully"); setShowAddForm(false); await fetchData(); }
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to save entry: Unexpected error");
    }
  };

  const initiateDelete = (row) => { setAppToDelete(row); setShowDeleteConfirm(true); setOpenMenuId(null); setMenuPosition(null); };
  const confirmDelete = async () => {
    if (!appToDelete) { setShowDeleteConfirm(false); return; }
    setStatusMsg("Deleting...");
    try {
      const { error } = await supabase.from("transtrackers").delete().eq("id", appToDelete.id);
      if (error) setStatusMsg(`❌ Delete failed: ${error.message}`);
      else { setStatusMsg("✅ Deleted"); await fetchData(); }
    } catch (err) { console.error(err); setStatusMsg("❌ Delete failed"); }
    finally { setShowDeleteConfirm(false); setAppToDelete(null); }
  };

  const openEdit = (row) => {
    const populated = { ...initialForm, ...row };
    populated.buildreceiveddate = row.buildreceiveddate ? normalizeDate(row.buildreceiveddate) : "";
    populated.testreportsentdate = row.testreportsentdate ? normalizeDate(row.testreportsentdate) : "";
    setForm(populated);
    setEditRowId(row.id);
    setShowAddForm(true);
    setSelectedSet(new Set());
    setOpenMenuId(null);
    setMenuPosition(null);
  };
  const openViewModal = (row) => { setViewRow(row); setShowView(true); setSelectedSet(new Set()); setOpenMenuId(null); setMenuPosition(null); };

  // small UI components (ViewModal / ConfirmModal)
  const ViewModal = ({ row, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded p-4 shadow-lg w-full max-w-3xl z-50 overflow-auto max-h-[80vh]">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-indigo-700">View Record</h3>
          <button onClick={onClose} className="text-xl text-red-500">✕</button>
        </div>

        {/* Render fields in same order/style as add form, hide id/__uid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {FORM_FIELDS.map((f) => (
            <div key={f.name} className="flex flex-col">
              {/* label on top — matches add/edit label style */}
              <div className="text-sm font-medium text-gray-700 mb-1">{f.label}{f.required ? " *" : ""}</div>

              {/* value rendered in an input-like box so label/value are visually distinct */}
              <div className="w-full border rounded p-2 bg-gray-50 text-gray-900">
                {renderCell(row?.[f.name])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ConfirmModal = ({ title = "Confirm", children, onCancel, onConfirm }) => (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-red-600">{title}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 text-xl">×</button>
        </div>
        <div className="text-gray-700 mb-6">{children}</div>
        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold">Transtracker</h1>
            {!showAddForm && !showView && (
              <div className="text-sm text-gray-600">Selected: <span className="font-medium">{selectedSet.size}</span></div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleAddClick} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">+ Add</button>
            {!showAddForm && (
              <button onClick={toggleSelectAll} className="bg-blue-100 border px-3 py-2 rounded hover:bg-blue-200 text-sm">
                {rows.length > 0 && selectedSet.size === rows.length ? "Unselect All" : "Select All"}
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/transtracker/upload")}
                className="px-3 py-2 border rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-sm font-medium"
              >
                Go to Uploads
              </button>
            </div>
          </div>
        </div>

        {statusMsg && <div className="mb-3 text-sm">{statusMsg}</div>}

        {loading ? (
          <p>Loading…</p>
        ) : (
          <>
            {!showAddForm && (
              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <table className="min-w-full text-sm text-gray-800">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      <th className="px-3 py-2 text-left">Select</th>
                      <th className="px-3 py-2 text-left">APPLICATION TYPE</th>
                      <th className="px-3 py-2 text-left">PRODUCT SEGREGATED</th>
                      <th className="px-3 py-2 text-left">PRODUCT OWNER</th>
                      <th className="px-3 py-2 text-left">SPOC</th>
                      <th className="px-3 py-2 text-left">BUILD RECEIVED DATE</th>
                      <th className="px-3 py-2 text-left">REPORT SENT DATE</th>
                      <th className="px-3 py-2 text-left">SIGN OFF STATUS</th>
                      <th className="px-3 py-2 text-left">TOTAL OPEN BUGS</th>
                      <th className="px-3 py-2 text-left">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-600">No records found</td></tr>
                    ) : rows.map((r) => (
                      <tr key={r.__uid} className="border-b border-neutral-200 hover:bg-neutral-50">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedSet.has(r.__uid)} onChange={() => toggleSelect(r.__uid)} aria-label="Select row" />
                        </td>
                        <td className="px-3 py-2">{renderCell(r.applicationtype)}</td>
                        <td className="px-3 py-2">{renderCell(r.productsegregated)}</td>
                        <td className="px-3 py-2">{renderCell(r.productowner)}</td>
                        <td className="px-3 py-2">{renderCell(r.spoc)}</td>
                        <td className="px-3 py-2">{renderCell(r.buildreceiveddate)}</td>
                        <td className="px-3 py-2">{renderCell(r.testreportsentdate)}</td>
                        <td className="px-3 py-2">{renderCell(r.signoffstatus)}</td>
                        <td className="px-3 py-2">{renderCell(r.totalopenbugs)}</td>
                        <td className="px-3 py-2 relative">
                          <button type="button" onClick={(e) => toggleMenu(e, r.__uid)} className="px-2 py-1 border rounded">☰</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {showAddForm && (
              <div className="mt-6 bg-white p-4 rounded shadow">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">{editRowId ? "Edit Record" : "Create New Record"}</h2>
                  <button onClick={() => { setShowAddForm(false); setEditRowId(null); setForm({ ...initialForm }); setStatusMsg(""); }} className="text-xl text-red-500 font-bold">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FORM_FIELDS.map(renderFormField)}
                  <div className="col-span-1 md:col-span-2 flex justify-end gap-2 mt-3">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
                    <button type="button" onClick={() => { setShowAddForm(false); setEditRowId(null); setForm({ ...initialForm }); setStatusMsg(""); }} className="bg-gray-100 px-4 py-2 rounded">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {showView && viewRow && <ViewModal row={viewRow} onClose={() => setShowView(false)} />}

            {openMenuId && menuPosition && (
              <div ref={menuRef} style={{ position: "fixed", left: `${menuPosition.left}px`, top: `${menuPosition.top}px`, width: 160, zIndex: 99999 }}>
                <div className="bg-white border rounded shadow overflow-auto" style={{ maxHeight: 220 }}>
                  {(() => {
                    const row = rows.find((rr) => rr.__uid === openMenuId);
                    if (!row) return null;
                    return (
                      <>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => openViewModal(row)}>View</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => openEdit(row)}>Edit</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600" onClick={() => initiateDelete(row)}>Delete</button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {showDeleteConfirm && appToDelete && (
              <ConfirmModal
                title="Confirm Delete"
                onCancel={() => { setShowDeleteConfirm(false); setAppToDelete(null); }}
                onConfirm={confirmDelete}
              >
                Are you sure you want to delete the Record <span className="font-semibold text-indigo-700">{appToDelete.productsegregated || appToDelete.applicationtype}</span>?
              </ConfirmModal>
            )}

            {showValidationPrompt && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold">Invalid Input</h3>
                    <button onClick={() => { setShowValidationPrompt(false); setValidationMessage(""); }} className="text-gray-400 hover:text-gray-700">×</button>
                  </div>
                  <div className="mt-3 text-sm text-gray-700">{validationMessage}</div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => { setShowValidationPrompt(false); setValidationMessage(""); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
