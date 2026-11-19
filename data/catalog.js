/* Каталог інтерактивних практичних завдань.
   Щоб додати завдання: створіть HTML-файл у папці предмета й додайте сюди запис у `items`.
   Поля запису:
     id        — унікальний ідентифікатор (той самий передається в TaskRuntime.start на сторінці завдання)
     folder    — id папки з `folders`
     order     — порядковий номер у папці (від простішого до складнішого)
     title     — назва
     summary   — короткий опис (можна HTML)
     file      — шлях до сторінки від кореня репозиторію
     tags      — масив id тегів із `tags`
     level     — 1 початковий · 2 середній · 3 складний
     needs     — 'browser' (усе в браузері), 'illustrator' (робота в програмі + перевірка файлу)
                 'word' (робота в текстовому редакторі), 'access' (робота в Microsoft Access)
                 або 'own-pc' (учень досліджує свій комп’ютер з Windows)
     duration  — орієнтовний час */
window.CATALOG = {
  folders: [
    {
      id: 'adobe-illustrator',
      title: 'Adobe Illustrator',
      icon: 'Ai',
      description: 'Векторна графіка: вектор і растр, інтерфейс, документ і колір, фігури, Shape Builder, Pathfinder, Pen Tool, експорт.'
    },
    {
      id: 'html',
      title: 'HTML',
      icon: '</>',
      description: 'Основи вебсторінок: теги та вкладеність, структура сторінки, абзаци й списки, заголовки, атрибути, посилання, зображення.'
    },
    {
      id: 'pc-architecture',
      title: 'Архітектура ПК',
      icon: 'PC',
      description: 'Будова комп’ютера: типи ПК, процесор, оперативна пам’ять, накопичувачі, материнська плата, блок живлення, відеокарта, складання й діагностика.'
    },
    {
      id: 'word',
      title: 'Текстові документи (Word)',
      icon: 'W',
      description: 'Опрацювання текстів: системи й об’єкти документа, формати файлів, режими перегляду, колонтитули, стовпці й розділи, багаторівневі списки, символи й формули.'
    },
    {
      id: 'database',
      title: 'Бази даних (SQL, Access)',
      icon: 'DB',
      description: 'Основні поняття баз даних, перші SQL-запити SELECT … WHERE, таблиці й типи даних в Access, ключі, зв’язки та імпорт з Excel.'
    }
  ],

  tags: {
    'vector-raster': 'вектор і растр',
    'interface': 'інтерфейс',
    'hotkeys': 'гарячі клавіші',
    'document': 'новий документ',
    'color': 'RGB і CMYK',
    'export': 'збереження й експорт',
    'shapes': 'фігури',
    'fill-stroke': 'заливка й обведення',
    'align': 'вирівнювання',
    'shape-builder': 'Shape Builder',
    'pathfinder': 'Pathfinder',
    'pen-tool': 'Pen Tool',
    'direct-selection': 'біла стрілка',
    'drawing': 'малюнок',
    'creative': 'творче завдання',
    'real-app': 'робота в Illustrator',
    'quiz': 'вибір відповіді',
    'html-tags': 'теги',
    'html-nesting': 'вкладеність',
    'html-structure': 'структура сторінки',
    'html-text': 'абзаци й списки',
    'html-headings': 'заголовки',
    'html-attributes': 'атрибути',
    'html-links': 'посилання',
    'html-images': 'зображення',
    'code-editor': 'пишемо код',
    'pc-types': 'типи комп’ютерів',
    'pc-assembly': 'складання ПК',
    'diagnostics': 'діагностика',
    'cpu': 'процесор',
    'ram': 'оперативна пам’ять',
    'storage': 'накопичувачі',
    'motherboard': 'материнська плата',
    'psu': 'блок живлення',
    'gpu': 'відеокарта',
    'compatibility': 'сумісність',
    'my-pc': 'мій комп’ютер',
    'simulator': 'симулятор',
    'calculation': 'розрахунки',
    'text-systems': 'системи опрацювання текстів',
    'doc-objects': 'об’єкти документа',
    'file-formats': 'формати файлів',
    'views': 'режими перегляду',
    'headers-footers': 'колонтитули',
    'columns-sections': 'стовпці й розділи',
    'lists': 'списки',
    'symbols-formulas': 'символи й формули',
    'word-app': 'робота у Word',
    'db-basics': 'основні поняття БД',
    'sql': 'SQL',
    'select': 'SELECT … WHERE',
    'data-types': 'типи даних',
    'keys-relations': 'ключі й зв’язки',
    'import': 'імпорт з Excel',
    'access-app': 'робота в Access'
  },

  items: [
    {
      id: 'illustrator-01', folder: 'adobe-illustrator', order: 1,
      title: 'Вектор чи растр?',
      summary: 'Збільшуй зображення повзунком і визнач, яке з них векторне, а яке — растрове.',
      file: 'lessons/adobe-illustrator/01-vector-or-raster.html',
      tags: ['vector-raster', 'quiz'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'illustrator-02', folder: 'adobe-illustrator', order: 2,
      title: 'Гарячі клавіші',
      summary: 'Натискай на клавіатурі правильну клавішу для кожного інструмента чи дії.',
      file: 'lessons/adobe-illustrator/02-hotkeys.html',
      tags: ['hotkeys', 'interface'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'illustrator-03', folder: 'adobe-illustrator', order: 3,
      title: 'Знайди інструмент',
      summary: 'Клікай на потрібні інструменти, панелі й меню в макеті інтерфейсу Illustrator.',
      file: 'lessons/adobe-illustrator/03-find-the-tool.html',
      tags: ['interface'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'illustrator-04', folder: 'adobe-illustrator', order: 4,
      title: 'Малюємо числами',
      summary: 'Намалюй три фігури, змінюючи лише числа (координати, розміри, колір) — так «думає» векторна програма.',
      file: 'lessons/adobe-illustrator/04-draw-with-numbers.html',
      tags: ['vector-raster', 'shapes'], level: 1, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'illustrator-05', folder: 'adobe-illustrator', order: 5,
      title: 'Налаштуй документ',
      summary: 'Створи правильний новий документ для п’яти різних замовлень: одиниці, розмір, колірний режим, роздільна здатність, виліт.',
      file: 'lessons/adobe-illustrator/05-document-setup.html',
      tags: ['document', 'color'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'illustrator-06', folder: 'adobe-illustrator', order: 6,
      title: 'Куди відправимо файл?',
      summary: 'Для кожного замовлення обери формат файлу, колірний режим і команду збереження чи експорту.',
      file: 'lessons/adobe-illustrator/06-where-to-send-the-file.html',
      tags: ['export', 'color', 'quiz'], level: 2, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'illustrator-07', folder: 'adobe-illustrator', order: 7,
      title: 'Мій перший документ: A4 у CMYK',
      summary: 'В Adobe Illustrator створи документ A4 у CMYK, намалюй фігуру й збережи PDF. Сторінка сама перевірить файл.',
      file: 'lessons/adobe-illustrator/07-first-document.html',
      tags: ['real-app', 'document', 'color', 'export'], level: 1, needs: 'illustrator', duration: '10 хв'
    },
    {
      id: 'illustrator-08', folder: 'adobe-illustrator', order: 8,
      title: 'Збери з фігур',
      summary: 'Три малюнки з прямокутників і еліпсів у міні-Illustrator: сонце, світлофор, сніговик. Shift, Alt, порядок, вирівнювання, групування.',
      file: 'lessons/adobe-illustrator/08-build-from-shapes.html',
      tags: ['shapes', 'align', 'fill-stroke', 'drawing'], level: 2, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'illustrator-09', folder: 'adobe-illustrator', order: 9,
      title: 'Світлофор: фігури точних розмірів',
      summary: 'В Adobe Illustrator намалюй світлофор 100 × 100 мм у CMYK: корпус, три кола, заливка, обведення, вирівнювання. Перевір PDF на сторінці.',
      file: 'lessons/adobe-illustrator/09-traffic-light-pdf.html',
      tags: ['real-app', 'shapes', 'fill-stroke', 'align'], level: 2, needs: 'illustrator', duration: '15 хв'
    },
    {
      id: 'illustrator-10', folder: 'adobe-illustrator', order: 10,
      title: 'Світлофор для сайту: SVG',
      summary: 'Перенеси світлофор у вебдокумент 800 × 600 px (RGB) і експортуй SVG з монтажною областю. Сторінка перевірить файл.',
      file: 'lessons/adobe-illustrator/10-traffic-light-svg.html',
      tags: ['real-app', 'export', 'color', 'document'], level: 2, needs: 'illustrator', duration: '10 хв'
    },
    {
      id: 'illustrator-11', folder: 'adobe-illustrator', order: 11,
      title: 'Shape Builder: пазли',
      summary: 'Вісім пазлів: спершу лише видаляєш або лише об’єднуєш ділянки, потім — і те, й інше (кіт, ключ, навісний замок).',
      file: 'lessons/adobe-illustrator/11-shape-builder-puzzles.html',
      tags: ['shape-builder', 'shapes'], level: 2, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'illustrator-12', folder: 'adobe-illustrator', order: 12,
      title: 'Перо 1: кліки й криві',
      summary: 'Сім рівнів Pen Tool без Alt: трикутник, блискавка, арка, хвиля, купол, крапля, серпик.',
      file: 'lessons/adobe-illustrator/12-pen-clicks-and-curves.html',
      tags: ['pen-tool'], level: 2, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'illustrator-13', folder: 'adobe-illustrator', order: 13,
      title: 'Перо 2: Alt — ламаємо ручку',
      summary: 'П’ять рівнів Pen Tool: там, де ручка тягне лінію не туди, її треба зламати клавішею Alt.',
      file: 'lessons/adobe-illustrator/13-pen-break-handle.html',
      tags: ['pen-tool'], level: 3, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'illustrator-14', folder: 'adobe-illustrator', order: 14,
      title: 'Полагодь контур',
      summary: 'Білою стрілкою (A) перетягуй точки й ручки, щоб контур ліг точно на пунктирний зразок.',
      file: 'lessons/adobe-illustrator/14-fix-the-path.html',
      tags: ['direct-selection', 'pen-tool'], level: 3, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'illustrator-15', folder: 'adobe-illustrator', order: 15,
      title: '8 вправ: по одній на інструмент',
      summary: 'Фігури, чорна й біла стрілки, перо (прямі та Alt), заливка й обведення, Shape Builder, Pathfinder, вирівнювання.',
      file: 'lessons/adobe-illustrator/15-eight-tool-drills.html',
      tags: ['shapes', 'direct-selection', 'pen-tool', 'fill-stroke', 'shape-builder', 'pathfinder', 'align'], level: 3, needs: 'browser', duration: '25 хв'
    },
    {
      id: 'illustrator-16', folder: 'adobe-illustrator', order: 16,
      title: 'За інструкцією: морозиво, мухомор, кит',
      summary: 'Три малюнки з підказками на полотні. Кожен поєднує кілька інструментів: перо, фігури, кольори, Shape Builder, вирівнювання, порядок і групування.',
      file: 'lessons/adobe-illustrator/16-guided-drawings.html',
      tags: ['drawing', 'pen-tool', 'shapes', 'shape-builder', 'align', 'fill-stroke'], level: 3, needs: 'browser', duration: '30 хв'
    },
    {
      id: 'illustrator-17', folder: 'adobe-illustrator', order: 17,
      title: 'Без підказок: обери малюнок',
      summary: 'Хмарка з дощем, чашка кави або лампочка. Лише зразок і вимоги — інструменти й спосіб обираєш сам(-а).',
      file: 'lessons/adobe-illustrator/17-drawing-without-hints.html',
      tags: ['drawing', 'pen-tool', 'shapes', 'pathfinder'], level: 3, needs: 'browser', duration: '25 хв'
    },
    {
      id: 'illustrator-18', folder: 'adobe-illustrator', order: 18,
      title: 'Моя іконка',
      summary: 'Власна іконка на будь-яку тему всіма інструментами: щонайменше 4 об’єкти, крива пером, 2 кольори, усе згруповано.',
      file: 'lessons/adobe-illustrator/18-my-icon.html',
      tags: ['creative', 'drawing', 'pen-tool'], level: 3, needs: 'browser', duration: '30 хв'
    },
    {
      id: 'html-01', folder: 'html', order: 1,
      title: 'Правильний тег чи помилка?',
      summary: 'Розклади картки по кошиках: тег записано правильно чи з помилкою. Після перевірки під кожною карткою — пояснення.',
      file: 'lessons/html/01-tag-or-mistake.html',
      tags: ['html-tags', 'quiz'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'html-02', folder: 'html', order: 2,
      title: 'Збери абзац',
      summary: 'Перетягуй блоки, щоб зібрати абзаци з жирним текстом. Праворуч одразу видно результат у браузері.',
      file: 'lessons/html/02-build-a-paragraph.html',
      tags: ['html-nesting', 'html-tags', 'html-text'], level: 1, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'html-03', folder: 'html', order: 3,
      title: 'Збери сторінку',
      summary: 'Склади правильний «скелет» HTML-сторінки з блоків: doctype, html, head, title, body. Деякі блоки — зайві!',
      file: 'lessons/html/03-build-a-page.html',
      tags: ['html-structure', 'html-nesting'], level: 1, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'html-04', folder: 'html', order: 4,
      title: 'Сторінка зі списком',
      summary: 'Додай у готовий «скелет» абзаци та списки: список покупок і рецепт.',
      file: 'lessons/html/04-page-with-lists.html',
      tags: ['html-text', 'html-structure'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'html-05', folder: 'html', order: 5,
      title: 'Збери статтю із заголовками',
      summary: 'Два рівні: збирай статті із заголовками h1–h6 з блоків. У другому рівні є блоки-пастки.',
      file: 'lessons/html/05-article-with-headings.html',
      tags: ['html-headings', 'html-structure'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'html-06', folder: 'html', order: 6,
      title: 'Правильний атрибут чи помилка?',
      summary: 'Розклади картки: атрибут записано правильно чи з помилкою (лапки, знак =, пробіли, назви атрибутів).',
      file: 'lessons/html/06-attribute-or-mistake.html',
      tags: ['html-attributes', 'quiz'], level: 2, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'html-07', folder: 'html', order: 7,
      title: 'Сторінка «Про мене»',
      summary: 'Напиши код сторінки сам(-а): структура, заголовок, абзаци, жирний текст, список. Праворуч — живий результат і список вимог.',
      file: 'lessons/html/07-about-me-page.html',
      tags: ['code-editor', 'html-structure', 'html-text'], level: 2, needs: 'browser', duration: '20 хв'
    },
    {
      id: 'html-08', folder: 'html', order: 8,
      title: 'Атрибути в дії',
      summary: 'Рівень 1 — допиши значення id, щоб запрацювало меню сторінки. Рівень 2 — знайди й виправ 4 помилки в атрибутах.',
      file: 'lessons/html/08-attributes-in-action.html',
      tags: ['html-attributes', 'html-links'], level: 2, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'html-09', folder: 'html', order: 9,
      title: 'Майстерня посилань',
      summary: 'Три рівні: збери посилання з блоків → допиши адреси різних типів → полагодь зламані посилання.',
      file: 'lessons/html/09-links-workshop.html',
      tags: ['html-links', 'html-attributes'], level: 3, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'html-10', folder: 'html', order: 10,
      title: 'Майстерня зображень',
      summary: 'Три рівні: додай зображення з атрибутами → напиши правильні шляхи до файлів у різних папках → збери картинку-посилання.',
      file: 'lessons/html/10-images-workshop.html',
      tags: ['html-images', 'html-attributes', 'html-links'], level: 3, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'html-11', folder: 'html', order: 11,
      title: 'Сторінка-запрошення',
      summary: 'Напиши сторінку-запрошення з нуля: заголовки з id, абзаци, зображення, зовнішнє й внутрішнє посилання. 10 вимог і живий результат.',
      file: 'lessons/html/11-invitation-page.html',
      tags: ['code-editor', 'creative', 'html-headings', 'html-links', 'html-images', 'html-attributes'], level: 3, needs: 'browser', duration: '30 хв'
    },
    {
      id: 'pc-01', folder: 'pc-architecture', order: 1,
      title: 'Який це комп’ютер?',
      summary: 'Розглянь фото й визнач тип кожного комп’ютера: суперкомп’ютер, сервер, настільний ПК, міні-ПК, моноблок, ноутбук.',
      file: 'lessons/pc-architecture/01-what-computer-is-it.html',
      tags: ['pc-types', 'quiz'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'pc-02', folder: 'pc-architecture', order: 2,
      title: 'Збери комп’ютер',
      summary: 'Перетягни деталі в правильні місця на материнській платі й у корпусі, а потім натисни кнопку живлення. Обережно: є зайві деталі!',
      file: 'lessons/pc-architecture/02-assemble-a-pc.html',
      tags: ['pc-assembly', 'motherboard', 'cpu', 'ram'], level: 1, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-03', folder: 'pc-architecture', order: 3,
      title: 'Майстер сервісного центру',
      summary: 'Клієнти скаржаться на свої комп’ютери. Визнач, який компонент винен.',
      file: 'lessons/pc-architecture/03-service-center.html',
      tags: ['diagnostics', 'quiz'], level: 1, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'pc-04', folder: 'pc-architecture', order: 4,
      title: 'Паспорт мого процесора · частина 1',
      summary: 'Дізнайся в Диспетчері завдань модель, частоту, кількість ядер і потоків процесора свого комп’ютера. Сторінка перевірить, чи дані правдоподібні.',
      file: 'lessons/pc-architecture/04-my-cpu-passport-1.html',
      tags: ['cpu', 'my-pc'], level: 1, needs: 'own-pc', duration: '10 хв'
    },
    {
      id: 'pc-05', folder: 'pc-architecture', order: 5,
      title: 'Симулятор: RAM під навантаженням',
      summary: '4 місії: змінюй обсяг RAM, запускай програми, зберігай файл і вимикай живлення. Відповідь розблоковується після потрібної дії.',
      file: 'lessons/pc-architecture/05-ram-under-load.html',
      tags: ['ram', 'simulator'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-06', folder: 'pc-architecture', order: 6,
      title: 'Перегони накопичувачів',
      summary: '5 місій: запусти перегони HDD, SATA SSD і NVMe SSD на різних файлах, порівняй час і підбери накопичувач для трьох ситуацій.',
      file: 'lessons/pc-architecture/06-storage-race.html',
      tags: ['storage', 'simulator'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-07', folder: 'pc-architecture', order: 7,
      title: 'Детектив материнської плати',
      summary: 'Знайди відповіді на коробці та на самій платі Gigabyte A520M K V2.',
      file: 'lessons/pc-architecture/07-motherboard-detective.html',
      tags: ['motherboard', 'quiz'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-08', folder: 'pc-architecture', order: 8,
      title: 'Паспорт мого процесора · частина 2',
      summary: 'Кеш L1–L3, швидкість і канали пам’яті, сокет і TDP свого процесора. Порахуй пропускну здатність пам’яті за формулою.',
      file: 'lessons/pc-architecture/08-my-cpu-passport-2.html',
      tags: ['cpu', 'ram', 'my-pc', 'calculation'], level: 2, needs: 'own-pc', duration: '15 хв'
    },
    {
      id: 'pc-09', folder: 'pc-architecture', order: 9,
      title: 'Конфігуратор пам’яті',
      summary: '5 місій: обирай плату DDR4 або DDR5, встановлюй модулі в гнізда A1–B2 і стеж за режимом каналів, швидкістю, затримкою та пропускною здатністю.',
      file: 'lessons/pc-architecture/09-memory-configurator.html',
      tags: ['ram', 'motherboard', 'simulator', 'calculation'], level: 2, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'pc-10', folder: 'pc-architecture', order: 10,
      title: 'Паспорт пам’яті мого ПК',
      summary: 'Перепиши характеристики RAM і накопичувача свого ПК. Паспорт сам порахує пропускну здатність, переведе ГБ у GB і порівняє швидкість диска з типовими. Без балів.',
      file: 'lessons/pc-architecture/10-my-pc-memory-passport.html',
      tags: ['ram', 'storage', 'my-pc', 'calculation'], level: 2, needs: 'own-pc', duration: '15 хв'
    },
    {
      id: 'pc-11', folder: 'pc-architecture', order: 11,
      title: 'Чи підійде до нашої плати?',
      summary: 'Визнач, які процесори й модулі пам’яті можна встановити в материнську плату Gigabyte A520M K V2.',
      file: 'lessons/pc-architecture/11-will-it-fit.html',
      tags: ['compatibility', 'motherboard', 'cpu', 'ram'], level: 3, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-12', folder: 'pc-architecture', order: 12,
      title: 'Розшифруй назву плати',
      summary: 'Дев’ять справжніх плат: за назвою визнач сокет, форм-фактор і чи можна розганяти. Кожне питання — одна спроба з поясненням.',
      file: 'lessons/pc-architecture/12-decode-board-name.html',
      tags: ['motherboard', 'compatibility', 'quiz'], level: 3, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'pc-13', folder: 'pc-architecture', order: 13,
      title: 'Паспорт моєї материнської плати',
      summary: 'Дізнайся виробника, модель, чипсет, сокет, форм-фактор і кількість слотів пам’яті плати у своєму ПК (msinfo32, Диспетчер завдань).',
      file: 'lessons/pc-architecture/13-my-motherboard-passport.html',
      tags: ['motherboard', 'my-pc'], level: 3, needs: 'own-pc', duration: '15 хв'
    },
    {
      id: 'pc-14', folder: 'pc-architecture', order: 14,
      title: 'Паспорт моєї відеокарти',
      summary: 'Дізнайся модель, тип, відеопам’ять, TDP своєї відеокарти та порти виводу (Диспетчер завдань, задня панель ПК).',
      file: 'lessons/pc-architecture/14-my-gpu-passport.html',
      tags: ['gpu', 'my-pc'], level: 3, needs: 'own-pc', duration: '15 хв'
    },
    {
      id: 'pc-15', folder: 'pc-architecture', order: 15,
      title: 'Наклейка блока живлення',
      summary: 'Прочитай наклейку блока живлення, з’єднай конектори з компонентами й порахуй потужність. 12 питань, кожне — одна спроба з поясненням.',
      file: 'lessons/pc-architecture/15-psu-label.html',
      tags: ['psu', 'calculation', 'quiz'], level: 3, needs: 'browser', duration: '15 хв'
    },
    {
      id: 'pc-16', folder: 'pc-architecture', order: 16,
      title: 'Збери ПК під замовлення',
      summary: 'Підбери плату, процесор, пам’ять, відеокарту, блок живлення й корпус для трьох клієнтів. Перша вдала перевірка — 100 %, друга — 75 %, далі — 50 %.',
      file: 'lessons/pc-architecture/16-build-pc-to-order.html',
      tags: ['pc-assembly', 'compatibility', 'motherboard', 'cpu', 'ram', 'gpu', 'psu'], level: 3, needs: 'browser', duration: '30 хв'
    },
    {
      id: 'word-01', folder: 'word', order: 1,
      title: 'Яка програма впорається?',
      summary: 'Для кожної задачі обери вид системи опрацювання текстів: текстовий редактор, текстовий процесор, система для наукових документів, видавнича система тощо.',
      file: 'lessons/word/01-which-program.html',
      tags: ['text-systems', 'quiz'], level: 1, needs: 'browser', duration: '5 хв'
    },
    {
      id: 'word-02', folder: 'word', order: 2,
      title: 'Чия це властивість?',
      summary: 'Визнач, якому об’єкту документа належить кожна властивість: символу, абзацу, сторінці, малюнку чи таблиці.',
      file: 'lessons/word/02-whose-property.html',
      tags: ['doc-objects', 'quiz'], level: 1, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'word-03', folder: 'word', order: 3,
      title: 'Який формат обрати?',
      summary: 'Для кожної життєвої ситуації обери найкращий формат файлу: TXT, DOCX, ODT, RTF, PDF чи MD.',
      file: 'lessons/word/03-which-format.html',
      tags: ['file-formats', 'quiz'], level: 1, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'word-04', folder: 'word', order: 4,
      title: 'Обери режим',
      summary: 'Для кожної ситуації обери зручний режим перегляду документа або спосіб роботи з кількома вікнами.',
      file: 'lessons/word/04-choose-view.html',
      tags: ['views', 'quiz'], level: 2, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'word-05', folder: 'word', order: 5,
      title: 'Лабораторія форматів',
      summary: 'Збережи зразок газети в п’яти форматах, порівняй розміри файлів і зроби висновки. Сторінка перевірить відповіді.',
      file: 'lessons/word/05-formats-lab.html',
      tags: ['file-formats', 'word-app'], level: 2, needs: 'word', duration: '15 хв'
    },
    {
      id: 'word-06', folder: 'word', order: 6,
      title: 'Колонтитули',
      summary: 'У документі «Науковий вісник» додай верхній колонтитул, номери сторінок, дату й особливий колонтитул першої сторінки. Сторінка сама перевірить збережений DOCX.',
      file: 'lessons/word/06-headers-footers.html',
      tags: ['headers-footers', 'word-app'], level: 2, needs: 'word', duration: '15 хв'
    },
    {
      id: 'word-07', folder: 'word', order: 7,
      title: 'Стовпці й розділи',
      summary: 'Розбий статтю на два стовпці з роздільником, додай розриви розділів, альбомну сторінку для таблиці й окремий колонтитул для неї. Сторінка перевірить збережений DOCX.',
      file: 'lessons/word/07-columns-sections.html',
      tags: ['columns-sections', 'word-app'], level: 3, needs: 'word', duration: '15 хв'
    },
    {
      id: 'word-08', folder: 'word', order: 8,
      title: 'Багаторівневий список',
      summary: 'Перетвори план вісника на багаторівневий список «1. / 1.1. / 1.1.1.». Сторінка перевірить збережений DOCX.',
      file: 'lessons/word/08-multilevel-list.html',
      tags: ['lists', 'word-app'], level: 3, needs: 'word', duration: '15 хв'
    },
    {
      id: 'word-09', folder: 'word', order: 9,
      title: 'Символи, індекси й формули',
      summary: 'Заміни слова символами (°, π, ≈, €…), додай верхні й нижні індекси (H₂O, м²) і дві формули через «Рівняння». Сторінка перевірить збережений DOCX.',
      file: 'lessons/word/09-symbols-formulas.html',
      tags: ['symbols-formulas', 'word-app'], level: 3, needs: 'word', duration: '20 хв'
    },
    {
      id: 'db-01', folder: 'database', order: 1,
      title: 'Інспектор таблиці',
      summary: 'Вісім завдань у таблиці про персонажів: познач поле, запис або значення, знайди первинний ключ. Правильно з першої спроби — 1 бал, з другої — ½.',
      file: 'lessons/database/01-table-inspector.html',
      tags: ['db-basics'], level: 1, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'db-02', folder: 'database', order: 2,
      title: 'Підбери тип даних',
      summary: 'Для кожного поля подивись на приклади значень з Excel і обери тип даних Access, а для «Числа» ще й розмір. Деякі поля не варто зберігати в базі.',
      file: 'lessons/database/02-pick-data-type.html',
      tags: ['data-types', 'quiz'], level: 2, needs: 'browser', duration: '10 хв'
    },
    {
      id: 'db-03', folder: 'database', order: 3,
      title: 'Чи пропустить Access?',
      summary: 'База «Школа» з ключами й зв’язком Класи → Учні із забезпеченням цілісності даних. Розклади ситуації: що Access дозволить, а що відхилить.',
      file: 'lessons/database/03-will-access-allow.html',
      tags: ['keys-relations', 'quiz'], level: 2, needs: 'browser', duration: '7 хв'
    },
    {
      id: 'db-04', folder: 'database', order: 4,
      title: 'Тренажер SQL: персонажі «Келиха вогню»',
      summary: 'Шість запитів SELECT від простого до складного: стовпці, умови WHERE, AND, сортування ORDER BY. Пиши запит, натискай «Виконати» й порівнюй результат із правильним.',
      file: 'lessons/database/04-sql-trainer.html',
      tags: ['sql', 'select'], level: 2, needs: 'browser', duration: '20 хв'
    },
    {
      id: 'db-05', folder: 'database', order: 5,
      title: 'Лабораторія Access',
      summary: 'Сім кроків у Microsoft Access: первинні ключі, зв’язок із цілісністю даних, імпорт класів і учнів з Excel. Після кожного кроку — контрольне запитання про твою базу.',
      file: 'lessons/database/05-access-lab.html',
      tags: ['access-app', 'keys-relations', 'import', 'data-types'], level: 3, needs: 'access', duration: '30 хв'
    },
    {
      id: 'db-06', folder: 'database', order: 6,
      title: 'SQL-детектив: стаття Ріти Скітер',
      summary: 'Чотири твердження з газети. Для кожного напиши запит до таблиці trials, який покаже правду.',
      file: 'lessons/database/06-sql-detective.html',
      tags: ['sql', 'select'], level: 3, needs: 'browser', duration: '20 хв'
    }
  ]
};
