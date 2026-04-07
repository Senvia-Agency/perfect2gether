import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const dialogContentVariants = {
  default: "pointer-events-auto fixed left-1/2 -translate-x-1/2 z-50 grid w-full max-w-lg max-w-[calc(100vw-2rem)] h-auto overflow-y-auto gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg top-[calc(3.5rem+env(safe-area-inset-top,0px)+1rem)] bottom-auto max-h-[calc(100vh-3.5rem-env(safe-area-inset-top,0px)-2rem)] sm:top-[50%] sm:-translate-y-[50%] sm:max-h-[calc(100vh-2rem)]",
  fullScreen: "pointer-events-auto fixed z-50 w-full max-w-none bg-background p-4 md:p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top,0px))] h-[calc(100vh-3.5rem-env(safe-area-inset-top,0px))] pb-safe md:top-0 md:h-full md:left-64 md:w-[calc(100%-16rem)] flex flex-col overflow-hidden",
};

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  variant?: keyof typeof dialogContentVariants;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(({
  className,
  children,
  variant = "default",
  ...props
}, ref) => <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content 
      ref={ref} 
      onOpenAutoFocus={(e) => {
        if (window.matchMedia('(max-width: 768px)').matches) {
          e.preventDefault();
        }
      }}
      onPointerDownOutside={(e) => {
        const target = e.target as HTMLElement;
        if (target?.closest?.("[data-otto-fab]")) {
          e.preventDefault();
        }
      }}
      className={cn(dialogContentVariants[variant], className)}
      {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-safe rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>);
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("flex flex-col space-y-1.5 text-center sm:text-left pr-10", className)} {...props} />);
DialogHeader.displayName = "DialogHeader";
const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  className,
  ...props
}, ref) => <div ref={ref} className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />);
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />);
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({
  className,
  ...props
}, ref) => <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />);
DialogDescription.displayName = DialogPrimitive.Description.displayName;
export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };