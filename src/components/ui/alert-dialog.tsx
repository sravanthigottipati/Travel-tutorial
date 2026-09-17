import {
  AlertDialog as AlertDialogPrimitive,
  type AlertDialogPortalProps,
  type AlertDialogPopupProps,
  type AlertDialogTitleProps,
  type AlertDialogDescriptionProps,
} from "@base-ui/react/alert-dialog";
import { cn } from "cn";

const AlertDialog = AlertDialogPrimitive.Root;

function AlertDialogPortal({ ...props }: AlertDialogPortalProps) {
  return (
    <AlertDialogPrimitive.Portal {...props}>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      {props.children}
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogPopup({ className, ...props }: AlertDialogPopupProps) {
  return (
    <AlertDialogPrimitive.Popup
      data-slot="alert-dialog-popup"
      className={cn(
        "fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none",
        "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: AlertDialogDescriptionProps) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("mt-1.5 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { AlertDialog, AlertDialogPortal, AlertDialogPopup, AlertDialogTitle, AlertDialogDescription };
