import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }) {
  return <textarea className={cn("flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700", className)} {...props} />;
}

