# Notifications Service

Микросервис для отправки уведомлений через Telegram и другие каналы.

## Функционал

### Telegram Notifications
- 📢 Уведомления директорам о новых заказах
- 📅 Уведомления о переносе дат встречи
- ❌ Уведомления об отказах
- 🎯 Фильтрация по городам директоров
- 📝 Шаблоны сообщений

### История уведомлений
- Логирование всех отправленных уведомлений
- Статусы отправки (pending, sent, failed)
- Повтор неудачных отправок

## API Endpoints

### Notifications
- `POST /api/v1/notifications/send` - Отправить уведомление
- `POST /api/v1/notifications/new-order` - Новый заказ
- `POST /api/v1/notifications/date-change` - Изменение даты
- `POST /api/v1/notifications/order-rejection` - Отказ от заказа
- `GET /api/v1/notifications/history` - История уведомлений

### Directors
- `GET /api/v1/directors` - Список директоров
- `PUT /api/v1/directors/:id/telegram` - Обновить Telegram данные

### Templates
- `GET /api/v1/templates` - Шаблоны сообщений
- `PUT /api/v1/templates/:type` - Обновить шаблон

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret
PORT=5008
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_API_URL=https://api.telegram.org
WEBHOOK_TOKEN=your-webhook-secret
```

## Формат уведомления

```json
{
  "type": "new_order",
  "orderId": 123,
  "city": "Саратов",
  "data": {
    "clientName": "Иван Петров",
    "phone": "+79001234567",
    "address": "ул. Пушкина, д. 10",
    "dateMeeting": "2025-01-15T10:00:00Z",
    "problem": "Не работает холодильник"
  }
}
```

## Шаблоны сообщений

### new_order
```
🆕 Новая заявка #{orderId}

👤 Клиент: {clientName}
📞 Телефон: {phone}
📍 Адрес: {address}
🗓 Дата встречи: {dateMeeting}
🔧 Проблема: {problem}
🏙 Город: {city}
```

### date_change
```
📅 Перенос даты встречи

📋 Заявка #{orderId}
👤 Клиент: {clientName}
🗓 Новая дата: {newDate}
🏙 Город: {city}
```

### order_rejection
```
❌ Отказ от заявки

📋 Заявка #{orderId}
👤 Клиент: {clientName}
📞 Телефон: {phone}
💬 Причина: {reason}
🏙 Город: {city}
```

## Docker

```bash
docker build -t notifications-service .
docker run -p 5008:5008 notifications-service
```

## Интеграция с Telegram Bot

1. Создайте бота через @BotFather
2. Получите токен бота
3. Добавьте токен в `.env` как `TELEGRAM_BOT_TOKEN`
4. Каждый директор должен запустить бота и получить chat_id
5. Обновите chat_id директора через API

