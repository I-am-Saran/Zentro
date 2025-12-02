import { Card, CardBody, Typography } from "@material-tailwind/react";

const colorVariants = {
  slate: {
    bg: "from-slate-100 to-slate-200/60",
    icon: "bg-gradient-to-br from-slate-400 to-slate-600",
    iconText: "text-slate-800",
    accent: "text-slate-800",
    border: "border-slate-300",
  },
  stone: {
    bg: "from-stone-100 to-stone-200/60",
    icon: "bg-gradient-to-br from-stone-400 to-stone-600",
    iconText: "text-stone-800",
    accent: "text-stone-800",
    border: "border-stone-300",
  },
  gray: {
    bg: "from-gray-100 to-gray-200/60",
    icon: "bg-gradient-to-br from-gray-400 to-gray-600",
    iconText: "text-gray-800",
    accent: "text-gray-800",
    border: "border-gray-300",
  },
  rose: {
    bg: "from-rose-100 to-rose-200/60",
    icon: "bg-gradient-to-br from-rose-400 to-rose-600",
    iconText: "text-rose-700",
    accent: "text-rose-700",
    border: "border-rose-300",
  },
  emerald: {
    bg: "from-emerald-100 to-emerald-200/60",
    icon: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    iconText: "text-emerald-700",
    accent: "text-emerald-700",
    border: "border-emerald-300",
  },
  amber: {
    bg: "from-amber-100 to-amber-200/60",
    icon: "bg-gradient-to-br from-amber-400 to-amber-600",
    iconText: "text-amber-700",
    accent: "text-amber-700",
    border: "border-amber-300",
  },
  violet: {
    bg: "from-violet-100 to-violet-200/60",
    icon: "bg-gradient-to-br from-violet-400 to-violet-600",
    iconText: "text-violet-700",
    accent: "text-violet-700",
    border: "border-violet-300",
  },
  blue: {
    bg: "from-blue-100 to-blue-200/60",
    icon: "bg-gradient-to-br from-blue-400 to-blue-600",
    iconText: "text-blue-700",
    accent: "text-blue-700",
    border: "border-blue-300",
  },
  cyan: {
    bg: "from-cyan-100 to-cyan-200/60",
    icon: "bg-gradient-to-br from-cyan-400 to-cyan-600",
    iconText: "text-cyan-700",
    accent: "text-cyan-700",
    border: "border-cyan-300",
  },
};

export default function StatCard({ title, value, icon: Icon, color = "blue", trend, trendUp = true }) {
  const variant = colorVariants[color] || colorVariants.blue;
  
  return (
    <Card className={`group glass-panel trend-card border ${variant.border} bg-gradient-to-br ${variant.bg} overflow-hidden`}>
      <CardBody className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Typography 
              variant="small" 
              className="text-textMuted font-medium uppercase tracking-wide text-xs"
            >
              {title}
            </Typography>
            <Typography 
              variant="h4" 
              className={`mt-3 font-bold ${variant.accent}`}
            >
              {value}
            </Typography>
            {trend && (
              <div className="mt-2 flex items-center gap-1">
                {trendUp ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                )}
                <span className={`text-xs font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}>
                  {trend}
                </span>
              </div>
            )}
          </div>
          <div className={`grid h-14 w-14 place-items-center rounded-xl ${variant.icon} shadow-lg transform transition-transform duration-300 group-hover:scale-110`}>
            {Icon && <Icon className={`h-7 w-7 ${variant.iconText || "text-current"}`} />}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}