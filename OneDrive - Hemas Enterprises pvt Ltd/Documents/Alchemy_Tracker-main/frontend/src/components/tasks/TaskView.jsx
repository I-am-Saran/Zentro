export default function TaskView({ data = {} }) {
  const priorityClass =
    data.priority === "high"
      ? "bg-orange-100 text-orange-700"
      : data.priority === "medium"
      ? "bg-amber-100 text-amber-700"
      : "bg-green-100 text-green-700";
  const statusClass =
    data.status === "todo"
      ? "bg-red-100 text-red-700"
      : data.status === "in-progress"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";

  const initial = String(data.assignedTo || "?").charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      {/* Title and badges */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{data.title || "Untitled Task"}</h2>
        <div className="flex items-center gap-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold capitalize ${statusClass}`}>{data.status}</span>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold capitalize ${priorityClass}`}>{data.priority}</span>
        </div>
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
          {initial}
        </div>
        <div className="text-sm">
          <div className="text-gray-900 font-medium">{data.assignedTo || "Unassigned"}</div>
          <div className="text-gray-600">Assigned To</div>
        </div>
      </div>

      {/* Dates and meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-white border border-neutral-200">
          <div className="text-gray-600">Task ID</div>
          <div className="text-gray-900 font-medium">{data.id ?? "—"}</div>
        </div>
        <div className="p-3 rounded-xl bg-white border border-neutral-200">
          <div className="text-gray-600">Due Date</div>
          <div className="text-gray-900 font-medium">{data.dueDate || "—"}</div>
        </div>
        <div className="p-3 rounded-xl bg-white border border-neutral-200">
          <div className="text-gray-600">Created By</div>
          <div className="text-gray-900 font-medium">{data.createdBy || "—"}</div>
        </div>
        <div className="p-3 rounded-xl bg-white border border-neutral-200">
          <div className="text-gray-600">Created Date</div>
          <div className="text-gray-900 font-medium">{data.createdDate || "—"}</div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl bg-white border border-neutral-200 p-4">
        <div className="text-gray-900 font-medium mb-2">Description</div>
        <p className="text-gray-700 text-sm whitespace-pre-wrap">
          {data.description?.trim() ? data.description : "—"}
        </p>
      </div>
    </div>
  );
}