"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internal;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!isControlled) setInternal(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange]
  );
  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("DialogTrigger must be used within Dialog");
  const handleClick = (e: React.MouseEvent) => {
    children.props.onClick?.(e);
    ctx.setOpen(true);
  };
  if (asChild) {
    return React.cloneElement(children, { onClick: handleClick });
  }
  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("DialogContent must be used within Dialog");
  if (!ctx.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg",
          className
        )}
      >
        <button
          type="button"
          onClick={() => ctx.setOpen(false)}
          className="absolute right-3 top-3 rounded-sm p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pr-6", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within Dialog");
  return ctx;
}
