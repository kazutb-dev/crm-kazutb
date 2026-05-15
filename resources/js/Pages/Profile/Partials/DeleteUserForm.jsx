import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
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
        <section className={`space-y-4 ${className}`}>
            <header>
                <h2 className="text-lg font-semibold text-rose-900">
                    Удаление аккаунта
                </h2>

                <p className="mt-1 text-sm leading-6 text-rose-900/75">
                    После удаления аккаунт и все связанные данные будут безвозвратно удалены. Сначала сохраните нужную информацию.
                </p>
            </header>

            <DangerButton onClick={confirmUserDeletion} className="w-full sm:w-auto">
                Удалить аккаунт
            </DangerButton>

            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-5 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Вы действительно хотите удалить аккаунт?
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                        Для подтверждения введите пароль. После удаления восстановить данные будет невозможно.
                    </p>

                    <div className="mt-5">
                        <InputLabel
                            htmlFor="password"
                            value="Пароль"
                            className="sr-only"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="mt-1 block w-full sm:w-3/4"
                            isFocused
                            placeholder="Введите пароль"
                        />

                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <SecondaryButton onClick={closeModal}>
                            Отмена
                        </SecondaryButton>

                        <DangerButton disabled={processing}>
                            Удалить аккаунт
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
