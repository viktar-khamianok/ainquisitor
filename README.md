# Telegram Sin Bot (TypeScript)

Бот слушает текстовые сообщения в чате, анализирует их через OpenAI с учетом последних 15 сообщений и ведет учет "грехов" и "епитимий" в JSON.

## Запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` по примеру `.env.example`.

3. Собрать проект:

```bash
npm run build
```

4. Запустить:

```bash
npm start
```

Для разработки:

```bash
npm run dev
```

## Важно для Telegram

- Бот должен быть добавлен в группу.
- В `@BotFather` отключить privacy mode (`/setprivacy -> Disable`), иначе бот не увидит все сообщения.

## Формат JSON

Данные лежат в `data/sins_storage.json` и сгруппированы по `chatId`, затем по `userId`:

- `sins_count`: текущий счетчик (0-10)
- `sins[]`: история грехов
- `punishments[]`: история наказаний
