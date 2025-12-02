import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import Button from "./ui/Button";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  confirmText = "Confirm",
  onConfirm,
  variant = "default",
}) {
  const isModern = variant === "modern";

  return (
    <Dialog open={open} handler={onClose} dismiss={{ enabled: true }} className="z-50">
      {title && (
        <DialogHeader
          className={
            isModern
              ? "rounded-t-xl px-6 py-4 bg-gradient-to-r from-[#445A4A] to-[#5E806E] text-white flex items-center gap-3"
              : "text-lg text-primary"
          }
        >
          {icon && <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20">{icon}</span>}
          <div className="flex flex-col">
            <span className={isModern ? "text-white text-base sm:text-lg font-semibold" : "text-primary"}>{title}</span>
            {subtitle && isModern && (
              <span className="text-xs sm:text-sm text-white/80 font-normal">{subtitle}</span>
            )}
          </div>
        </DialogHeader>
      )}
      <DialogBody
        className={
          isModern
            ? "w-full max-h-[80vh] overflow-y-auto bg-transparent px-6 pt-6 text-gray-800"
            : "w-full mx-4 max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl bg-white p-6 text-gray-800"
        }
      >
        {children}
      </DialogBody>
      <DialogFooter className={isModern ? "gap-2 px-6 pb-6 bg-transparent" : "gap-2 px-6 pb-6"}>
        <Button variant={isModern ? "secondary" : "secondary"} onClick={onClose}>Cancel</Button>
        <Button variant={isModern ? "primary" : "primary"} onClick={onConfirm || onClose}>{confirmText}</Button>
      </DialogFooter>
    </Dialog>
  );
}