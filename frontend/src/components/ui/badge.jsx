import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-slate-100 text-slate-700",
      scheduled: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
      checked_in: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
      completed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      cancelled: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
      verified: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      pending: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      draft: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      finalized: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
      open: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
    },
    defaultVariants: { variant: "default" },
  },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
