// src/pages/Dashboard.jsx

import { useEffect, useState, useMemo } from "react";
import { Bug, Users as UsersIcon, TrendingUp, ShieldCheck } from "lucide-react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import { supabase } from "../supabaseClient";

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "";

export default function Dashboard() {
  // ---------------- high-level dashboard states ---------------
  const [totalBugs, setTotalBugs] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [securityAlerts, setSecurityAlerts] = useState(0);
  const [recentBugs, setRecentBugs] = useState([]);

  const [priorityData, setPriorityData] = useState([
    { priority: "High", count: 0 },
    { priority: "Medium", count: 0 },
    { priority: "Low", count: 0 },
  ]);
  const [priorityLoading, setPriorityLoading] = useState(false);

  const [userChartData, setUserChartData] = useState([]);
  const [userChartLoading, setUserChartLoading] = useState(false);

  // comprehensive bugs for charts
  const [allBugs, setAllBugs] = useState([]);
  const [allBugsLoading, setAllBugsLoading] = useState(false);

  // ---- Transtracker specific states ----
  const today = new Date();
  const endDefault = today.toISOString().slice(0, 10);
  const startDefault = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [ttProduct, setTtProduct] = useState("");
  const [ttOwner, setTtOwner] = useState("");
  const [ttAppType, setTtAppType] = useState("");
  const [ttSpoc, setTtSpoc] = useState("");
  const [ttStart, setTtStart] = useState(startDefault);
  const [ttEnd, setTtEnd] = useState(endDefault);
  const [ttGroupBy, setTtGroupBy] = useState("day"); // day|week|month
  const [ttLoading, setTtLoading] = useState(false);
  const [ttTimeseries, setTtTimeseries] = useState([]);
  const [ttRows, setTtRows] = useState([]);
  const [ttLimit, setTtLimit] = useState(10);
  const [ttOffset, setTtOffset] = useState(0);
  const [ttError, setTtError] = useState(null);

  const [ttBarData, setTtBarData] = useState([]);
  const [ttBarLoading, setTtBarLoading] = useState(false);

  // NEW: dropdown options for filters
  const [ttAppTypeOptions, setTtAppTypeOptions] = useState([]);
  const [ttProductOptions, setTtProductOptions] = useState([]);
  const [ttOwnerOptions, setTtOwnerOptions] = useState([]);
  const [ttSpocOptions, setTtSpocOptions] = useState([]);

  // ---------------- visual constants ----------------
  const colorMap = {
    High: "#E53E3E",
    Medium: "#F6AD55",
    Low: "#48BB78",
  };

  const donutColors = [
    "#60A5FA",
    "#F6AD55",
    "#7C3AED",
    "#10B981",
    "#F87171",
    "#F59E0B",
  ];

  const totalPriority = priorityData.reduce((s, r) => s + (r.count || 0), 0);
  const totalUsersInChart = userChartData.reduce(
    (s, d) => s + (d.value || 0),
    0
  );

  // ------------------- helper functions -------------------
  function parseDateFromRow(row) {
    const candidates = [
      row?.buildreceiveddate,
      row?.buildreceivedtime,
      row?.testreportsentdate,
      row?.created_at,
      row?.buildreceived_date,
    ];
    for (const v of candidates) {
      if (!v) continue;
      if (v instanceof Date) return v;
      if (typeof v === "number") {
        const d = new Date(Number(v));
        if (!isNaN(d)) return d;
      }
      if (typeof v === "string") {
        const s = v.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const d = new Date(s + "T00:00:00");
          if (!isNaN(d)) return d;
        }
        const d2 = new Date(s);
        if (!isNaN(d2)) return d2;
        if (/^\d+$/.test(s)) {
          const d3 = new Date(Number(s));
          if (!isNaN(d3)) return d3;
        }
      }
    }
    return null;
  }

  function normalizeGroupKey(dt, groupBy = "day") {
    if (!dt) return null;
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    if (groupBy === "month") return `${yy}-${mm}-01`;
    if (groupBy === "week") {
      const day = dt.getDay(); // 0 Sun .. 6 Sat
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - diffToMonday);
      const my = monday.getFullYear();
      const mm2 = String(monday.getMonth() + 1).padStart(2, "0");
      const dd2 = String(monday.getDate()).padStart(2, "0");
      return `${my}-${mm2}-${dd2}`;
    }
    return `${yy}-${mm}-${dd}`;
  }

  function aggregateRowsToBarData(rows = [], groupBy = ttGroupBy) {
    const map = new Map();
    for (const r of rows || []) {
      const dt = parseDateFromRow(r);
      if (!dt) continue;
      const key = normalizeGroupKey(dt, groupBy || "day");
      const val = r.totalopenbugs != null ? Number(r.totalopenbugs) : 0;
      map.set(key, (map.get(key) || 0) + (isNaN(val) ? 0 : val));
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value: Number(value) }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  // ---------------- Transtracker fetchers ----------------
  async function fetchTranstrackerAll({
    product,
    owner,
    start_date,
    end_date,
    group_by,
    app_type,
    spoc,
  } = {}) {
    setTtLoading(true);
    setTtError(null);
    try {
      const { data, error } = await supabase
        .from("transtrackers")
        .select("*")
        .limit(5000);

      if (error) {
        console.error("Supabase fetchTranstrackerAll error:", error);
        setTtRows([]);
        setTtTimeseries([]);
        setTtError(null);
        return;
      }

      const rows = data || [];

      const prodQ = (product || ttProduct || "").trim().toLowerCase();
      const ownerQ = (owner || ttOwner || "").trim().toLowerCase();
      const appQ = (app_type || ttAppType || "").trim().toLowerCase();
      const spocQ = (spoc || ttSpoc || "").trim().toLowerCase();
      const sdt = start_date ? new Date(start_date + "T00:00:00") : null;
      const edt = end_date ? new Date(end_date + "T23:59:59") : null;

      const filtered = rows.filter((r) => {
        const p = (
          r.productsegregated ||
          r.projects_products ||
          r.applicationtype ||
          r.product ||
          ""
        )
          .toString()
          .toLowerCase();
        if (prodQ && !p.includes(prodQ)) return false;

        const o = (r.productowner || r.spoc || r.owner || "")
          .toString()
          .toLowerCase();
        if (ownerQ && !o.includes(ownerQ)) return false;

        const appVal = (
          r.applicationtype ||
          r.application ||
          ""
        )
          .toString()
          .toLowerCase();
        if (appQ && !appVal.includes(appQ)) return false;

        const spocVal = (r.spoc || "").toString().toLowerCase();
        if (spocQ && !spocVal.includes(spocQ)) return false;

        if (sdt || edt) {
          const dt = parseDateFromRow(r);
          if (!dt) return false;
          if (sdt && dt < sdt) return false;
          if (edt && dt > edt) return false;
        }
        return true;
      });

      const buckets = new Map();
      for (const r of filtered) {
        const dt = parseDateFromRow(r);
        if (!dt) continue;
        const key = normalizeGroupKey(dt, group_by || "day");
        const val =
          r.totalopenbugs != null ? Number(r.totalopenbugs) : 1;
        buckets.set(key, (buckets.get(key) || 0) + (isNaN(val) ? 0 : val));
      }

      const timeseries = Array.from(buckets.entries())
        .map(([date, value]) => ({ date, value: Number(value) }))
        .sort((a, b) => (a.date > b.date ? 1 : -1));

      setTtRows(filtered);
      setTtTimeseries(timeseries);
      setTtError(null);
    } catch (err) {
      console.error("fetchTranstrackerAll error:", err);
      setTtError(null); // no UI error message
      setTtRows([]);
      setTtTimeseries([]);
    } finally {
      setTtLoading(false);
    }
  }

  async function fetchTranstrackerBar({
    product,
    owner,
    start_date,
    end_date,
    group_by,
    app_type,
    spoc,
  } = {}) {
    setTtBarLoading(true);
    setTtError(null);
    try {
      const { data, error } = await supabase
        .from("transtrackers")
        .select(
          "buildreceiveddate, totalopenbugs, productsegregated, productowner, applicationtype, spoc, signoffstatus, blocker, high, med, low"
        )
        .limit(5000);

      if (error) {
        console.error("Supabase fetchTranstrackerBar error:", error);
        setTtBarData([]);
        setTtError(null); // do not show any error text
        return;
      }

      const rows = data || [];

      const prodQ = (product || ttProduct || "").trim().toLowerCase();
      const ownerQ = (owner || ttOwner || "").trim().toLowerCase();
      const appQ = (app_type || ttAppType || "").trim().toLowerCase();
      const spocQ = (spoc || ttSpoc || "").trim().toLowerCase();
      const sdt = start_date
        ? new Date(start_date + "T00:00:00")
        : ttStart
          ? new Date(ttStart + "T00:00:00")
          : null;
      const edt = end_date
        ? new Date(end_date + "T23:59:59")
        : ttEnd
          ? new Date(ttEnd + "T23:59:59")
          : null;

      const filtered = rows.filter((r) => {
        const p = (r.productsegregated || "").toString().toLowerCase();
        if (prodQ && !p.includes(prodQ)) return false;

        const o = (r.productowner || "").toString().toLowerCase();
        if (ownerQ && !o.includes(ownerQ)) return false;

        const appVal = (
          r.applicationtype ||
          r.application ||
          ""
        )
          .toString()
          .toLowerCase();
        if (appQ && !appVal.includes(appQ)) return false;

        const spocVal = (r.spoc || "").toString().toLowerCase();
        if (spocQ && !spocVal.includes(spocQ)) return false;

        if (sdt || edt) {
          const dt = parseDateFromRow(r);
          if (!dt) return false;
          if (sdt && dt < sdt) return false;
          if (edt && dt > edt) return false;
        }
        return true;
      });

      const buckets = new Map();
      for (const r of filtered) {
        const dt = parseDateFromRow(r);
        if (!dt) continue;
        const key = normalizeGroupKey(dt, group_by || ttGroupBy || "day");
        const val =
          r.totalopenbugs != null ? Number(r.totalopenbugs) : 0;
        buckets.set(key, (buckets.get(key) || 0) + (isNaN(val) ? 0 : val));
      }

      const result = Array.from(buckets.entries())
        .map(([date, value]) => ({ date, value: Number(value) }))
        .sort((a, b) => (a.date > b.date ? 1 : -1));

      setTtBarData(result);
      setTtRows(filtered);
      setTtError(null);
    } catch (err) {
      console.error("fetchTranstrackerBar error:", err);
      setTtError(null); // no UI error message
      setTtBarData([]);
    } finally {
      setTtBarLoading(false);
    }
  }

  // NEW: fetch distinct values for dropdown filters
  async function fetchTranstrackerFilterOptions() {
    try {
      const { data, error } = await supabase
        .from("transtrackers")
        .select(
          "applicationtype, application, productsegregated, product, projects_products, productowner, owner, spoc"
        )
        .limit(5000);

      if (error) {
        console.error("Supabase fetchTranstrackerFilterOptions error:", error);
        return;
      }

      const appSet = new Set();
      const productSet = new Set();
      const ownerSet = new Set();
      const spocSet = new Set();

      (data || []).forEach((r) => {
        const appVal = (
          r.applicationtype ??
          r.application ??
          ""
        )
          .toString()
          .trim();
        if (appVal) appSet.add(appVal);

        const productVal = (
          r.productsegregated ??
          r.product ??
          r.projects_products ??
          ""
        )
          .toString()
          .trim();
        if (productVal) productSet.add(productVal);

        const ownerVal = (r.productowner ?? r.owner ?? "")
          .toString()
          .trim();
        if (ownerVal) ownerSet.add(ownerVal);

        const spocVal = (r.spoc ?? "").toString().trim();
        if (spocVal) spocSet.add(spocVal);
      });

      setTtAppTypeOptions(Array.from(appSet).sort());
      setTtProductOptions(Array.from(productSet).sort());
      setTtOwnerOptions(Array.from(ownerSet).sort());
      setTtSpocOptions(Array.from(spocSet).sort());
    } catch (err) {
      console.error("fetchTranstrackerFilterOptions error:", err);
    }
  }

  // ---------------- initial data fetch ----------------
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchCounts = async () => {
      if (!API_BASE) return;
      try {
        const url = `${API_BASE.replace(/\/$/, "")}/api/counts`;
        const res = await fetch(url, { signal });
        if (!res.ok) {
          console.warn("/api/counts responded", res.status);
          return;
        }
        const json = await res.json().catch(() => null);
        if (json?.status === "success" && json.data) {
          const data = json.data;
          setTotalBugs(Number(data.total_bugs || 0));
          setTotalUsers(Number(data.users || 0));
          setTransactionCount(Number(data.transactions || 0));
          setSecurityAlerts(Number(data.security_alerts || 0));
        }
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Error fetching /api/counts:", err);
      }
    };

    const fetchRecentBugs = async () => {
      try {
        const res = await supabase
          .from("bugs")
          .select("*")
          .order("Changed", { ascending: false })
          .limit(5);

        const { data, error } = res ?? {};
        if (error) {
          console.error("Error fetching recent bugs:", error);
          setRecentBugs([]);
          return;
        }

        setRecentBugs(
          (data || []).map((b) => ({
            id:
              b?.["Bug ID"] ??
              b?.["bug id"] ??
              b?.bug_id ??
              b?.id ??
              null,
            title:
              b?.["Summary"] ??
              b?.summary ??
              b?.Title ??
              "-",
            severity: b?.["Priority"] ?? b?.priority ?? "-",
            status: b?.["Status"] ?? b?.status ?? "-",
          }))
        );
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Error loading recent bugs:", err);
        setRecentBugs([]);
      }
    };

    const fetchPriorityCountsFromApi = async () => {
      if (!API_BASE) return false;
      try {
        setPriorityLoading(true);
        const url = `${API_BASE.replace(/\/$/, "")}/api/priority-stats`;
        const res = await fetch(url, { signal });
        if (!res.ok) {
          console.warn("/api/priority-stats returned", res.status);
          return false;
        }
        const json = await res.json().catch(() => null);
        if (json && json.status === "success" && json.data) {
          const counts = json.data;
          setPriorityData([
            {
              priority: "High",
              count: Number(counts.high || 0),
            },
            {
              priority: "Medium",
              count: Number(counts.medium || 0),
            },
            {
              priority: "Low",
              count: Number(counts.low || 0),
            },
          ]);
          return true;
        }
        return false;
      } catch (err) {
        if (err?.name === "AbortError") return false;
        console.warn("Priority API failed:", err);
        return false;
      } finally {
        setPriorityLoading(false);
      }
    };

    const fetchPriorityCountsFallback = async () => {
      const normalize = (val) => {
        if (val == null) return "Low";
        const s = String(val).trim().toLowerCase();
        if (["critical", "crit", "p0", "p1", "high"].includes(s))
          return "High";
        if (["medium", "med", "p2"].includes(s)) return "Medium";
        if (["low", "minor", "p3", "p4"].includes(s)) return "Low";
        if (s.includes("high")) return "High";
        if (s.includes("med")) return "Medium";
        if (s.includes("low")) return "Low";
        return "Low";
      };

      try {
        setPriorityLoading(true);

        let attempt = await supabase.from("bugs").select('"Priority"');
        let rows = attempt?.data ?? [];

        if (!rows || rows.length === 0) {
          const r2 = await supabase.from("bugs").select("Priority");
          rows = r2?.data && r2.data.length ? r2.data : rows;
        }

        if (!rows || rows.length === 0) {
          const r3 = await supabase.from("bugs").select("*").limit(1000);
          rows = r3?.data && r3.data.length ? r3.data : rows;
        }

        if (!rows || rows.length === 0) {
          console.warn(
            "Supabase returned no rows for Bugs_file (fallback). Check RLS/permissions."
          );
          setPriorityData([
            { priority: "High", count: 0 },
            { priority: "Medium", count: 0 },
            { priority: "Low", count: 0 },
          ]);
          return;
        }

        const counts = { High: 0, Medium: 0, Low: 0 };
        rows.forEach((r) => {
          let raw = null;
          if (r && typeof r === "object") {
            raw = r["Priority"] ?? r.priority ?? null;
            if (raw == null) {
              const found = Object.keys(r).find(
                (k) => k && k.toLowerCase() === "priority"
              );
              raw = found ? r[found] : Object.values(r)[0];
            }
          } else {
            raw = r;
          }
          const p = normalize(raw);
          counts[p] = (counts[p] || 0) + 1;
        });

        setPriorityData([
          { priority: "High", count: counts.High },
          { priority: "Medium", count: counts.Medium },
          { priority: "Low", count: counts.Low },
        ]);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Priority fallback fetch failed:", err);
        setPriorityData([
          { priority: "High", count: 0 },
          { priority: "Medium", count: 0 },
          { priority: "Low", count: 0 },
        ]);
      } finally {
        setPriorityLoading(false);
      }
    };

    const fetchUserStats = async () => {
      try {
        setUserChartLoading(true);
        const { data: rows, error } = await supabase
          .from("users")
          .select("role");
        if (error) {
          console.error("Error fetching users:", error);
          setUserChartData([]);
          return;
        }
        const freq = {};
        (rows || []).forEach((r) => {
          const name =
            (r && (r.role ?? r.Role ?? Object.values(r)[0])) ||
            "Unknown";
          const key = String(name).trim() || "Unknown";
          freq[key] = (freq[key] || 0) + 1;
        });
        const pieData = Object.entries(freq).map(([name, value]) => ({
          name,
          value,
        }));
        setUserChartData(pieData);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Error fetching user stats:", err);
        setUserChartData([]);
      } finally {
        setUserChartLoading(false);
      }
    };

    const fetchAllBugs = async () => {
      try {
        setAllBugsLoading(true);
        const { data, error } = await supabase
          .from("bugs")
          .select("*")
          .limit(2000);
        if (error) {
          console.error("Error fetching all bugs:", error);
          return;
        }
        setAllBugs(data || []);
      } catch (err) {
        console.error("Error fetching all bugs:", err);
      } finally {
        setAllBugsLoading(false);
      }
    };

    fetchCounts();
    fetchRecentBugs();
    fetchAllBugs();
    (async () => {
      const ok = await fetchPriorityCountsFromApi();
      if (!ok) await fetchPriorityCountsFallback();
    })();
    fetchUserStats();

    fetchTranstrackerAll({ group_by: ttGroupBy });
    fetchTranstrackerBar({ group_by: ttGroupBy });

    // NEW: load dropdown values
    fetchTranstrackerFilterOptions();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // derive ttBarData if missing
  useEffect(() => {
    if ((!ttBarData || ttBarData.length === 0) && ttRows && ttRows.length > 0) {
      const derived = aggregateRowsToBarData(ttRows, ttGroupBy);
      setTtBarData(derived);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttRows, ttGroupBy]);

  // auto-refresh transtracker when filters change
  useEffect(() => {
    if (ttStart && ttEnd && new Date(ttStart) > new Date(ttEnd)) {
      setTtError("Start date must be before or equal to End date");
      return;
    } else {
      setTtError(null);
    }

    fetchTranstrackerAll({
      product: ttProduct,
      owner: ttOwner,
      start_date: ttStart,
      end_date: ttEnd,
      group_by: ttGroupBy,
      app_type: ttAppType,
      spoc: ttSpoc,
    });
    fetchTranstrackerBar({
      product: ttProduct,
      owner: ttOwner,
      start_date: ttStart,
      end_date: ttEnd,
      group_by: ttGroupBy,
      app_type: ttAppType,
      spoc: ttSpoc,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttProduct, ttOwner, ttStart, ttEnd, ttGroupBy, ttAppType, ttSpoc]);

  // ---------------- small components & helpers ----------------
  function KpiCard({
    title,
    value,
    Icon,
    gradientFrom = "#FFF",
    gradientTo = "#FFF",
    iconBg = "#fff",
    iconColor = "#000",
  }) {
    return (
      <div className="rounded-2xl shadow-sm overflow-hidden">
        <div
          className="p-5"
          style={{
            background: `linear-gradient(90deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
            minHeight: "96px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="text-xs uppercase text-slate-500 font-semibold tracking-wider">
              {title}
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-800">
              {value}
            </div>
          </div>

          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: iconBg,
              boxShadow: "0 8px 20px rgba(2,6,23,0.06)",
            }}
          >
            {Icon ? <Icon size={20} style={{ color: iconColor }} /> : null}
          </div>
        </div>
      </div>
    );
  }

  function formatDateForRow(r) {
    const d = parseDateFromRow(r);
    if (!d) return "-";
    try {
      return d.toISOString().slice(0, 10);
    } catch {
      return String(d);
    }
  }

  // ---------------- Transtracker derived datasets ----------------
  const ttFilteredRows = useMemo(() => {
    const appQuery = ttAppType.trim().toLowerCase();
    const spocQuery = ttSpoc.trim().toLowerCase();
    if (!appQuery && !spocQuery) return ttRows;

    return (ttRows || []).filter((r) => {
      const appVal = (
        r.applicationtype ||
        r.application_type ||
        r.application ||
        ""
      )
        .toString()
        .toLowerCase();
      if (appQuery && !appVal.includes(appQuery)) return false;

      const spocVal = (r.spoc || "").toString().toLowerCase();
      if (spocQuery && !spocVal.includes(spocQuery)) return false;

      return true;
    });
  }, [ttRows, ttAppType, ttSpoc]);

  const ttOpenByProduct = useMemo(() => {
    const m = new Map();
    for (const r of ttFilteredRows || []) {
      const p = (
        r.productsegregated ??
        r.product ??
        r.projects_products ??
        "Unknown"
      ).toString();
      const val = Number(r.totalopenbugs ?? 0);
      m.set(p, (m.get(p) || 0) + (isNaN(val) ? 0 : val));
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ttFilteredRows]);

  const ttBuildByDateSeries = useMemo(
    () => aggregateRowsToBarData(ttFilteredRows || [], ttGroupBy),
    [ttFilteredRows, ttGroupBy]
  );

  const ttApplicationTypeDistribution = useMemo(() => {
    const m = new Map();
    for (const r of ttFilteredRows || []) {
      const name = (
        r.applicationtype ??
        r.application ??
        "Unknown"
      ).toString();
      m.set(name, (m.get(name) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ttFilteredRows]);

  const ttSignoffStatus = useMemo(() => {
    const m = new Map();
    for (const r of ttFilteredRows || []) {
      const raw =
        r.signoffstatus ??
        r.sign_off_status ??
        r.signoff_status ??
        r.qa_signoff ??
        "";
      let label;
      if (!raw) {
        label = "Pending";
      } else {
        const s = String(raw).trim().toLowerCase();
        if (["go", "signed off", "signoff", "approved"].some((w) =>
          s.includes(w)
        )) {
          label = "Signed Off";
        } else if (["no go", "rejected"].some((w) => s.includes(w))) {
          label = "No Go";
        } else {
          label = "Conditional Go";
        }
      }
      m.set(label, (m.get(label) || 0) + 1);
    }
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  }, [ttFilteredRows]);

  const ttBuildToReportStats = useMemo(() => {
    let totalDays = 0;
    let count = 0;

    for (const r of ttFilteredRows || []) {
      const buildRaw =
        r.buildreceiveddate ??
        r.buildreceived_date ??
        r.build_received_date ??
        r.buildreceivedtime ??
        null;
      const reportRaw =
        r.testreportsentdate ??
        r.report_sent_date ??
        r.reportsentdate ??
        null;

      if (!buildRaw || !reportRaw) continue;
      const bd = new Date(buildRaw);
      const rd = new Date(reportRaw);
      if (isNaN(bd) || isNaN(rd)) continue;

      const diffMs = rd.getTime() - bd.getTime();
      if (diffMs < 0) continue;
      const days = diffMs / (1000 * 60 * 60 * 24);
      totalDays += days;
      count += 1;
    }

    const avgDays = count ? totalDays / count : 0;
    const total = ttFilteredRows?.length || 0;
    const completionRate = total ? Math.round((count / total) * 100) : 0;

    return {
      avgDays: Number(avgDays.toFixed(1)),
      completed: count,
      total,
      completionRate,
    };
  }, [ttFilteredRows]);

  // pagination uses filtered rows
  const totalRows = ttFilteredRows.length;
  const currentPage = Math.floor(ttOffset / ttLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalRows / ttLimit));
  const paginatedRows = ttFilteredRows.slice(ttOffset, ttOffset + ttLimit);

  function gotoPrevPage() {
    setTtOffset((o) => Math.max(0, o - ttLimit));
  }
  function gotoNextPage() {
    setTtOffset((o) =>
      Math.min(Math.max(0, totalRows - ttLimit), o + ttLimit)
    );
  }

  // ---------------- Bug overview (new 3 charts) ----------------
  const { bugsByStatus, bugsByAssignee, bugsByProject } = useMemo(() => {
    const statusMap = {};
    const assigneeMap = {};
    const projectMap = {};

    const normalizeStatus = (val) => {
      if (!val) return "Open";
      const s = String(val).trim().toLowerCase();
      if (["new", "open", "reopen"].some((w) => s.includes(w))) return "Open";
      if (
        ["in progress", "dev in progress", "assigned"].some((w) =>
          s.includes(w)
        )
      )
        return "In Progress";
      if (
        ["fixed", "resolved", "verified", "qa"].some((w) => s.includes(w))
      )
        return "Resolved";
      return "Open";
    };

    (allBugs || []).forEach((b) => {
      // status
      const statusRaw = b.Status ?? b.status ?? b["Status "] ?? null;
      const status = normalizeStatus(statusRaw);
      statusMap[status] = (statusMap[status] || 0) + 1;

      // assignee
      const assignee =
        b.Assignee ??
        b.assignee ??
        b["Assignee "] ??
        "";
      if (assignee && String(assignee).trim() !== "") {
        const key = String(assignee).trim();
        assigneeMap[key] = (assigneeMap[key] || 0) + 1;
      }

      // project
      const project =
        b.Project ??
        b.project ??
        b.Component ??
        b.component ??
        "Unknown";
      const projectKey = String(project).trim() || "Unknown";
      projectMap[projectKey] = (projectMap[projectKey] || 0) + 1;
    });

    // order for status like screenshot
    const statusOrder = ["Open", "In Progress", "Resolved"];
    const bugsByStatus = Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const ia = statusOrder.indexOf(a.name);
        const ib = statusOrder.indexOf(b.name);
        if (ia === -1 && ib === -1) return b.value - a.value;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

    const bugsByAssignee = Object.entries(assigneeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5 like small card

    const bugsByProject = Object.entries(projectMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // top projects for bottom chart

    return { bugsByStatus, bugsByAssignee, bugsByProject };
  }, [allBugs]);

  // total for Bugs by Project (for bottom label)
  const bugsByProjectTotal = bugsByProject.reduce(
    (sum, d) => sum + (d.value || 0),
    0
  );

  // ---------------- render ----------------
  return (
    <div className="min-h-screen relative bg-gradient-to-br from-white via-backgroundAlt to-cardDark overflow-hidden">
      {/* Background decorative blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 rounded-full bg-primaryLight/5 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Greeting */}
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl font-black bg-gradient-to-r from-primary via-accent to-primaryLight bg-clip-text text-transparent">
              👋 Welcome back to Nexus
            </h1>
            <p className="mt-2 text-lg text-textMuted font-medium">
              Here is your dashboard overview. Stay on top of your projects and
              metrics.
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slide-up items-stretch">
            <KpiCard
              title="Total Bugs"
              value={totalBugs}
              Icon={Bug}
              gradientFrom="#FFF1F2"
              gradientTo="#FEE2E2"
              iconBg="#ffffffcc"
              iconColor="#E11D48"
            />
            <KpiCard
              title="Active Users"
              value={totalUsers}
              Icon={UsersIcon}
              gradientFrom="#ECFDF5"
              gradientTo="#D1FAE5"
              iconBg="#ffffffcc"
              iconColor="#059669"
            />
            <KpiCard
              title="Transtracker"
              value={transactionCount}
              Icon={TrendingUp}
              gradientFrom="#FFFBEB"
              gradientTo="#FEF3C7"
              iconBg="#ffffffcc"
              iconColor="#D97706"
            />
            <KpiCard
              title="Security Controls"
              value={securityAlerts}
              Icon={ShieldCheck}
              gradientFrom="#F8FAFC"
              gradientTo="#EEF2F7"
              iconBg="#ffffffcc"
              iconColor="#334155"
            />
          </div>

          {/* NEW Bug overview section: 3 charts like screenshot */}
          <div className="mt-4 mb-8">
            {/* Optional small header row */}
            <div className="flex items-center justify-between mb-4">
              <Typography
                variant="h6"
                className="font-semibold text-slate-800"
              >
                Bug Overview
              </Typography>
            </div>

            {allBugsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-textMuted font-medium animate-pulse">
                  Loading bug overview...
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Bugs by Status - large card */}
                  <Card className="glass-panel h-80 lg:col-span-2">
                    <CardBody className="h-full flex flex-col p-4">
                      <Typography
                        variant="h6"
                        className="mb-4 font-bold text-slate-800 text-base"
                      >
                        Bugs by Status
                      </Typography>
                      <div className="flex-1 min-h-0">
                        {bugsByStatus.length === 0 ? (
                          <div className="text-sm text-textMuted">
                            No bug data to display.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={bugsByStatus}
                              margin={{
                                top: 10,
                                right: 20,
                                left: 60,
                                bottom: 10,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={false}
                                stroke="rgba(209,213,219,0.6)"
                              />
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                width={80}
                              />
                              <Tooltip
                                formatter={(val) => [val, "Bugs"]}
                                contentStyle={{
                                  backgroundColor: "rgba(255,255,255,0.95)",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                }}
                              />
                              <Bar
                                dataKey="value"
                                barSize={24}
                                radius={[6, 6, 6, 6]}
                              >
                                {bugsByStatus.map((entry) => {
                                  let fill = "#F97316"; // default orange
                                  if (entry.name === "Open") fill = "#F59E0B";
                                  else if (entry.name === "In Progress")
                                    fill = "#FDBA74";
                                  else if (entry.name === "Resolved")
                                    fill = "#22C55E";
                                  return (
                                    <Cell key={entry.name} fill={fill} />
                                  );
                                })}
                                <LabelList dataKey="value" position="right" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardBody>
                  </Card>

                  {/* Bugs by Assignee - small card */}
                  <Card className="glass-panel h-80">
                    <CardBody className="h-full flex flex-col p-4">
                      <Typography
                        variant="h6"
                        className="mb-4 font-bold text-slate-800 text-base"
                      >
                        Bugs by Assignee
                      </Typography>
                      <div className="flex-1 min-h-0">
                        {bugsByAssignee.length === 0 ? (
                          <div className="text-sm text-textMuted">
                            No assignee data to display.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={bugsByAssignee}
                              margin={{
                                top: 10,
                                right: 20,
                                left: 60,
                                bottom: 10,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={false}
                                stroke="rgba(209,213,219,0.6)"
                              />
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                width={80}
                              />
                              <Tooltip
                                formatter={(val) => [val, "Bugs"]}
                                contentStyle={{
                                  backgroundColor: "rgba(255,255,255,0.95)",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                }}
                              />
                              <Bar
                                dataKey="value"
                                barSize={22}
                                radius={[6, 6, 6, 6]}
                              >
                                {bugsByAssignee.map((entry, idx) => (
                                  <Cell
                                    key={entry.name}
                                    fill={
                                      donutColors[idx % donutColors.length]
                                    }
                                  />
                                ))}
                                <LabelList dataKey="value" position="right" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </div>

                {/* Bugs by Project - big card like reference image */}
                <div className="mt-6">
                  <Card className="glass-panel h-[420px]">
                    <CardBody className="h-full flex flex-col p-6">
                      <div className="flex items-center justify-between mb-2">
                        <Typography
                          variant="h6"
                          className="font-extrabold text-slate-900 text-lg"
                        >
                          Bugs by Project
                        </Typography>
                      </div>

                      <div className="text-sm font-medium text-slate-700 mb-4">
                        Number of Bugs by Project
                      </div>

                      <div className="flex-1 min-h-0">
                        {bugsByProject.length === 0 ? (
                          <div className="text-sm text-textMuted">
                            No project data to display.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={bugsByProject}
                              margin={{
                                top: 10,
                                right: 24,
                                left: 8,
                                bottom: 40,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="rgba(209,213,219,0.6)"
                              />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11 }}
                                interval={0}
                                angle={-40}
                                textAnchor="end"
                                height={60}
                              />
                              <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip
                                formatter={(val) => [val, "Bugs"]}
                                contentStyle={{
                                  backgroundColor: "rgba(255,255,255,0.95)",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 8,
                                  fontSize: 12,
                                }}
                              />
                              <Bar
                                dataKey="value"
                                barSize={28}
                                radius={[8, 8, 0, 0]}
                              >
                                {bugsByProject.map((entry, idx) => (
                                  <Cell
                                    key={entry.name}
                                    fill={
                                      donutColors[idx % donutColors.length]
                                    }
                                  />
                                ))}
                                <LabelList dataKey="value" position="top" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Bottom axis label + total */}
                      <div className="mt-4 flex flex-col items-center gap-1">
                        <div className="text-xs tracking-[0.2em] text-slate-500 uppercase">
                          Project
                        </div>
                        <div className="text-sm text-slate-800">
                          Total:{" "}
                          <span className="font-bold text-primary">
                            {bugsByProjectTotal}
                          </span>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </>
            )}
          </div>

          {/* Bugs by Priority + Users donut row */}
          <div className="mt-10 grid gap-6 lg:grid-cols-12 items-stretch">
            {/* Left: Bugs by Priority */}
            <Card className="glass-panel trend-card lg:col-span-7 h-full flex flex-col">
              <CardBody className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h6" className="text-primary font-bold">
                    📊 Bugs by Priority
                  </Typography>
                  {/* <div className="px-3 py-1.5 rounded-full border border-borderLight bg-white text-xs font-medium text-textMuted">
                    Bar Chart
                  </div> */}
                </div>

                <div className="mt-5 h-64 md:h-72 lg:h-72">
                  {priorityLoading ? (
                    <p className="text-sm text-textMuted py-8 text-center">
                      Loading chart...
                    </p>
                  ) : (
                    <div className="flex gap-6 items-center h-full">
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: "100%",
                        }}
                      >
                        <ResponsiveContainer width="100%" height={230}>
                          <BarChart
                            data={priorityData}
                            layout="vertical"
                            margin={{
                              top: 10,
                              right: 20,
                              left: 0,
                              bottom: 10,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(209,213,219,0.4)"
                            />
                            <XAxis
                              type="number"
                              allowDecimals={false}
                              domain={[0, "dataMax + 1"]}
                            />
                            <YAxis
                              type="category"
                              dataKey="priority"
                              width={80}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(val) => [val, "Bugs"]}
                              contentStyle={{
                                backgroundColor: "rgba(255,255,255,0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Bar
                              dataKey="count"
                              barSize={20}
                              radius={[8, 8, 8, 8]}
                            >
                              {priorityData.map((entry) => (
                                <Cell
                                  key={entry.priority}
                                  fill={
                                    colorMap[entry.priority] ?? "#A0AEC0"
                                  }
                                />
                              ))}
                              <LabelList dataKey="count" position="right" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ width: 150 }} className="space-y-3">
                        {priorityData.map((d) => (
                          <div
                            key={d.priority}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 3,
                                  display: "inline-block",
                                  backgroundColor:
                                    colorMap[d.priority] || "#A0AEC0",
                                }}
                              />
                              <span className="text-sm text-text font-medium">
                                {d.priority}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-primary">
                              {d.count}
                            </div>
                          </div>
                        ))}

                        <div className="border-t border-borderLight pt-3 mt-3 flex items-center justify-between">
                          <div className="text-sm text-textMuted font-medium">
                            Total
                          </div>
                          <div className="text-sm font-bold text-primary">
                            {totalPriority}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Right: Users donut */}
            <Card className="glass-panel trend-card lg:col-span-5 h-full flex flex-col">
              <CardBody className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h6" className="text-primary font-bold">
                    👥 Users
                  </Typography>
                </div>

                <div className="mt-5 h-64 md:h-72 lg:h-72 flex gap-6 items-center">
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "100%",
                    }}
                    className="flex items-center justify-center overflow-visible"
                  >
                    {userChartLoading ? (
                      <p className="text-sm text-textMuted py-8 text-center">
                        Loading users...
                      </p>
                    ) : userChartData.length === 0 ? (
                      <p className="text-sm text-textMuted py-8 text-center">
                        No user distribution to show.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={userChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            label={false}
                            labelLine={false}
                            isAnimationActive={false}
                            startAngle={0}
                            endAngle={360}
                          >
                            {userChartData.map((entry, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={donutColors[idx % donutColors.length]}
                              />
                            ))}
                          </Pie>

                          <Tooltip
                            formatter={(val, name) => [`${val}`, name]}
                            contentStyle={{
                              backgroundColor: "rgba(255,255,255,0.95)",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div style={{ width: 220 }} className="space-y-3 pr-2">
                    <div className="text-sm text-textMuted font-medium">
                      User distribution
                    </div>

                    {(() => {
                      const total = Math.max(
                        1,
                        userChartData.reduce(
                          (s, d) => s + (d.value || 0),
                          0
                        )
                      );
                      return userChartData.map((d, i) => {
                        const pct = Math.round(
                          ((d.value || 0) / total) * 100
                        );
                        const color = donutColors[i % donutColors.length];
                        return (
                          <div
                            key={d.name}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                style={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: 3,
                                  display: "inline-block",
                                  backgroundColor: color,
                                }}
                                aria-hidden="true"
                              />
                              <div className="flex flex-col">
                                <div className="text-sm text-text font-medium leading-tight">
                                  {d.name}
                                </div>
                                <div className="text-xs text-textMuted -mt-0.5">
                                  {pct}%
                                </div>
                              </div>
                            </div>

                            <div className="text-sm font-bold text-primary">
                              {d.value}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    <div className="border-t border-borderLight pt-3 mt-3 flex items-center justify-between">
                      <div className="text-sm text-textMuted font-medium">
                        Total
                      </div>
                      <div className="text-sm font-bold text-primary">
                        {totalUsersInChart}
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Transtracker Panel */}
          <div className="mt-8">
            <Card className="glass-panel">
              <CardBody>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <Typography variant="h6" className="text-primary">
                      Transtracker
                    </Typography>
                    <div className="text-sm text-textMuted mt-1">
                      Filter by application type, product, owner, SPOC and build
                      date to analyse total open bugs and sign-off status.
                    </div>
                  </div>
                </div>

                {/* Filter bar - dropdowns */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {/* Application Type */}
                  <select
                    value={ttAppType}
                    onChange={(e) => setTtAppType(e.target.value)}
                    className="px-3 py-2 border border-borderLight rounded-lg bg-white min-w-[180px] text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">All Application Types</option>
                    {ttAppTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* Product */}
                  <select
                    value={ttProduct}
                    onChange={(e) => setTtProduct(e.target.value)}
                    className="px-3 py-2 border border-borderLight rounded-lg bg-white min-w-[180px] text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">All Products</option>
                    {ttProductOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* Product Owner */}
                  <select
                    value={ttOwner}
                    onChange={(e) => setTtOwner(e.target.value)}
                    className="px-3 py-2 border border-borderLight rounded-lg bg-white min-w-[180px] text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">All Owners</option>
                    {ttOwnerOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* SPOC */}
                  <select
                    value={ttSpoc}
                    onChange={(e) => setTtSpoc(e.target.value)}
                    className="px-3 py-2 border border-borderLight rounded-lg bg-white min-w-[140px] text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">All SPOCs</option>
                    {ttSpocOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-end gap-2">
                    <label className="flex flex-col text-xs">
                      <span className="text-textMuted font-semibold mb-1">
                        Build From
                      </span>
                      <input
                        type="date"
                        value={ttStart}
                        onChange={(e) => setTtStart(e.target.value)}
                        className="px-3 py-2 border border-borderLight rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                        max={ttEnd || undefined}
                      />
                    </label>
                    <label className="flex flex-col text-xs">
                      <span className="text-textMuted font-semibold mb-1">
                        Build To
                      </span>
                      <input
                        type="date"
                        value={ttEnd}
                        onChange={(e) => setTtEnd(e.target.value)}
                        className="px-3 py-2 border border-borderLight rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                        min={ttStart || undefined}
                      />
                    </label>
                  </div>

                  <select
                    value={ttGroupBy}
                    onChange={(e) => setTtGroupBy(e.target.value)}
                    className="px-3 py-2 border border-borderLight rounded-lg bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    aria-label="Group by"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                </div>

                {/* Only keep validation error like date range */}
                {ttError && (
                  <div className="mb-3 text-xs text-red-500">{ttError}</div>
                )}

                {/* 4-chart grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Application Type Distribution */}
                  <div className="p-4 bg-white rounded-lg shadow-sm min-h-[220px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-text">
                        Application Type Distribution
                      </div>
                    </div>
                    <div className="flex-1">
                      {ttLoading ? (
                        <div className="text-sm text-textMuted">
                          Loading...
                        </div>
                      ) : ttApplicationTypeDistribution.length === 0 ? (
                        <div className="text-sm text-textMuted">No data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={ttApplicationTypeDistribution}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {ttApplicationTypeDistribution.map(
                                (entry, idx) => (
                                  <Cell
                                    key={`app-${idx}`}
                                    fill={
                                      donutColors[idx % donutColors.length]
                                    }
                                  />
                                )
                              )}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(255,255,255,0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Product Segregation */}
                  <div className="p-4 bg-white rounded-lg shadow-sm min-h-[220px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-text">
                        Product Segregation
                      </div>
                    </div>
                    <div className="flex-1">
                      {ttBarLoading ? (
                        <div className="text-sm text-textMuted">
                          Loading...
                        </div>
                      ) : ttOpenByProduct.length === 0 ? (
                        <div className="text-sm text-textMuted">No data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart
                            data={ttOpenByProduct}
                            margin={{
                              top: 10,
                              right: 8,
                              left: 0,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(209,213,219,0.3)"
                            />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              formatter={(val) => [val, "Bugs"]}
                              contentStyle={{
                                backgroundColor: "rgba(255,255,255,0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                              }}
                            />
                            <Bar
                              dataKey="value"
                              barSize={18}
                              radius={[6, 6, 0, 0]}
                            >
                              {ttOpenByProduct.map((entry, idx) => (
                                <Cell
                                  key={`prod-${idx}`}
                                  fill={
                                    donutColors[idx % donutColors.length]
                                  }
                                />
                              ))}
                              <LabelList dataKey="value" position="top" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Sign-Off Status */}
                  <div className="p-4 bg-white rounded-lg shadow-sm min-h-[220px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-text">
                        Sign-Off Status
                      </div>
                    </div>
                    <div className="flex-1">
                      {ttLoading ? (
                        <div className="text-sm text-textMuted">
                          Loading...
                        </div>
                      ) : ttSignoffStatus.length === 0 ? (
                        <div className="text-sm text-textMuted">No data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={ttSignoffStatus}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              labelLine={false}
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {ttSignoffStatus.map((entry, idx) => (
                                <Cell
                                  key={`signoff-${idx}`}
                                  fill={
                                    ["Signed Off", "GO"].includes(entry.name)
                                      ? "#10B981"
                                      : entry.name === "No Go"
                                        ? "#EF4444"
                                        : "#FBBF24"
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val, name) => [`${val}`, name]}
                              contentStyle={{
                                backgroundColor: "rgba(255,255,255,0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Total Open Bugs trend */}
                  <div className="p-4 bg-white rounded-lg shadow-sm min-h-[220px] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-text">
                        Total Open Bugs
                      </div>
                      <div className="text-xs text-textMuted">
                        {ttGroupBy}
                      </div>
                    </div>
                    <div className="flex-1">
                      {ttBarLoading ? (
                        <div className="text-sm text-textMuted">
                          Loading...
                        </div>
                      ) : ttBuildByDateSeries.length === 0 ? (
                        <div className="text-sm text-textMuted">No data</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart
                            data={ttBuildByDateSeries}
                            margin={{
                              top: 6,
                              right: 8,
                              left: 0,
                              bottom: 20,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="rgba(209,213,219,0.3)"
                            />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              formatter={(val) => [val, "Bugs"]}
                              contentStyle={{
                                backgroundColor: "rgba(255,255,255,0.95)",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Build Received → Report Sent slider
                <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-text">
                      Build Received → Report Sent
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={Math.min(ttBuildToReportStats.avgDays || 0, 30)}
                      readOnly
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-textMuted">
                      <span>0 days</span>
                      <span>
                        Average: {ttBuildToReportStats.avgDays} days
                      </span>
                      <span>30+ days</span>
                    </div>
                    <div className="text-xs text-textMuted">
                      {ttBuildToReportStats.completed} of{" "}
                      {ttBuildToReportStats.total} builds (
                      {ttBuildToReportStats.completionRate}%) have reports
                      sent.
                    </div>
                  </div>
                </div> */}

                {/* Table */}
                <div className="mt-6 w-full overflow-x-auto">
                  {ttLoading ? null : paginatedRows.length === 0 ? (
                    <div className="text-sm text-textMuted">No Results.</div>
                  ) : (
                    <div className="w-full">
                      <table className="w-full table-fixed bg-white rounded-lg overflow-hidden">
                        <thead className="bg-slate-50 text-left">
                          <tr>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted w-12">
                              #
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted w-36">
                              Build Date
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              Product
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              Owner
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted w-40">
                              Total Open Bugs
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              Blocker
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              High
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              Medium
                            </th>
                            <th className="px-6 py-3 text-sm font-semibold text-textMuted">
                              Low
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.map((r, idx) => {
                            const globalIndex = ttOffset + idx + 1;
                            return (
                              <tr
                                key={r.id ?? `${globalIndex}`}
                                className="border-t"
                              >
                                <td className="px-6 py-4 text-sm align-top">
                                  {globalIndex}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {formatDateForRow(r)}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.productsegregated ??
                                    r.product ??
                                    r.projects_products ??
                                    "-"}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.productowner ?? r.spoc ?? r.owner ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold align-top">
                                  {r.totalopenbugs ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.blocker ?? r.Blocker ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.high ?? r.High ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.med ?? r.Med ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm align-top">
                                  {r.low ?? r.Low ?? "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={gotoPrevPage}
                      disabled={ttOffset === 0}
                      className={`px-3 py-1 rounded-md text-sm border border-borderLight ${ttOffset === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-backgroundAlt"
                        }`}
                    >
                      {/* Prev */}
                    </button>
                    <div className="text-sm text-textMuted">
                      {/* {currentPage} / {totPagealPages} */}
                    </div>
                    <button
                      onClick={gotoNextPage}
                      disabled={ttOffset + ttLimit >= totalRows}
                      className={`px-3 py-1 rounded-md text-sm border border-borderLight ${ttOffset + ttLimit >= totalRows
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-backgroundAlt"
                        }`}
                    >
                      {/* Next */}
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
