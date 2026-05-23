import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from './dialog';
import { Button } from './button';

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  itemLabel: string;
  itemName: string;
  itemIcon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = '¿Eliminar este dato?',
  description = 'Esta acción no se puede deshacer. El registro se eliminará de forma permanente.',
  itemLabel,
  itemName,
  itemIcon,
  confirmLabel = 'Sí, eliminar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(560px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 text-center">
        <div className="px-6 pb-5 pt-8 sm:px-8">
          <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <span className="absolute -left-3 top-8 h-2 w-2 rounded-full bg-[var(--primary)]" />
            <span className="absolute -right-2 top-7 h-2 w-2 rounded-full bg-red-500" />
            <span className="absolute bottom-5 left-0 h-1.5 w-1.5 rounded-full bg-red-400" />
            <span className="absolute bottom-7 right-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            <Trash2 size={38} strokeWidth={2.4} />
          </div>

          <h2 className="text-2xl font-bold leading-tight text-[var(--app-strong)]">{title}</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--app-muted)]">{description}</p>

          <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-4 py-3 text-sm text-[var(--app-muted)]">
            {itemIcon ? <span className="flex h-7 w-7 shrink-0 items-center justify-center">{itemIcon}</span> : null}
            <span className="min-w-0 truncate">
              <strong className="font-semibold text-[var(--app-strong)]">{itemLabel}:</strong> {itemName}
            </span>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 gap-3 border-t border-[var(--app-line)] px-6 py-5 sm:grid-cols-2 sm:px-8">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="h-12 border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm()}
            className="h-12 bg-gradient-to-r from-[#ff7a1a] to-[#ff4b00] text-white shadow-[0_14px_28px_rgb(255_90_10_/_24%)] hover:opacity-95"
          >
            {loading ? 'Eliminando...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
