// src/pages/UsersPage.jsx
import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import GlossyButton from "../components/GlossyButton";
import Toast from "../components/Toast";
import Modal from "../components/Modal";
import Button from "../components/ui/Button";
import FormField from "../components/FormField";
import DataTable from "../components/DataTable";
import { useNavigate } from "react-router-dom";
import { post } from "../services/api";
import BackButton from "../components/BackButton";

export default function UsersPage() {
  const navigate = useNavigate();

  // ============================
  // View Modes
  // ============================
  const [view, setView] = useState("list"); // list | create | invite

  // ============================
  // Shared States
  // ============================
  const [toast, setToast] = useState({ type: "", message: "" });

  // ============================
  // List View
  // ============================
  const [rows, setRows] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetRow, setTargetRow] = useState(null);
  // Remote-first: remove seed merge to avoid dummy flash

  const openConfirm = (row) => {
    setTargetRow(row);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!targetRow) return;
    try {
      const idOrEmail = targetRow.id;
      const res = await fetch(`/api/users/${encodeURIComponent(idOrEmail)}`, { method: "DELETE" });
      const txt = await res.text();
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch {}
      if (!res.ok) throw new Error(json?.detail || json?.message || "Failed to delete user");
      setRows((prev) => prev.filter((r) => r.id !== targetRow.id));
      setToast({ type: "success", message: "User deleted" });
    } catch (err) {
      setToast({ type: "error", message: err.message || "Delete failed" });
    } finally {
      setConfirmOpen(false);
      setTargetRow(null);
    }
  };

  // ============================
  // Fetch users from backend (FastAPI)
  // ============================
  useEffect(() => {
    const controller = new AbortController();
    const loadUsers = async () => {
      try {
        setLoadingRemote(true);
        const res = await fetch(`/api/users`, { signal: controller.signal });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (parseErr) {
          console.error("/api/users returned non-JSON:", text);
        }

        if (res.ok && json?.status === "success" && Array.isArray(json.data)) {
          const mapped = json.data.map((u) => ({
            id: u.id ?? u.sso_user_id ?? u.email,
            name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
            role: u.role ?? "User",
            email: u.email ?? "",
            department: u.department ?? "",
            is_active: u.is_active ?? true,
          }));
          setRows(mapped);
        } else {
          setRows([]);
        }
      } catch (err) {
        setRows([]);
      } finally {
        setLoadingRemote(false);
      }
    };

    loadUsers();

    const interval = setInterval(loadUsers, 15000); // live updates every 15s

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  // ============================
  // Create View
  // ============================
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("QA");
  const [errors, setErrors] = useState({ email: "" });
  const [submitting, setSubmitting] = useState(false);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const emailRef = useRef(null);
  const roleRef = useRef(null);

  const validateUsername = (val) => {
    if (!val) return "Username is required.";
    if (val.trim().length < 3) return "Minimum 3 characters.";
    if (!/^\w+$/.test(val)) return "Use letters, numbers, and underscores only.";
    return "";
  };
  const validatePassword = (val) => {
    if (!val) return "Password is required.";
    if (val.length < 8) return "At least 8 characters.";
    if (!/[A-Z]/.test(val) || !/[0-9]/.test(val) || !/[^A-Za-z0-9]/.test(val))
      return "Include uppercase, number, and special character.";
    return "";
  };
  const validateEmail = (val) => {
    if (!val) return "Mail ID is required.";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) return "Enter a valid email address.";
    return "";
  };
  const validateRole = (val) => {
    if (!val) return "Role is required.";
    const allowed = ["QA", "DEV", "PM", "Others"];
    if (!allowed.includes(val)) return "Choose a valid role.";
    return "";
  };

  const onCreateSubmit = async (e) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    setErrors({ email: eErr });
    if (eErr) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email, role }),
      });
      const bodyText = await res.text();
      let body = null;
      try { body = bodyText ? JSON.parse(bodyText) : null; } catch {}
      if (!res.ok) throw new Error(body?.detail || body?.message || "Failed to create user");
      setToast({ type: "success", message: "User created" });
      setView("list");
      // Reload users
      await (async () => {
        try { await fetch(`/api/users`).then(r => r.json()).then(d => {
          const mapped = (d?.data || []).map((u) => ({
            id: u.id ?? u.sso_user_id ?? u.email,
            name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
            role: u.role ?? "User",
            email: u.email ?? "",
          }));
          setRows(mapped);
        }); } catch {}
      })();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to create user" });
    } finally {
      setSubmitting(false);
    }
  };

  // ============================
  // Invite View
  // ============================
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("Developer");
  const [inviteEmail, setInviteEmail] = useState("");

  const onInviteSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName, role: inviteRole, email: inviteEmail }),
      });
      const bodyText = await res.text();
      let body = null;
      try { body = bodyText ? JSON.parse(bodyText) : null; } catch {}
      if (!res.ok) throw new Error(body?.detail || body?.message || "Failed to send invite");
      setToast({ type: "success", message: "Invitation sent" });
      setView("list");
      await (async () => { try { await fetch(`/api/users`).then(r => r.json()).then(d => {
        const mapped = (d?.data || []).map((u) => ({
          id: u.id ?? u.sso_user_id ?? u.email,
          name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
          role: u.role ?? "User",
          email: u.email ?? "",
        }));
        setRows(mapped);
      }); } catch {} })();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to send invite" });
    }
  };

  // ============================
  // Columns
  // ============================
  const columns = [
    { header: "Name", accessor: "name" },
    { header: "Role", accessor: "role" },
    { header: "Email", accessor: "email" },
  ];

  // ============================
  // Render Views
  // ============================
  const renderList = () => (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BackButton />
          <h1 className="text-xl font-semibold text-primary">Users</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" size="md" onClick={() => setView("create")}>+ Create User</Button>
          <Button variant="secondary" size="md" onClick={() => setView("invite")}>+ Invite User</Button>
        </div>
      </div>
      <Toast type={toast.type} message={toast.message} />
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Deletion"
        confirmText="Delete"
        onConfirm={confirmDelete}
      >
        <p className="text-sm">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{targetRow?.name}</span>? This action cannot be undone.
        </p>
      </Modal>
      <DataTable
        columns={columns}
        rows={rows}
        searchKey="name"
        actionRenderer={(row) => (
          <GlossyButton
            size="sm"
            variant="outlined"
            className="bg-white text-rose-600 border border-rose-200 hover:bg-rose-50"
            onClick={() => openConfirm(row)}
          >
            Delete
          </GlossyButton>
        )}
      />
    </div>
  );

  const renderCreate = () => (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Card className="glass-panel">
        <CardBody>
          <div className="mb-4 flex items-center justify-between">
            <Typography variant="h6" className="text-gray-900">User Creation</Typography>
            <button onClick={() => setView("list")} className="text-accent text-sm hover:underline">Back to Users</button>
          </div>
          <Toast type={toast.type} message={toast.message} />
          <form className="grid gap-4" onSubmit={onCreateSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <FormField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div>
                <FormField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>
              <FormField label="Role" type="select" value={role} onChange={(v) => setRole(v)} options={[
                { label: "QA", value: "QA" },
                { label: "DEV", value: "DEV" },
                { label: "PM", value: "PM" },
                { label: "Others", value: "Others" },
              ]} />
            </div>
            <div className="mt-4 flex gap-3">
              <GlossyButton type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </GlossyButton>
              <GlossyButton type="button" variant="text" onClick={() => setView("list")}>Cancel</GlossyButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  const renderInvite = () => (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Card className="glass-panel">
        <CardBody>
          <Typography variant="h6" className="mb-4 text-primary">Invite User</Typography>
          <form className="grid gap-4" onSubmit={onInviteSubmit}>
            <FormField label="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <FormField label="Role" type="select" value={inviteRole} onChange={(v) => setInviteRole(v)} options={[
              { label: "Developer", value: "Developer" },
              { label: "QA", value: "QA" },
              { label: "PM", value: "PM" },
              { label: "Admin", value: "Admin" },
            ]} />
            <FormField label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <div className="flex items-center gap-3">
              <GlossyButton type="submit">Send Invite</GlossyButton>
              <GlossyButton variant="text" className="bg-transparent text-gray-700 hover:text-accent" onClick={() => setView("list")}>Cancel</GlossyButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen">
      {view === "list" && renderList()}
      {view === "create" && renderCreate()}
      {view === "invite" && renderInvite()}
    </div>
  );
}
