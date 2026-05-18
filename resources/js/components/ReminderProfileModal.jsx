import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ReminderProfileModal({ open, onClose, goToProfile }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Заполните профиль</DialogTitle>
          <DialogDescription>
            Для корректной работы KPI системы необходимо указать факультет и кафедру.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              onClose();
              goToProfile();
            }}
          >
            Перейти в профиль
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Напомнить позже
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}