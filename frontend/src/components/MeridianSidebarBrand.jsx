import { Building2 } from "lucide-react";

export function MeridianSidebarBrand() {
  return <div className="flex h-[76px] items-center gap-3.5 border-b border-white/[.08] px-4">
    <div className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/20 bg-white/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_10px_28px_rgba(13,148,136,.18)] backdrop-blur-xl"><div className="absolute inset-1 rounded-lg bg-gradient-to-br from-teal-300/30 via-teal-500/25 to-cyan-700/20" /><div className="relative grid size-7 place-items-center rounded-lg border border-teal-200/30 bg-teal-400/15 text-teal-50"><Building2 className="size-4" strokeWidth={2.2} /></div><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-teal-200 shadow-[0_0_8px_rgba(153,246,228,.9)]" /></div>
    <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight text-white">Meridian Health</p><p className="mt-0.5 truncate text-[11px] text-slate-400">Connected clinical operations</p></div>
  </div>;
}

export function SidebarUserCard({ user, roleLabel }) {
  return <div className="border-t border-white/[.08] p-3"><div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.035] p-3"><div className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-xs font-bold text-white shadow-lg shadow-teal-950/20">{user.name?.trim()?.charAt(0)?.toUpperCase() || "M"}<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">{user.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{roleLabel}</p></div></div></div>;
}
