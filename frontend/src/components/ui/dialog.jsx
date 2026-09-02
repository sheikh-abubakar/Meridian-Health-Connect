import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, ...props }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px]" />
    <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border bg-white p-4 shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:p-6", className)} {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm bg-white/90 p-1 text-slate-500 backdrop-blur hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-ring"><X className="size-4" /><span className="sr-only">Close</span></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
}
export function DialogHeader({ className, ...props }) { return <div className={cn("flex flex-col space-y-1.5 pr-7 text-left", className)} {...props} />; }
export function DialogTitle({ className, ...props }) { return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />; }
export function DialogDescription({ className, ...props }) { return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />; }
export function DialogFooter({ className, ...props }) { return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />; }
