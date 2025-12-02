import { Card, CardBody, Typography } from "@material-tailwind/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

export default function DataTable({ columns, rows, searchKey = "title", viewHref, actionRenderer }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return rows.filter((r) => String(r[searchKey] || "").toLowerCase().includes(term));
  }, [q, rows, searchKey]);

  return (
    <Card className="glass-panel">
      <CardBody className="p-0">
        {/* Header with search */}
        <div className="px-6 py-4 sm:px-8 border-b border-borderLight/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Typography variant="h6" className="text-primary font-bold">Results</Typography>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-textMuted" />
            <input
              aria-label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg bg-white border border-borderLight pl-10 pr-3 py-2.5 text-sm text-text placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
            />
          </div>
        </div>

        {/* Table container with horizontal scroll on mobile */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-primary/95 to-primaryLight/95 text-white border-b border-primary/20">
                {columns.map((c) => (
                  <th 
                    key={c.accessor} 
                    className="px-6 py-4 text-left font-semibold text-white/95 uppercase text-xs tracking-wider"
                  >
                    {c.header}
                  </th>
                ))}
                {viewHref && <th className="px-6 py-4" />}
                {actionRenderer && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (viewHref ? 1 : 0) + (actionRenderer ? 1 : 0)} className="px-6 py-8 text-center">
                    <Typography className="text-textMuted">No results found</Typography>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr 
                    key={row.id || idx} 
                    className="border-b border-borderLight/60 hover:bg-gradient-to-r hover:from-accent/5 hover:to-accent/3 transition-all duration-200"
                  >
                    {columns.map((c) => (
                      <td 
                        key={c.accessor} 
                        className="px-6 py-4 text-text font-medium"
                      >
                        {row[c.accessor]}
                      </td>
                    ))}
                    {viewHref && (
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`${viewHref}/${row.id}`} 
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-all text-sm font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    )}
                    {actionRenderer && (
                      <td className="px-6 py-4 text-right">
                        {actionRenderer(row)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        {filtered.length > 0 && (
          <div className="px-6 py-3 sm:px-8 border-t border-borderLight/60 text-xs text-textMuted">
            Showing {filtered.length} of {rows.length} results
          </div>
        )}
      </CardBody>
    </Card>
  );
}