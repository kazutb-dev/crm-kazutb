import TextInput from '@/Components/TextInput';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { Trash2, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';

export default function DeleteUserForm({ className = '' }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`rounded-[14px] border border-red-200 bg-red-50 px-5 py-4 ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-red-100 text-red-700">
                        <TriangleAlert className="h-4 w-4" />
                    </span>
                    <header>
                        <h2 className="font-display text-base font-bold text-red-800">
                            Удаление аккаунта
                        </h2>

                        <p className="mt-0.5 max-w-3xl text-sm text-slate-700">
                            После удаления аккаунт и все связанные данные будут безвозвратно удалены. Сначала сохраните нужную информацию.
                        </p>
                    </header>
                </div>

                <Button type="button" variant="destructive" onClick={confirmUserDeletion} className="w-full shrink-0 sm:w-auto">
                    <Trash2 />
                    Удалить аккаунт
                </Button>
            </div>

            <Dialog open={confirmingUserDeletion} onOpenChange={(open) => { if (!open) closeModal(); }}>
                <DialogContent className="sm:max-w-lg">
                    <form onSubmit={deleteUser} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>Вы действительно хотите удалить аккаунт?</DialogTitle>
                            <DialogDescription>
                                Для подтверждения введите пароль. После удаления восстановить данные будет невозможно.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="sr-only">Пароль</Label>

                            <TextInput
                                id="password"
                                type="password"
                                name="password"
                                ref={passwordInput}
                                value={data.password}
                                onChange={(e) =>
                                    setData('password', e.target.value)
                                }
                                className="block w-full"
                                isFocused
                                placeholder="Введите пароль"
                            />

                            {errors.password && <p className="text-sm text-red-700">{errors.password}</p>}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeModal}>
                                Отмена
                            </Button>

                            <Button type="submit" variant="destructive" disabled={processing}>
                                Удалить аккаунт
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
