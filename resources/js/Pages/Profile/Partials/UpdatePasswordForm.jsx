import TextInput from '@/Components/TextInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { useRef } from 'react';

function FieldError({ message }) {
    return message ? <p className="mt-1.5 text-sm text-red-700">{message}</p> : null;
}

export default function UpdatePasswordForm({ className = '', showHeader = true, compact = false }) {
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            {showHeader && (
                <header className="flex items-start gap-3 border-b border-slate-200 pb-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-teal-50 text-teal-700">
                        <KeyRound className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className={`font-display font-bold text-[#102945] ${compact ? 'text-base' : 'text-lg'}`}>
                            Сменить пароль
                        </h2>

                        <p className={`mt-1 text-sm leading-6 text-slate-600 ${compact ? 'max-w-xl' : ''}`}>
                            Используйте длинный и уникальный пароль для повышения безопасности аккаунта.
                        </p>
                    </div>
                </header>
            )}

            <form onSubmit={updatePassword} className={`${showHeader ? 'mt-5' : ''} space-y-5`}>
                <div className="space-y-2">
                    <Label htmlFor="current_password" className="block">Текущий пароль</Label>

                    <TextInput
                        id="current_password"
                        ref={currentPasswordInput}
                        value={data.current_password}
                        onChange={(e) =>
                            setData('current_password', e.target.value)
                        }
                        type="password"
                        className="block w-full"
                        autoComplete="current-password"
                    />

                    <FieldError message={errors.current_password} />
                </div>

                <div className={`grid gap-5 ${compact ? '' : 'md:grid-cols-2'}`}>
                    <div className="space-y-2">
                        <Label htmlFor="password" className="block">Новый пароль</Label>

                        <TextInput
                            id="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            type="password"
                            className="block w-full"
                            autoComplete="new-password"
                        />

                        <FieldError message={errors.password} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password_confirmation" className="block">Повторите пароль</Label>

                        <TextInput
                            id="password_confirmation"
                            value={data.password_confirmation}
                            onChange={(e) =>
                                setData('password_confirmation', e.target.value)
                            }
                            type="password"
                            className="block w-full"
                            autoComplete="new-password"
                        />

                        <FieldError message={errors.password_confirmation} />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-5">
                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm font-medium text-emerald-700">Сохранено.</p>
                    </Transition>

                    <Button type="submit" disabled={processing}>Сохранить</Button>
                </div>
            </form>
        </section>
    );
}
