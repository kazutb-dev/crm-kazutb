import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Reusable confirmation dialog backed by shadcn AlertDialog.
 *
 * Props:
 *   open         – boolean, controlled open state
 *   onOpenChange – (open: boolean) => void
 *   title        – dialog heading (default: "Подтвердите действие")
 *   description  – body text   (default: "Вы уверены?")
 *   confirmLabel – action button label (default: "Удалить")
 *   cancelLabel  – cancel button label (default: "Отмена")
 *   onConfirm    – () => void, called when user presses confirm
 *   destructive  – boolean, applies destructive variant to confirm button
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title = 'Подтвердите действие',
    description = 'Вы уверены? Это действие нельзя отменить.',
    confirmLabel = 'Удалить',
    cancelLabel = 'Отмена',
    onConfirm,
    destructive = true,
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
