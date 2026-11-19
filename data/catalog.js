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
     needs     — 'browser' (усе в браузері) або 'illustrator' (робота в програмі + перевірка файлу)
     duration  — орієнтовний час
     source    — з якого уроку походить завдання (для вчителя) */
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
    'code-editor': 'пишемо код'
  },

  items: [
    {
      id: 'illustrator-01', folder: 'adobe-illustrator', order: 1,
      title: 'Вектор чи растр?',
      summary: 'Збільшуй зображення повзунком і визнач, яке з них векторне, а яке — растрове.',
      file: 'lessons/adobe-illustrator/01-vector-or-raster.html',
      tags: ['vector-raster', 'quiz'], level: 1, needs: 'browser', duration: '5 хв',
      source: 'Урок 1 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-02', folder: 'adobe-illustrator', order: 2,
      title: 'Гарячі клавіші',
      summary: 'Натискай на клавіатурі правильну клавішу для кожного інструмента чи дії.',
      file: 'lessons/adobe-illustrator/02-hotkeys.html',
      tags: ['hotkeys', 'interface'], level: 1, needs: 'browser', duration: '5 хв',
      source: 'Урок 1'
    },
    {
      id: 'illustrator-03', folder: 'adobe-illustrator', order: 3,
      title: 'Знайди інструмент',
      summary: 'Клікай на потрібні інструменти, панелі й меню в макеті інтерфейсу Illustrator.',
      file: 'lessons/adobe-illustrator/03-find-the-tool.html',
      tags: ['interface'], level: 1, needs: 'browser', duration: '5 хв',
      source: 'Урок 1'
    },
    {
      id: 'illustrator-04', folder: 'adobe-illustrator', order: 4,
      title: 'Малюємо числами',
      summary: 'Намалюй три фігури, змінюючи лише числа (координати, розміри, колір) — так «думає» векторна програма.',
      file: 'lessons/adobe-illustrator/04-draw-with-numbers.html',
      tags: ['vector-raster', 'shapes'], level: 1, needs: 'browser', duration: '7 хв',
      source: 'Урок 1 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-05', folder: 'adobe-illustrator', order: 5,
      title: 'Налаштуй документ',
      summary: 'Створи правильний новий документ для п’яти різних замовлень: одиниці, розмір, колірний режим, роздільна здатність, виліт.',
      file: 'lessons/adobe-illustrator/05-document-setup.html',
      tags: ['document', 'color'], level: 2, needs: 'browser', duration: '10 хв',
      source: 'Урок 1'
    },
    {
      id: 'illustrator-06', folder: 'adobe-illustrator', order: 6,
      title: 'Куди відправимо файл?',
      summary: 'Для кожного замовлення обери формат файлу, колірний режим і команду збереження чи експорту.',
      file: 'lessons/adobe-illustrator/06-where-to-send-the-file.html',
      tags: ['export', 'color', 'quiz'], level: 2, needs: 'browser', duration: '7 хв',
      source: 'Урок 2'
    },
    {
      id: 'illustrator-07', folder: 'adobe-illustrator', order: 7,
      title: 'Мій перший документ: A4 у CMYK',
      summary: 'В Adobe Illustrator створи документ A4 у CMYK, намалюй фігуру й збережи PDF. Сторінка сама перевірить файл.',
      file: 'lessons/adobe-illustrator/07-first-document.html',
      tags: ['real-app', 'document', 'color', 'export'], level: 1, needs: 'illustrator', duration: '10 хв',
      source: 'Урок 4'
    },
    {
      id: 'illustrator-08', folder: 'adobe-illustrator', order: 8,
      title: 'Збери з фігур',
      summary: 'Три малюнки з прямокутників і еліпсів у міні-Illustrator: сонце, світлофор, сніговик. Shift, Alt, порядок, вирівнювання, групування.',
      file: 'lessons/adobe-illustrator/08-build-from-shapes.html',
      tags: ['shapes', 'align', 'fill-stroke', 'drawing'], level: 2, needs: 'browser', duration: '15 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-09', folder: 'adobe-illustrator', order: 9,
      title: 'Світлофор: фігури точних розмірів',
      summary: 'В Adobe Illustrator намалюй світлофор 100 × 100 мм у CMYK: корпус, три кола, заливка, обведення, вирівнювання. Перевір PDF на сторінці.',
      file: 'lessons/adobe-illustrator/09-traffic-light-pdf.html',
      tags: ['real-app', 'shapes', 'fill-stroke', 'align'], level: 2, needs: 'illustrator', duration: '15 хв',
      source: 'Урок 4'
    },
    {
      id: 'illustrator-10', folder: 'adobe-illustrator', order: 10,
      title: 'Світлофор для сайту: SVG',
      summary: 'Перенеси світлофор у вебдокумент 800 × 600 px (RGB) і експортуй SVG з монтажною областю. Сторінка перевірить файл.',
      file: 'lessons/adobe-illustrator/10-traffic-light-svg.html',
      tags: ['real-app', 'export', 'color', 'document'], level: 2, needs: 'illustrator', duration: '10 хв',
      source: 'Урок 4'
    },
    {
      id: 'illustrator-11', folder: 'adobe-illustrator', order: 11,
      title: 'Shape Builder: пазли',
      summary: 'Вісім пазлів: спершу лише видаляєш або лише об’єднуєш ділянки, потім — і те, й інше (кіт, ключ, навісний замок).',
      file: 'lessons/adobe-illustrator/11-shape-builder-puzzles.html',
      tags: ['shape-builder', 'shapes'], level: 2, needs: 'browser', duration: '15 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-12', folder: 'adobe-illustrator', order: 12,
      title: 'Перо 1: кліки й криві',
      summary: 'Сім рівнів Pen Tool без Alt: трикутник, блискавка, арка, хвиля, купол, крапля, серпик.',
      file: 'lessons/adobe-illustrator/12-pen-clicks-and-curves.html',
      tags: ['pen-tool'], level: 2, needs: 'browser', duration: '15 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-13', folder: 'adobe-illustrator', order: 13,
      title: 'Перо 2: Alt — ламаємо ручку',
      summary: 'П’ять рівнів Pen Tool: там, де ручка тягне лінію не туди, її треба зламати клавішею Alt.',
      file: 'lessons/adobe-illustrator/13-pen-break-handle.html',
      tags: ['pen-tool'], level: 3, needs: 'browser', duration: '15 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-14', folder: 'adobe-illustrator', order: 14,
      title: 'Полагодь контур',
      summary: 'Білою стрілкою (A) перетягуй точки й ручки, щоб контур ліг точно на пунктирний зразок.',
      file: 'lessons/adobe-illustrator/14-fix-the-path.html',
      tags: ['direct-selection', 'pen-tool'], level: 3, needs: 'browser', duration: '10 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-15', folder: 'adobe-illustrator', order: 15,
      title: '8 вправ: по одній на інструмент',
      summary: 'Фігури, чорна й біла стрілки, перо (прямі та Alt), заливка й обведення, Shape Builder, Pathfinder, вирівнювання.',
      file: 'lessons/adobe-illustrator/15-eight-tool-drills.html',
      tags: ['shapes', 'direct-selection', 'pen-tool', 'fill-stroke', 'shape-builder', 'pathfinder', 'align'], level: 3, needs: 'browser', duration: '25 хв',
      source: 'Урок 3 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-16', folder: 'adobe-illustrator', order: 16,
      title: 'За інструкцією: морозиво, мухомор, кит',
      summary: 'Три малюнки з підказками на полотні. Кожен поєднує кілька інструментів: перо, фігури, кольори, Shape Builder, вирівнювання, порядок і групування.',
      file: 'lessons/adobe-illustrator/16-guided-drawings.html',
      tags: ['drawing', 'pen-tool', 'shapes', 'shape-builder', 'align', 'fill-stroke'], level: 3, needs: 'browser', duration: '30 хв',
      source: 'Урок 3 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-17', folder: 'adobe-illustrator', order: 17,
      title: 'Без підказок: обери малюнок',
      summary: 'Хмарка з дощем, чашка кави або лампочка. Лише зразок і вимоги — інструменти й спосіб обираєш сам(-а).',
      file: 'lessons/adobe-illustrator/17-drawing-without-hints.html',
      tags: ['drawing', 'pen-tool', 'shapes', 'pathfinder'], level: 3, needs: 'browser', duration: '25 хв',
      source: 'Урок 3 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'illustrator-18', folder: 'adobe-illustrator', order: 18,
      title: 'Моя іконка',
      summary: 'Власна іконка на будь-яку тему всіма інструментами: щонайменше 4 об’єкти, крива пером, 2 кольори, усе згруповано.',
      file: 'lessons/adobe-illustrator/18-my-icon.html',
      tags: ['creative', 'drawing', 'pen-tool'], level: 3, needs: 'browser', duration: '30 хв',
      source: 'Урок 2 · Повторення: вектор, фігури, Pen Tool'
    },
    {
      id: 'html-01', folder: 'html', order: 1,
      title: 'Правильний тег чи помилка?',
      summary: 'Розклади картки по кошиках: тег записано правильно чи з помилкою. Після перевірки під кожною карткою — пояснення.',
      file: 'lessons/html/01-tag-or-mistake.html',
      tags: ['html-tags', 'quiz'], level: 1, needs: 'browser', duration: '5 хв',
      source: 'HTML: повторюємо основи'
    },
    {
      id: 'html-02', folder: 'html', order: 2,
      title: 'Збери абзац',
      summary: 'Перетягуй блоки, щоб зібрати абзаци з жирним текстом. Праворуч одразу видно результат у браузері.',
      file: 'lessons/html/02-build-a-paragraph.html',
      tags: ['html-nesting', 'html-tags', 'html-text'], level: 1, needs: 'browser', duration: '10 хв',
      source: 'HTML: повторюємо основи'
    },
    {
      id: 'html-03', folder: 'html', order: 3,
      title: 'Збери сторінку',
      summary: 'Склади правильний «скелет» HTML-сторінки з блоків: doctype, html, head, title, body. Деякі блоки — зайві!',
      file: 'lessons/html/03-build-a-page.html',
      tags: ['html-structure', 'html-nesting'], level: 1, needs: 'browser', duration: '10 хв',
      source: 'HTML: повторюємо основи'
    },
    {
      id: 'html-04', folder: 'html', order: 4,
      title: 'Сторінка зі списком',
      summary: 'Додай у готовий «скелет» абзаци та списки: список покупок і рецепт.',
      file: 'lessons/html/04-page-with-lists.html',
      tags: ['html-text', 'html-structure'], level: 2, needs: 'browser', duration: '10 хв',
      source: 'HTML: повторюємо основи'
    },
    {
      id: 'html-05', folder: 'html', order: 5,
      title: 'Збери статтю із заголовками',
      summary: 'Два рівні: збирай статті із заголовками h1–h6 з блоків. У другому рівні є блоки-пастки.',
      file: 'lessons/html/05-article-with-headings.html',
      tags: ['html-headings', 'html-structure'], level: 2, needs: 'browser', duration: '10 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    },
    {
      id: 'html-06', folder: 'html', order: 6,
      title: 'Правильний атрибут чи помилка?',
      summary: 'Розклади картки: атрибут записано правильно чи з помилкою (лапки, знак =, пробіли, назви атрибутів).',
      file: 'lessons/html/06-attribute-or-mistake.html',
      tags: ['html-attributes', 'quiz'], level: 2, needs: 'browser', duration: '5 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    },
    {
      id: 'html-07', folder: 'html', order: 7,
      title: 'Сторінка «Про мене»',
      summary: 'Напиши код сторінки сам(-а): структура, заголовок, абзаци, жирний текст, список. Праворуч — живий результат і список вимог.',
      file: 'lessons/html/07-about-me-page.html',
      tags: ['code-editor', 'html-structure', 'html-text'], level: 2, needs: 'browser', duration: '20 хв',
      source: 'HTML: повторюємо основи'
    },
    {
      id: 'html-08', folder: 'html', order: 8,
      title: 'Атрибути в дії',
      summary: 'Рівень 1 — допиши значення id, щоб запрацювало меню сторінки. Рівень 2 — знайди й виправ 4 помилки в атрибутах.',
      file: 'lessons/html/08-attributes-in-action.html',
      tags: ['html-attributes', 'html-links'], level: 2, needs: 'browser', duration: '15 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    },
    {
      id: 'html-09', folder: 'html', order: 9,
      title: 'Майстерня посилань',
      summary: 'Три рівні: збери посилання з блоків → допиши адреси різних типів → полагодь зламані посилання.',
      file: 'lessons/html/09-links-workshop.html',
      tags: ['html-links', 'html-attributes'], level: 3, needs: 'browser', duration: '15 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    },
    {
      id: 'html-10', folder: 'html', order: 10,
      title: 'Майстерня зображень',
      summary: 'Три рівні: додай зображення з атрибутами → напиши правильні шляхи до файлів у різних папках → збери картинку-посилання.',
      file: 'lessons/html/10-images-workshop.html',
      tags: ['html-images', 'html-attributes', 'html-links'], level: 3, needs: 'browser', duration: '15 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    },
    {
      id: 'html-11', folder: 'html', order: 11,
      title: 'Сторінка-запрошення',
      summary: 'Напиши сторінку-запрошення з нуля: заголовки з id, абзаци, зображення, зовнішнє й внутрішнє посилання. 10 вимог і живий результат.',
      file: 'lessons/html/11-invitation-page.html',
      tags: ['code-editor', 'creative', 'html-headings', 'html-links', 'html-images', 'html-attributes'], level: 3, needs: 'browser', duration: '30 хв',
      source: 'HTML: заголовки, посилання, зображення й атрибути'
    }
  ]
};
