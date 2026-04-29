import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    ru: {
        translation: {
            // Welcome page
            'platform': 'Платформа KazUTB',
            'title': 'Единая витрина цифровых сервисов',
            'subtitle': 'Выберите нужный сервис и получите доступ мгновенно: заявки, справки, бронирования, навигация, поддержка и другие цифровые услуги университета.',
            'ai_assistant': 'AI помощник',
            'login': 'Авторизация',
            'for_students_and_staff': 'для студентов и сотрудников',

            // Services
            'tickets': 'Заявки',
            'tickets_desc': 'Service Desk, хозяйственные обращения',
            'docs': 'Справки',
            'docs_desc': 'Запрос и получение документов онлайн',
            'navigation': 'Навигация',
            'navigation_desc': 'Кабинеты, аудитории, маршруты по корпусу',
            'study': 'Учебные',
            'study_desc': 'Расписание, ведомости, успеваемость',
            'schedule': 'Расписание',
            'schedule_desc': 'Все расписания занятий',
            'booking': 'Бронирование',
            'booking_desc': 'Аудитории, переговорки, ресурсы',
            'support': 'Поддержка',
            'support_desc': 'Чат, обращения, статусы выполнения',
            'catalog': 'Сервисы',
            'catalog_desc': 'Каталог цифровых модулей и функций',
            'more': 'Ещё',
            'more_desc': 'Дополнительно: библиотека, AI-сервисы и т.д.',

            // Catalog page
            'additional_services': 'Дополнительные сервисы',
            'catalog_title': 'Дополнительные сервисы',
            'catalog_first_added': 'Первый сервис уже добавлен. Остальные подключу по мере поступления ссылок.',
            'to_main': 'На главную',
            'catalog_draft': 'Каталог (черновик)',
            'ai_tutor': 'AI-tutor',
            'ai_tutor_desc': 'Интеллектуальный помощник для обучения и консультаций',
            'ai_student': 'AI-Student',
            'ai_student_desc': 'Цифровой ассистент студента для учебных задач и вопросов',
            'library': 'KazUTB Library',
            'library_desc': 'Доступ к библиотечным ресурсам и каталогу университета',
            'waiting_links': 'Жду следующие ссылки, добавлю их в этот же раздел.',
            'services_added': 'Сервисов добавлено',
            'updated': 'Обновлено',

            // ChatBot
            'chat_initial_message': 'Привет! Я AI помощник KazUTB. Чем я могу вам помочь?',
            'chat_response': 'Я обрабатываю ваш запрос. Эта функция находится в разработке.',
            'chat_subtitle': 'Сросите о сервисах, справках или расписании',
            'chat_close': 'Закрыть',
            'chat_helper_text': 'Задайте вопрос, и я помогу сориентироваться.',
            'chat_placeholder': 'Вадай вопрос (например: как получить справку?)',
            'chat_send': 'Отправить',

            // Footer
            'copyright': '© KazUTB • 2026',
            'version': 'Версия: 1.0.2',
            'search_placeholder': 'Поиск сервиса (например: справка, расписание, кабинет...)',
        },
    },
    kk: {
        translation: {
            // Welcome page
            'platform': 'KazUTB Платформасы',
            'title': 'Бірыңғай цифрлық қызметтер тор көрсетісі',
            'subtitle': 'Қажетті қызметті таңдап, лезде қолжетімділік аласыз: өтінімдер, анықтамалар, брондау, навигация, қолдау және университеттің басқа да цифрлық қызметтері.',
            'ai_assistant': 'AI көмекші',
            'login': 'Авторизация',
            'for_students_and_staff': 'студенттер мен қызметкерлер үшін',

            // Services
            'tickets': 'Өтінімдер',
            'tickets_desc': 'Service Desk, ұйымдастырушылық өтінімдер',
            'docs': 'Анықтамалар',
            'docs_desc': 'Құжаттарды сұрау және онлайнда алу',
            'navigation': 'Навигация',
            'navigation_desc': 'Кабинеттер, аудиториялар, корпус бойынша маршруттар',
            'study': 'Оқу',
            'study_desc': 'Кесте, сараттар, прогресс',
            'schedule': 'Кесте',
            'schedule_desc': 'Барлық сабақ кестелері',
            'booking': 'Брондау',
            'booking_desc': 'Аудиториялар, переговорлық, ресурстар',
            'support': 'Қолдау',
            'support_desc': 'Чат, өтінімдер, орындау статусы',
            'catalog': 'Қызметтер',
            'catalog_desc': 'Цифрлық модульдер және функциялар каталогы',
            'more': 'Т.б.',
            'more_desc': 'Қосымша: библиотека, AI-қызметтер және т.б.',

            // Catalog page
            'additional_services': 'Қосымша қызметтер',
            'catalog_title': 'Қосымша қызметтер',
            'catalog_first_added': 'Бірінші қызмет已 қосылды. Қалғандарын сілтемелер келген сайын қосамын.',
            'to_main': 'Басты бетке',
            'catalog_draft': 'Каталог (черновик)',
            'ai_tutor': 'AI-tutor',
            'ai_tutor_desc': 'Оқыту мен консультациялау үшін зияткерлік көмекші',
            'ai_student': 'AI-Student',
            'ai_student_desc': 'Студенттің оқу тапсырмалары мен сұрақтары үшін цифрлық ассистенті',
            'library': 'KazUTB Library',
            'library_desc': 'Университеттің библиотека ресурстары және каталогына қолжетімділік',
            'waiting_links': 'Келесі сілтемелерді күтіп отырмын, оларды осы бөліме қосамын.',
            'services_added': 'Қызметтер қосылды',
            'updated': 'Жаңартылды',

            // ChatBot
            'chat_initial_message': 'Сәлем! Мен KazUTB AI көмекшісімін. Сізге қалай көмектесе аламын?',
            'chat_response': 'Сіздің сұрауыңызды өндеуде болмын. Бұл функция қазақта әзірленулі болып тұр.',
            'chat_subtitle': 'Сервистер, анықтамалар немесе кесте туралы сұраңыз',
            'chat_close': 'Жабу',
            'chat_helper_text': 'Сұрақ қойыңыз, мен сізге бағытталуға көмектесемін.',
            'chat_placeholder': 'Сұрақ жазыңыз (мысалы: анықтама қалай алуға болады?)',
            'chat_send': 'Жіберу',

            // Footer
            'copyright': '© KazUTB • 2026',
            'version': 'Нұсқа: 1.0.2',
            'search_placeholder': 'Қызметтерді іздеу (мысал: анықтама, кесте, кабинет...)',
        },
    },
    en: {
        translation: {
            // Welcome page
            'platform': 'KazUTB Platform',
            'title': 'Unified digital services showcase',
            'subtitle': 'Select the service you need and get instant access: requests, certificates, bookings, navigation, support and other university digital services.',
            'ai_assistant': 'AI assistant',
            'login': 'Authorization',
            'for_students_and_staff': 'for students and staff',

            // Services
            'tickets': 'Requests',
            'tickets_desc': 'Service Desk, administrative requests',
            'docs': 'Documents',
            'docs_desc': 'Request and obtain documents online',
            'navigation': 'Navigation',
            'navigation_desc': 'Offices, classrooms, building routes',
            'study': 'Study',
            'study_desc': 'Schedule, grades, progress',
            'schedule': 'Schedule',
            'schedule_desc': 'All class schedules',
            'booking': 'Booking',
            'booking_desc': 'Classrooms, meeting rooms, resources',
            'support': 'Support',
            'support_desc': 'Chat, requests, completion status',
            'catalog': 'Services',
            'catalog_desc': 'Catalog of digital modules and functions',
            'more': 'More',
            'more_desc': 'Additional: library, AI services, etc.',

            // Catalog page
            'additional_services': 'Additional services',
            'catalog_title': 'Additional services',
            'catalog_first_added': 'First service already added. More coming as links arrive.',
            'to_main': 'To main',
            'catalog_draft': 'Catalog (draft)',
            'ai_tutor': 'AI-tutor',
            'ai_tutor_desc': 'Intelligent assistant for learning and consultations',
            'ai_student': 'AI-Student',
            'ai_student_desc': 'Digital student assistant for learning tasks and questions',
            'library': 'KazUTB Library',
            'library_desc': 'Access to university library resources and catalog',
            'waiting_links': 'Waiting for more links to add to this section.',
            'services_added': 'Services added',
            'updated': 'Updated',

            // ChatBot
            'chat_initial_message': 'Hello! I\'m KazUTB AI Assistant. How can I help you?',
            'chat_response': 'I\'m processing your request. This feature is under development.',
            'chat_subtitle': 'Ask about services, documents or schedule',
            'chat_close': 'Close',
            'chat_helper_text': 'Ask a question, and I will help you navigate.',
            'chat_placeholder': 'Ask a question (e.g. how to get a certificate?)',
            'chat_send': 'Send',

            // Footer
            'copyright': '© KazUTB • 2026',
            'version': 'Version: 1.0.2',
            'search_placeholder': 'Search service (e.g. certificate, schedule, classroom...)',
        },
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'ru',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            localStorageKey: 'lang',
        },
    });

export default i18n;
