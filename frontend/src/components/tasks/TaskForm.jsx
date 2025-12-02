import FormField from "../../components/FormField";
import SearchableSelect from "../../components/SearchableSelect";

export default function TaskForm({ formData, onFormChange, formFields = [] }) {
  const assignedField = formFields.find((f) => f.key === "assignedTo") || {};
  const priorityField = formFields.find((f) => f.key === "priority") || {};
  const statusField = formFields.find((f) => f.key === "status") || {};

  const priorityOptions = priorityField.options || [
    { label: "Low", value: "low" },
    { label: "Medium", value: "medium" },
    { label: "High", value: "high" },
  ];
  const statusOptions = statusField.options || [
    { label: "Todo", value: "todo" },
    { label: "In Progress", value: "in-progress" },
    { label: "Done", value: "done" },
  ];

  const chipBase =
    "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border hover:shadow-sm";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: title + description */}
      <div className="space-y-3">
        <FormField
          label="Task Title"
          type="text"
          value={formData.title || ""}
          placeholder="Clear and concise task title"
          onChange={(e) => onFormChange("title", e.target.value)}
        />
        <FormField
          label="Description"
          type="textarea"
          value={formData.description || ""}
          placeholder="Details, steps, context"
          onChange={(e) => onFormChange("description", e.target.value)}
        />
      </div>

      {/* Right: metadata */}
      <div className="space-y-3">
        <SearchableSelect
          label="Assigned To"
          value={formData.assignedTo || ""}
          onChange={(val) => onFormChange("assignedTo", val)}
          options={assignedField.options || []}
          placeholder={assignedField.placeholder || "Select assignee"}
        />

        {/* Priority chips */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Priority</label>
          <div className="flex flex-wrap gap-2">
            {priorityOptions.map((opt) => {
              const active = formData.priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFormChange("priority", opt.value)}
                  className={`${chipBase} ${
                    active
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "bg-white border-neutral-300 text-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status chips */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((opt) => {
              const active = formData.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFormChange("status", opt.value)}
                  className={`${chipBase} ${
                    active
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "bg-white border-neutral-300 text-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <FormField
          label="Due Date"
          type="date"
          value={formData.dueDate || ""}
          onChange={(e) => onFormChange("dueDate", e.target.value)}
        />
      </div>
    </div>
  );
}