import { useMemo, useState } from "react";
import ListPageWrapper from "../components/ListPageWrapper";
import TaskForm from "../components/tasks/TaskForm";
import TaskView from "../components/tasks/TaskView";
import IconButton from "../components/ui/IconButton";
import { tasks as seedTasks } from "../data/tasks";

export default function TasksList() {
  // Initialize rows from seed data
  const [rows, setRows] = useState(() =>
    seedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: "",
      assignedTo: t.owner,
      priority: "medium",
      status: t.status,
      dueDate: t.due,
      createdBy: "System",
      createdDate: new Date().toISOString().slice(0, 10),
    }))
  );

  // Modal state
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

  const handleCreateClick = () => {
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
    setFormData(row);
    setEditingId(row.id);
    setViewOpen(true);
  };

  const handleDeleteClick = (row) => {
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
      const newRow = {
        id: nextId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        assignedTo: formData.assignedTo.trim(),
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate || new Date().toISOString().slice(0, 10),
        createdBy: "You",
        createdDate: new Date().toISOString().slice(0, 10),
      };
      setRows((prev) => [...prev, newRow]);
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
    setRows((prev) => prev.filter((r) => r.id !== editingId));
    setDeleteOpen(false);
    setEditingId(null);
  };

  const columns = [
    { key: "id", label: "Task ID" },
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

  // Simple CSV export for current rows
  const exportCsv = () => {
    const headers = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) =>
      [
        r.id,
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

  const formFields = [
    {
      key: "title",
      label: "Task Title",
      placeholder: "Clear and concise task title",
    },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Details, steps, context",
    },
    {
      key: "assignedTo",
      label: "Assigned To",
      placeholder: "Owner of this task",
      options: Array.from(new Set(seedTasks.map((t) => t.owner))).map((name) => ({
        label: name,
        value: name,
      })),
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
        <TaskForm formData={formData} onFormChange={onFormChange} formFields={formFields} />
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
          <IconButton
            title="View"
            ariaLabel="View"
            variant="outline"
            onClick={() => handleViewClick(item)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </IconButton>
          <IconButton
            title="Edit"
            ariaLabel="Edit"
            onClick={() => handleEditClick(item)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4h2M4 20h16M7 12l10-10 3 3-10 10H7v-3z"/></svg>
          </IconButton>
          <IconButton
            title="Delete"
            ariaLabel="Delete"
            variant="danger"
            onClick={() => handleDeleteClick(item)}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M8 6v12m8-12v12M5 6l1 15a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-15"/></svg>
          </IconButton>
        </div>
      )}
    />
  );
}
