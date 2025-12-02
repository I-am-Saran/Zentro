// src/pages/TestingRequests.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function TestingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [viewRow, setViewRow] = useState(null);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState("");

  const [confirmMode, setConfirmMode] = useState(false); // UI confirmation step

  const [form, setForm] = useState({
    product_project_name: "",
    build_version: "",
    sprint: "",
    testing_scope: "",
    unit_test_document: "",
    bugs_fixed: "",
    stories_delivered: "",
    tech_lead: "",
    tech_manager: "",
    environment_url: "",
    // user-id based fields
    qa_manager_id: "",
    qa_lead_id: "",
    qa_spoc_id: "",
  });

  // Auto-hide success toasts after a few seconds
  useEffect(() => {
    if (!statusMsg) return;
    if (statusMsg.startsWith("✅")) {
      const t = setTimeout(() => setStatusMsg(""), 4000);
      return () => clearTimeout(t);
    }
  }, [statusMsg]);

  // Fetch all requests
  const fetchRequests = async () => {
    setLoading(true);
    setStatusMsg("");
    try {
      const { data, error } = await supabase
        .from("testing_requests")
        .select(
          `id, product_project_name, build_version, sprint, testing_scope,
           unit_test_document, bugs_fixed, stories_delivered, tech_lead,
           tech_manager, environment_url,
           qa_manager_id, qa_lead_id, qa_spoc_id,
           created_by_id, created_at`
        )
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Fetch error:", error);
        setStatusMsg(`❌ Fetch error: ${error.message}`);
        setRequests([]);
      } else {
        setRequests(data || []);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Unexpected fetch error");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // File selection & upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setUploadProgress(0);
    setUploadedFileName(file.name);
    setStatusMsg("Uploading document...");

    try {
      const ext = file.name.split(".").pop();
      const path = `unit_docs/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("testing-requests")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;
      if (!uploadData || !uploadData.path)
        throw new Error("Upload succeeded but no path returned");

      const { data: publicUrlData, error: urlError } = supabase.storage
        .from("testing-requests")
        .getPublicUrl(uploadData.path);

      const publicURL =
        publicUrlData?.publicURL ??
        publicUrlData?.publicUrl ??
        publicUrlData?.data?.publicUrl ??
        publicUrlData;

      if (urlError) throw urlError;
      if (!publicURL) {
        console.warn("No public URL returned; using path as fallback");
        setForm((p) => ({ ...p, unit_test_document: uploadData.path }));
      } else {
        setForm((p) => ({ ...p, unit_test_document: publicURL }));
      }

      setStatusMsg("✅ Document uploaded");
      setUploadProgress(100);
    } catch (err) {
      console.error("Upload failed", err);
      setStatusMsg(`❌ Upload failed: ${err?.message || String(err)}`);
      setForm((p) => ({ ...p, unit_test_document: "" }));
      setUploadedFileName("");
      setUploadProgress(0);
    } finally {
      setUploadingFile(false);
    }
  };

  const validateForm = () => {
    if (!form.product_project_name || form.product_project_name.trim() === "") {
      setStatusMsg("❌ Product / Project Name is required.");
      return false;
    }
    // no email validation anymore
    return true;
  };

  // Step 1: user clicks "Send Request" -> validate, then show inline confirmation UI
  const handlePreSubmit = (e) => {
    e?.preventDefault?.();
    if (!validateForm()) return;
    setConfirmMode(true);
  };

  // Step 2: user clicks "Confirm & Send" in confirmation UI
  const handleCreate = async () => {
    setSubmitting(true);
    setStatusMsg("Saving...");

    try {
      const userResult = await supabase.auth.getUser();
      const uid =
        userResult?.data?.user?.id ||
        userResult?.user?.id ||
        userResult?.id ||
        null;

      const payload = {
        product_project_name: form.product_project_name.trim(),
        build_version: form.build_version?.trim() || null,
        sprint: form.sprint?.trim() || null,
        testing_scope: form.testing_scope?.trim() || null,
        unit_test_document: form.unit_test_document || null,
        bugs_fixed:
          form.bugs_fixed === "" || form.bugs_fixed == null
            ? null
            : parseInt(String(form.bugs_fixed), 10),
        stories_delivered:
          form.stories_delivered === "" || form.stories_delivered == null
            ? null
            : parseInt(String(form.stories_delivered), 10),
        tech_lead: form.tech_lead?.trim() || null,
        tech_manager: form.tech_manager?.trim() || null,
        environment_url: form.environment_url?.trim() || null,
        // QA user-id based fields
        qa_manager_id: form.qa_manager_id?.trim() || null,
        qa_lead_id: form.qa_lead_id?.trim() || null,
        qa_spoc_id: form.qa_spoc_id?.trim() || null,
        // meta
        title: form.product_project_name?.trim() || null,
        created_by_id: uid || null,
      };

      console.log("INSERT payload:", payload, "auth uid:", uid);

      const { data, error } = await supabase
        .from("testing_requests")
        .insert([payload])
        .select(
          `id, product_project_name, build_version, sprint, testing_scope,
           unit_test_document, bugs_fixed, stories_delivered, tech_lead,
           tech_manager, environment_url,
           qa_manager_id, qa_lead_id, qa_spoc_id,
           created_by_id, created_at`
        );

      if (error) {
        console.error("Insert error:", error);
        setStatusMsg(`❌ Insert failed: ${error.message}`);
        return;
      }

      setStatusMsg("✅ Request sent Successfully");

      if (data && data.length) {
        const savedRow = data[0];

        // Update table immediately
        setRequests((r) => [savedRow, ...r]);

        // No email sending, no edge function invoke
      } else {
        // fallback: refetch if no row returned
        fetchRequests();
      }

      // Reset form & UI
      setShowCreate(false);
      setConfirmMode(false);
      setUploadedFileName("");
      setUploadProgress(0);
      setForm({
        product_project_name: "",
        build_version: "",
        sprint: "",
        testing_scope: "",
        unit_test_document: "",
        bugs_fixed: "",
        stories_delivered: "",
        tech_lead: "",
        tech_manager: "",
        environment_url: "",
        qa_manager_id: "",
        qa_lead_id: "",
        qa_spoc_id: "",
      });
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts);
    }
  };

  const fileNameFromUrl = (url) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      const p = u.pathname.split("/").pop();
      return decodeURIComponent(p || u.hostname);
    } catch {
      return url;
    }
  };

  // Decide toast colors based on message type
  let toastClasses = "bg-blue-100 border-blue-400 text-blue-800";
  if (statusMsg?.startsWith("✅"))
    toastClasses = "bg-green-100 border-green-400 text-green-800";
  else if (statusMsg?.startsWith("❌"))
    toastClasses = "bg-red-100 border-red-400 text-red-800";

  return (
    <div className="min-h-screen p-6">
      {/* Toast */}
      {statusMsg && (
        <div
          className={`fixed top-4 right-4 z-50 border px-4 py-3 rounded-lg shadow ${toastClasses}`}
        >
          <div className="flex items-start gap-2">
            <div className="text-sm">{statusMsg}</div>
            <button
              onClick={() => setStatusMsg("")}
              className="ml-2 text-xs text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Testing Requests
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowCreate(true);
                setStatusMsg("");
                setConfirmMode(false);
              }}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              + New Request
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-gray-800">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left">Product / Project</th>
                <th className="px-3 py-2 text-left">Build Version</th>
                <th className="px-3 py-2 text-left">Sprint</th>
                <th className="px-3 py-2 text-left">Bugs Fixed</th>
                <th className="px-3 py-2 text-left">Stories Delivered</th>
                <th className="px-3 py-2 text-left">Tech Lead</th>
                <th className="px-3 py-2 text-left">Tech Manager</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    Loading…
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{r.product_project_name}</td>
                    <td className="px-3 py-2">{r.build_version || "—"}</td>
                    <td className="px-3 py-2">{r.sprint || "—"}</td>
                    <td className="px-3 py-2">
                      {r.bugs_fixed != null ? r.bugs_fixed : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.stories_delivered != null
                        ? r.stories_delivered
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{r.tech_lead || "—"}</td>
                    <td className="px-3 py-2">{r.tech_manager || "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setViewRow(r)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View single row modal */}
      {viewRow && (
        <div className="fixed inset-0 z-70 flex items-start justify-center pt-16">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setViewRow(null)}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-lg w-full max-w-3xl z-80 p-0 relative max-h-[85vh] flex flex-col overflow-hidden"
            aria-modal="true"
            role="dialog"
          >
            <div className="px-6 py-4 border-b flex items-center justify-between bg-white">
              <div>
                <h3 className="text-lg font-semibold text-indigo-700">
                  Request Details
                </h3>
                <div className="text-sm text-gray-500">
                  {viewRow.product_project_name}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {formatDate(viewRow.created_at)}
              </div>
            </div>

            <div
              className="p-6 overflow-y-auto"
              style={{ maxHeight: "calc(85vh - 160px)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Field
                    label="Product / Project"
                    value={viewRow.product_project_name}
                  />
                  <Field label="Build Version" value={viewRow.build_version} />
                  <Field label="Sprint" value={viewRow.sprint} />
                  <Field
                    label="Testing Scope"
                    value={viewRow.testing_scope}
                    multiline
                  />
                  <Field label="Tech Lead" value={viewRow.tech_lead} />
                  <Field label="Tech Manager" value={viewRow.tech_manager} />
                  <Field
                    label="Environment URL"
                    value={viewRow.environment_url}
                    link
                  />
                </div>

                <div className="space-y-3">
                  <Field
                    label="No. of Bugs Fixed"
                    value={
                      viewRow.bugs_fixed != null
                        ? String(viewRow.bugs_fixed)
                        : "—"
                    }
                  />
                  <Field
                    label="Stories Delivered"
                    value={
                      viewRow.stories_delivered != null
                        ? String(viewRow.stories_delivered)
                        : "—"
                    }
                  />

                  {/* QA user IDs instead of mails */}
                  <Field
                    label="QA Manager User ID"
                    value={viewRow.qa_manager_id}
                  />
                  <Field label="QA Lead User ID" value={viewRow.qa_lead_id} />
                  <Field label="QA SPOC User ID" value={viewRow.qa_spoc_id} />

                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      Unit Test Document
                    </div>
                    <div className="flex items-center gap-3">
                      {viewRow.unit_test_document ? (
                        <>
                          <div
                            className="text-sm text-gray-900 line-clamp-1 break-all w-40"
                            title={viewRow.unit_test_document}
                          >
                            {fileNameFromUrl(viewRow.unit_test_document)}
                          </div>
                          <a
                            href={viewRow.unit_test_document}
                            download
                            className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm border"
                          >
                            Download
                          </a>
                        </>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-3 bg-white flex justify-between items-center">
              <div className="text-xs text-gray-500">
                ID: hidden for security
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewRow(null)}
                  className="px-4 py-2 bg-gray-100 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-60 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              setShowCreate(false);
              setConfirmMode(false);
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-lg w-full max-w-lg z-70 p-0 relative max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">New Testing Request</h3>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setConfirmMode(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div
              className="p-6 overflow-y-auto"
              style={{ maxHeight: "calc(80vh - 170px)" }}
            >
              <form
                id="testing-request-form"
                onSubmit={(e) => e.preventDefault()}
                className="space-y-3"
              >
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Product / Project Name *
                  </label>
                  <input
                    name="product_project_name"
                    value={form.product_project_name}
                    onChange={handleChange}
                    className="w-full border p-2 rounded mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Build Version
                    </label>
                    <input
                      name="build_version"
                      value={form.build_version}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Sprint
                    </label>
                    <input
                      name="sprint"
                      value={form.sprint}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Testing Scope
                  </label>
                  <textarea
                    name="testing_scope"
                    value={form.testing_scope}
                    onChange={handleChange}
                    rows={3}
                    className="w-full border p-2 rounded mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Unit Test Document
                  </label>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      id="unitDoc"
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.txt"
                      onChange={handleFileSelect}
                      className="block"
                    />
                    {uploadingFile && (
                      <div className="text-sm text-gray-600">
                        Uploading... {uploadProgress}%
                      </div>
                    )}
                    {!uploadingFile && uploadedFileName && (
                      <div className="text-sm text-gray-600">
                        Uploaded: {uploadedFileName}
                      </div>
                    )}
                    {!uploadingFile &&
                      form.unit_test_document &&
                      !uploadedFileName && (
                        <div className="text-sm text-gray-600">
                          Document ready
                        </div>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      No. of Bugs Fixed
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="bugs_fixed"
                      value={form.bugs_fixed}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Stories Delivered
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="stories_delivered"
                      value={form.stories_delivered}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Tech Lead
                    </label>
                    <input
                      name="tech_lead"
                      value={form.tech_lead}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Tech Manager
                    </label>
                    <input
                      name="tech_manager"
                      value={form.tech_manager}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Environment URL
                  </label>
                  <input
                    name="environment_url"
                    value={form.environment_url}
                    onChange={handleChange}
                    className="w-full border p-2 rounded mt-1"
                  />
                </div>

                {/* QA user-id based fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      QA Manager User ID
                    </label>
                    <input
                      name="qa_manager_id"
                      value={form.qa_manager_id}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                      placeholder="UUID / user id"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      QA Lead User ID
                    </label>
                    <input
                      name="qa_lead_id"
                      value={form.qa_lead_id}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                      placeholder="UUID / user id"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      QA SPOC User ID
                    </label>
                    <input
                      name="qa_spoc_id"
                      value={form.qa_spoc_id}
                      onChange={handleChange}
                      className="w-full border p-2 rounded mt-1"
                      placeholder="UUID / user id"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer with inline confirmation UI */}
            <div className="border-t px-6 py-4 bg-white flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setConfirmMode(false);
                }}
                className="px-4 py-2 bg-gray-100 rounded"
              >
                Cancel
              </button>

              {!confirmMode ? (
                <button
                  type="button"
                  onClick={handlePreSubmit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  Send Request
                </button>
              ) : (
                <div className="flex-1 md:flex md:items-center md:justify-end md:gap-3">
                  <div className="text-xs text-gray-600 mb-2 md:mb-0 max-w-xs text-left md:text-right">
                    Once you send the request you can&apos;t edit it. Please
                    review all details before confirming.
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmMode(false)}
                      className="px-4 py-2 bg-gray-100 rounded text-sm"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={submitting}
                      className="px-4 py-2 bg-red-600 text-white rounded text-sm"
                    >
                      {submitting ? "Sending..." : "Confirm & Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, multiline = false, link = false }) {
  if (link) {
    return (
      <div>
        <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
        {value ? (
          <a
            className="text-indigo-600 underline break-all"
            href={value}
            target="_blank"
            rel="noreferrer"
          >
            {value}
          </a>
        ) : (
          <div className="text-gray-600">—</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-1">{label}</div>
      <div
        className={`w-full border rounded p-2 bg-gray-50 text-gray-900 ${
          multiline ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
