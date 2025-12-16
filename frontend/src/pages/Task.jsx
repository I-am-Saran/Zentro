import { useMemo, useState, useEffect } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import { useNavigate, useParams, Link } from "react-router-dom";
import GlossyButton from "../components/GlossyButton";
import FormField from "../components/FormField";
import ListPageWrapper from "../components/ListPageWrapper";
import TaskFormComponent from "../components/tasks/TaskForm";
import TaskView from "../components/tasks/TaskView";
import IconButton from "../components/ui/IconButton";
import { get, post, del as delReq } from "../services/api";
import { supabase } from "../supabaseClient";
import { useSupabaseSession } from "../hooks/useSupabaseSession";

export function TaskForm() {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("todo");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    console.log({ title, status, owner, notes });
    navigate("/tasks");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <Card className="glass-panel">
          <CardBody>
            <Typography variant="h6" className="mb-4 text-primary">Create Task</Typography>
            <form className="grid gap-4" onSubmit={submit}>
              <FormField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <FormField
                label="Status"
                type="select"
                value={status}
                onChange={(val) => setStatus(val)}
                options={[
                  { label: "Todo", value: "todo" },
                  { label: "In Progress", value: "in-progress" },
                  { label: "Done", value: "done" },
                ]}
              />
              <FormField label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
              <FormField label="Notes" type="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex items-center gap-3">
                <GlossyButton type="submit">Save</GlossyButton>
                <GlossyButton variant="text" className="bg-transparent text-gray-700 hover:text-accent" onClick={() => navigate("/tasks")}>Cancel</GlossyButton>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export function TaskDetails() {
  const { id } = useParams();
  const task = null;
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-6">
        {!task ? (
          <Typography className="text-gray-700">Task not found.</Typography>
        ) : (
          <Card className="glass-panel">
            <CardBody className="grid gap-3">
              <Typography variant="h5" className="text-primary">{task.title}</Typography>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <p><span className="text-gray-600">Status:</span> {task.status}</p>
                <p><span className="text-gray-600">Owner:</span> {task.owner}</p>
                <p><span className="text-gray-600">Due:</span> {task.due}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <GlossyButton variant="outlined" as={Link} to={`/tasks`} className="bg-white">Back</GlossyButton>
                <GlossyButton as={Link} to={`/tasks/${task.id}/edit`}>Edit</GlossyButton>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

export function TasksList() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const { session } = useSupabaseSession();

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium",
    status: "todo",
    dueDate: "",
  });

  const nextId = useMemo(
    () => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1,
    [rows]
  );

  useEffect(() => {
    (async () => {
      try {
        const resUsers = await get("/api/users");
        let emails = (resUsers?.data || []).map((u) => u.email).filter(Boolean);
        if (!emails || emails.length === 0) {
          try {
            const { data } = await supabase.from("users").select("email").limit(200);
            emails = (data || []).map((u) => u.email).filter(Boolean);
          } catch {}
        }
        setUsers(emails || []);
        const resTasks = await get("/api/tasks");
        const rowsMapped = (resTasks?.data || []).map((r, idx) => {
          const serial = String(idx + 1).padStart(3, "0");
          const note = r.task_note || "";
          const m = note.match(/\[meta\]\s*due=([^\s]+)\s+created_by=([^\s]+)/i);
          const due = m?.[1] || "";
          const createdBy = m?.[2] || "";
          const cleanedNote = note.replace(/\n?\s*\[meta\][\s\S]*$/, "").trim();
          const createdDate = (r.created_at || new Date().toISOString()).slice(0, 10);
          return {
            id: r.id,
            serial,
            title: r.task_name || "",
            description: cleanedNote,
            assignedTo: r.assigned_to || "",
            priority: r.task_priority || "medium",
            status: r.task_status || "todo",
            dueDate: due,
            createdBy: createdBy,
            createdDate,
          };
        });
        setRows(rowsMapped);
      } catch (e) {
        try {
          const { data } = await supabase.from("users").select("email").limit(200);
          const emails = (data || []).map((u) => u.email).filter(Boolean);
          setUsers(emails || []);
        } catch {
          setUsers([]);
        }
      }
    })();
  }, []);

  const handleCreateClick = () => {
    setViewOpen(false);
    setDeleteOpen(false);
    setFormData({
      title: "",
      description: "",
      assignedTo: "",
      priority: "medium",
      status: "todo",
      dueDate: "",
    });
    setEditingId(null);
    setFormOpen(true);
  };

  const handleEditClick = (row) => {
    setFormData({
      title: row.title || "",
      description: row.description || "",
      assignedTo: row.assignedTo || "",
      priority: row.priority || "medium",
      status: row.status || "todo",
      dueDate: row.dueDate || "",
    });
    setEditingId(row.id);
    setFormOpen(true);
  };

  const handleViewClick = (row) => {
    setFormOpen(false);
    setDeleteOpen(false);
    setFormData(row);
    setEditingId(row.id);
    setViewOpen(true);
  };

  const handleDeleteClick = (row) => {
    setFormOpen(false);
    setViewOpen(false);
    setEditingId(row.id);
    setDeleteOpen(true);
  };

  const handleFormChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormSubmit = () => {
    if (!formData.title.trim() || !formData.assignedTo.trim()) {
      alert("Please provide both Title and Assigned To.");
      return;
    }

    if (editingId == null) {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        assignedTo: formData.assignedTo.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate || new Date().toISOString().slice(0, 10),
        createdBy: session?.user?.email || "You",
      };
      post("/api/tasks", payload)
        .then(async () => {
          const resTasks = await get("/api/tasks");
          const rowsMapped = (resTasks?.data || []).map((r, idx) => {
            const serial = String(idx + 1).padStart(3, "0");
            const note = r.task_note || "";
            const m = note.match(/\[meta\]\s*due=([^\s]+)\s+created_by=([^\s]+)/i);
            const due = m?.[1] || "";
            const createdBy = m?.[2] || "";
            const cleanedNote = note.replace(/\n?\s*\[meta\][\s\S]*$/, "").trim();
            const createdDate = (r.created_at || new Date().toISOString()).slice(0, 10);
            return {
              id: r.id,
              serial,
              title: r.task_name || "",
              description: cleanedNote,
              assignedTo: r.assigned_to || "",
              priority: r.task_priority || "medium",
              status: r.task_status || "todo",
              dueDate: due,
              createdBy: createdBy,
              createdDate,
            };
          });
          setRows(rowsMapped);
          setFormOpen(false);
          setFormData({
            title: "",
            description: "",
            assignedTo: "",
            priority: "medium",
            status: "todo",
            dueDate: new Date().toISOString().slice(0, 10),
          });
        })
        .catch((err) => {
          console.error("Task save error:", err);
          alert(err.message || "Failed to save task");
        });
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                title: formData.title.trim(),
                description: formData.description.trim(),
                assignedTo: formData.assignedTo.trim(),
                priority: formData.priority,
                status: formData.status,
                dueDate: formData.dueDate || r.dueDate,
              }
            : r
        )
      );
    }
    setFormOpen(false);
  };

  const handleDeleteConfirm = () => {
    const doRefetch = async () => {
      const resTasks = await get("/api/tasks");
      const rowsMapped = (resTasks?.data || []).map((r, idx) => {
        const serial = String(idx + 1).padStart(3, "0");
        const note = r.task_note || "";
        const m = note.match(/\[meta\]\s*due=([^\s]+)\s+created_by=([^\s]+)/i);
        const due = m?.[1] || "";
        const createdBy = m?.[2] || "";
        const cleanedNote = note.replace(/\n?\s*\[meta\][\s\S]*$/, "").trim();
        const createdDate = (r.created_at || new Date().toISOString()).slice(0, 10);
        return {
          id: r.id,
          serial,
          title: r.task_name || "",
          description: cleanedNote,
          assignedTo: r.assigned_to || "",
          priority: r.task_priority || "medium",
          status: r.task_status || "todo",
          dueDate: due,
          createdBy: createdBy,
          createdDate,
        };
      });
      setRows(rowsMapped);
    };

    const doFinish = () => {
      setDeleteOpen(false);
      setEditingId(null);
    };

    if (editingId) {
      const idPath = `/api/tasks/${encodeURIComponent(String(editingId))}`;
      delReq(idPath)
        .then(() => {
          setRows((prev) => prev.filter((r) => String(r.id) !== String(editingId)));
          return doRefetch();
        })
        .catch(async () => {
          const name = (formData?.title || "").trim();
          const status = (formData?.status || "").trim();
          if (name) {
            const qs = encodeURI(`/api/tasks?task_name=${name}${status ? `&task_status=${status}` : ""}`);
            try {
              await delReq(qs);
              setRows((prev) => prev.filter((r) => r.title !== name || (status && r.status !== status)));
              await doRefetch();
            } catch (err) {
              alert(err.message || "Failed to delete task");
            }
          } else {
            alert("Failed to delete task");
          }
        })
        .finally(doFinish);
      return;
    }

    const name = (formData?.title || "").trim();
    const status = (formData?.status || "").trim();
    if (!name) {
      alert("Missing task title for deletion");
      doFinish();
      return;
    }
    const qs = encodeURI(`/api/tasks?task_name=${name}${status ? `&task_status=${status}` : ""}`);
    delReq(qs)
      .then(() => {
        setRows((prev) => prev.filter((r) => r.title !== name || (status && r.status !== status)));
        return doRefetch();
      })
      .catch((err) => alert(err.message || "Failed to delete task"))
      .finally(doFinish);
  };

  const columns = [
    { key: "serial", label: "Task ID" },
    { key: "title", label: "Title" },
    { key: "description", label: "Description" },
    { key: "assignedTo", label: "Assigned To" },
    {
      key: "priority",
      label: "Priority",
      render: (row) => (
        <span
          className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold capitalize ${
            row.priority === "high"
              ? "bg-orange-100 text-orange-700"
              : row.priority === "medium"
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {row.priority}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold capitalize ${
            row.status === "todo"
              ? "bg-red-100 text-red-700"
              : row.status === "in-progress"
              ? "bg-blue-100 text-blue-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    { key: "dueDate", label: "Due Date" },
    { key: "createdBy", label: "Created By" },
    { key: "createdDate", label: "Created Date" },
  ];

  const exportCsv = () => {
    const headers = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) =>
      [
        r.serial,
        r.title,
        r.description,
        r.assignedTo,
        r.priority,
        r.status,
        r.dueDate,
        r.createdBy,
        r.createdDate,
      ]
        .map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filters = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Todo", value: "todo" },
        { label: "In Progress", value: "in-progress" },
        { label: "Done", value: "done" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
  ];

  const assignedOptions = users.map((email) => ({ label: email, value: email }));

  const formFields = [
    { key: "title", label: "Task Title", placeholder: "Clear and concise task title" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Details, steps, context" },
    {
      key: "assignedTo",
      label: "Assigned To",
      placeholder: "Owner of this task",
      options: assignedOptions,
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "Todo", value: "todo" },
        { label: "In Progress", value: "in-progress" },
        { label: "Done", value: "done" },
      ],
    },
    { key: "dueDate", label: "Due Date", placeholder: "YYYY-MM-DD" },
  ];

  return (
    <ListPageWrapper
      title="Tasks"
      items={rows}
      columns={columns}
      searchKeys={["title", "description", "assignedTo"]}
      filters={filters}
      showBackButton={false}
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onDeleteClick={handleDeleteClick}
      onViewClick={handleViewClick}
      formOpen={formOpen}
      onFormClose={() => setFormOpen(false)}
      formData={formData}
      onFormChange={handleFormChange}
      formFields={formFields}
      onFormSubmit={handleFormSubmit}
      formTitle={editingId == null ? "Create Task" : `Edit Task #${editingId}`}
      renderForm={({ formData, onFormChange, formFields }) => (
        <TaskFormComponent formData={formData} onFormChange={onFormChange} formFields={formFields} />
      )}
      viewOpen={viewOpen}
      onViewClose={() => setViewOpen(false)}
      viewData={formData}
      renderView={({ data }) => <TaskView data={data} />}
      deleteOpen={deleteOpen}
      onDeleteClose={() => setDeleteOpen(false)}
      onDeleteConfirm={handleDeleteConfirm}
      exportFunctions={{ csv: exportCsv }}
      modalVariant="modern"
      renderActions={(item) => (
        <div className="flex items-center gap-1.5">
          <IconButton title="View" ariaLabel="View" variant="outline" onClick={() => handleViewClick(item)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </IconButton>
          <IconButton title="Edit" ariaLabel="Edit" onClick={() => handleEditClick(item)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4h2M4 20h16M7 12l10-10 3 3-10 10H7v-3z"/></svg>
          </IconButton>
          <IconButton title="Delete" ariaLabel="Delete" variant="danger" onClick={() => handleDeleteClick(item)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M8 6v12m8-12v12M5 6l1 15a2 2 0 0 0 2 2h8a 2 2 0 0 0 2-2l1-15"/></svg>
          </IconButton>
        </div>
      )}
    />
  );
}
