/**
 * ListPageWrapper Component
 * Consolidates common list/table/filter/sort/search functionality
 * Eliminates duplication between Tasks and Security Controls pages
 */

import { useMemo, useState } from "react";
import Modal from "./Modal";
import FormField from "./FormField";
import GlossyButton from "./GlossyButton";
import Button from "./ui/Button";
import BackButton from "./BackButton";

export default function ListPageWrapper({
  title,
  items = [],
  columns = [],
  searchKeys = [],
  filters = [],
  sortBy = "createdDate",
  sortDir = "desc",
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onViewClick,
  formOpen,
  onFormClose,
  formData,
  onFormChange,
  formFields = [],
  onFormSubmit,
  formTitle,
  renderForm, // optional custom form renderer
  viewOpen,
  onViewClose,
  viewData = {},
  renderView, // optional custom view renderer
  deleteOpen,
  onDeleteClose,
  onDeleteConfirm,
  isLoading = false,
  exportFunctions = {},
  renderActions, // optional custom actions renderer
  modalVariant = "default", // forwarded to Modal
  showBackButton = true,
}) {
  // Search / Filter / Sort
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortDir, setCurrentSortDir] = useState(sortDir);

  // Filtered & sorted items
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter((item) => {
      // Search
      if (term && searchKeys.length > 0) {
        const searchText = searchKeys.map((k) => String(item[k] || "")).join(" ").toLowerCase();
        if (!searchText.includes(term)) return false;
      }

      // Filters
      for (const [filterKey, filterValue] of Object.entries(filterValues)) {
        if (filterValue && item[filterKey] !== filterValue) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      const av = a[currentSortBy] ?? "";
      const bv = b[currentSortBy] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return currentSortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [items, q, filterValues, currentSortBy, currentSortDir, searchKeys]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 font-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-full px-6 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton ? <BackButton /> : null}
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={onCreateClick}
            ariaLabel={`Create ${title}`}
          >
            + Create
          </Button>
        </div>

        {/* Export buttons (if provided) */}
        {Object.keys(exportFunctions).length > 0 && (
          <div className="flex justify-end gap-2 mb-3">
            {exportFunctions.csv && (
              <GlossyButton size="sm" variant="outlined" onClick={exportFunctions.csv}>
                Export CSV
              </GlossyButton>
            )}
            {exportFunctions.excel && (
              <GlossyButton size="sm" onClick={exportFunctions.excel}>
                Export Excel
              </GlossyButton>
            )}
          </div>
        )}

        {/* Controls: search, filter, sort */}
        <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />

          {/* Custom filters */}
          {filters.map((f) => (
            <select
              key={f.key}
              aria-label={`Filter by ${f.label}`}
              value={filterValues[f.key] || ""}
              onChange={(e) =>
                setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="w-full rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800"
            >
              <option value="">All {f.label}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}

          {/* Sort */}
          <div className="flex gap-2">
            <select
              aria-label="Sort by"
              value={currentSortBy}
              onChange={(e) => setCurrentSortBy(e.target.value)}
              className="flex-1 rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800"
            >
              <option value="createdDate">Created Date</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
            </select>
            <select
              aria-label="Sort direction"
              value={currentSortDir}
              onChange={(e) => setCurrentSortDir(e.target.value)}
              className="w-28 rounded-xl bg-white border border-neutral-300 px-3 py-2 text-gray-800"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200 glass-panel">
          <table className="min-w-full text-sm text-gray-800">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 truncate max-w-xs">
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {typeof renderActions === "function" ? (
                      renderActions(item)
                    ) : (
                      <div className="flex items-center gap-2">
                        {onViewClick && (
                          <GlossyButton
                            size="sm"
                            variant="outlined"
                            className="bg-white"
                            onClick={() => onViewClick(item)}
                          >
                            View
                          </GlossyButton>
                        )}
                        {onEditClick && (
                          <GlossyButton size="sm" onClick={() => onEditClick(item)}>
                            Edit
                          </GlossyButton>
                        )}
                        {onDeleteClick && (
                          <GlossyButton
                            size="sm"
                            variant="text"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => onDeleteClick(item)}
                          >
                            Delete
                          </GlossyButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-gray-600"
                    colSpan={columns.length + 1}
                  >
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={onFormClose}
        title={formTitle}
        confirmText="Save"
        onConfirm={onFormSubmit}
        variant={modalVariant}
      >
        {typeof renderForm === "function" ? (
          renderForm({ formData, onFormChange, formFields })
        ) : (
          <div className="grid gap-3">
            {formFields.map((field) => (
              <FormField
                key={field.key}
                label={field.label}
                type={field.type || "text"}
                value={formData[field.key] || ""}
                onChange={(val) => {
                  if (typeof val === "string") {
                    onFormChange(field.key, val);
                  } else {
                    onFormChange(field.key, val.target.value);
                  }
                }}
                placeholder={field.placeholder}
                options={field.options}
              />
            ))}
          </div>
        )}
      </Modal>

      {/* View Modal */}
      {viewOpen && (
        <Modal
          open={viewOpen}
          onClose={onViewClose}
          title="Details"
          confirmText="Close"
          variant={modalVariant}
        >
          {typeof renderView === "function" ? (
            renderView({ data: viewData })
          ) : (
            <div className="grid gap-2 text-gray-800">
              {Object.entries(viewData).map(([key, value]) => (
                <p key={key}>
                  <span className="text-gray-600 capitalize">{key}:</span> {String(value || "—")}
                </p>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteOpen && (
        <Modal
          open={deleteOpen}
          onClose={onDeleteClose}
          title="Delete Item?"
          confirmText="Delete"
          onConfirm={onDeleteConfirm}
          variant={modalVariant}
          size="sm"
        >
          <p className="text-gray-800">
            This action cannot be undone. Are you sure you want to delete this item?
          </p>
        </Modal>
      )}
    </div>
  );
}
