import { cn } from "../../lib/utils";

export const Dialog = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="absolute inset-0"
        onClick={() => onOpenChange && onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
};

export const DialogContent = ({ className, children }) => (
  <div className={cn("shad-dialog rounded-lg border p-6", className)}>{children}</div>
);

export const DialogHeader = ({ className, children }) => (
  <div className={cn("mb-4 space-y-3", className)}>{children}</div>
);

export const DialogTitle = ({ className, children }) => (
  <h2 className={cn("text-18-bold", className)}>{children}</h2>
);

export const DialogDescription = ({ className, children }) => (
  <p className={cn("text-14-regular text-dark-700", className)}>{children}</p>
);

export const DialogFooter = ({ className, children }) => (
  <div className={cn("mt-4", className)}>{children}</div>
);
