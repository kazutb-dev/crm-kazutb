# CRM KazUTB

## О проекте
CRM система для автоматизации работы сотрудников и студентов университета КазУТБ. Позволяет управлять расписанием, учет рабочего времени, данными по студентам, доступом к аналитике и взаимодействию между отделами.

---

## Функционал
- Регистрация и аутентификация пользователей
- Управление данными студентов и сотрудников
- Учёт рабочего времени (таймтрекер)
- Ведение отчётности и аналитики
- Управление событиями и уведомлениями
- Гибкая ролевая модель

---

## Как запустить проект

1. Клонируйте репозиторий:
		```bash
		git clone https://github.com/kazutb-dev/crm-kazutb.git
		cd crm-kazutb
		```

2. Скопируйте пример переменных окружения:
		```bash
		cp .env.example .env
		```

3. Установите зависимости:
		```bash
		composer install
		npm install
		```

4. Сгенерируйте ключ приложения:
		```bash
		php artisan key:generate
		```

5. Примените миграции и (опционно) сиды:
		```bash
		php artisan migrate
		php artisan db:seed
		```

6. Соберите фронтенд и запустите сервер разработки:
		```bash
		npm run dev
		php artisan serve
		```

---

## Переменные окружения (.env)

Минимально необходимые параметры:
```env
APP_NAME=CRM KazUTB
APP_ENV=local
APP_KEY=
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=crm_db
DB_USERNAME=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASS
```
**(Остальные — по образцу файла `.env.example`)**

---

## Быстрый старт для нового разработчика

- Клонируй репозиторий, создай .env, установи все зависимости.
- Спроси у тимлида доступ к БД и необходимым сервисам.
- Миграции и сиды — только через artisan.
- Вопросы или проблемы — см. Контакты.

---

## FAQ и типовые проблемы

- **Порт 8000 занят:**  
	Измени порт через `php artisan serve --port=XXXX`
- **Нет доступа к БД:**  
	Запроси права у @aulykpan
- **Не собирается фронт:**  
	Проверь версию Node.js и npm

---

## Статус проекта
В активной разработке

---

## Контакты
- Руководитель / мейнтейнер: @aulykpan (Telegram: @aulykpan)
- Команда: @almasmurat, @admaza

---

## Как предлагать изменения (Contributing)
1. Форкни проект, создай новую ветку от main
2. Сделай свои изменения с подробным описанием
3. Открывай pull request, укажи, какие задачи решаешь
4. Жди ревью и либо исправляй замечания, либо получай апрув!

---

## Лицензия
Проект распространяется под лицензией MIT.

---

## Спонсоры и упоминания
DevSquad, Redberry, Active Logic

---

Если появятся вопросы по запуску — обращайтесь к контакту из раздела "Контакты".
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
