# Deployment Guide - Notifications Service

## 🚀 Быстрый старт

### 1. Подготовка Telegram Bot

```bash
# 1. Создайте бота через @BotFather в Telegram
# 2. Получите токен бота
# 3. Сохраните токен для использования в переменных окружения
```

### 2. Настройка переменных окружения

```bash
# Создайте .env файл
cat > .env << EOF
DATABASE_URL=postgresql://user:password@postgres:5432/callcentre_crm
JWT_SECRET=your-jwt-secret-key
PORT=5008
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_API_URL=https://api.telegram.org
WEBHOOK_TOKEN=your-webhook-secret-token
CORS_ORIGIN=http://localhost:3000
EOF
```

### 3. Локальная разработка

```bash
# Установка зависимостей
npm install

# Генерация Prisma Client
npx prisma generate

# Push схемы в БД (для development)
npx prisma db push

# Запуск в dev режиме
npm run start:dev
```

### 4. Docker

```bash
# Build
docker build -t notifications-service .

# Run
docker run -d \
  --name notifications-service \
  -p 5008:5008 \
  --env-file .env \
  notifications-service
```

### 5. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  notifications-service:
    build: ./api-services/notifications-service
    container_name: notifications-service
    ports:
      - "5008:5008"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/callcentre_crm
      - JWT_SECRET=${JWT_SECRET}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - WEBHOOK_TOKEN=${WEBHOOK_TOKEN}
    depends_on:
      - postgres
    networks:
      - app-network
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=callcentre_crm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
```

## 📦 Kubernetes Deployment

### 1. Secret

```yaml
# k8s/secrets/notifications-service-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: notifications-service-secret
  namespace: production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres:5432/callcentre_crm"
  JWT_SECRET: "your-jwt-secret-key"
  TELEGRAM_BOT_TOKEN: "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
  WEBHOOK_TOKEN: "your-webhook-secret-token"
```

### 2. Deployment

```yaml
# k8s/deployments/notifications-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notifications-service
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: notifications-service
  template:
    metadata:
      labels:
        app: notifications-service
    spec:
      containers:
      - name: notifications-service
        image: your-docker-hub/notifications-service:latest
        ports:
        - containerPort: 5008
        env:
        - name: PORT
          value: "5008"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: notifications-service-secret
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: notifications-service-secret
              key: JWT_SECRET
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: notifications-service-secret
              key: TELEGRAM_BOT_TOKEN
        - name: WEBHOOK_TOKEN
          valueFrom:
            secretKeyRef:
              name: notifications-service-secret
              key: WEBHOOK_TOKEN
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/notifications/health
            port: 5008
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/notifications/health
            port: 5008
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 3. Service

```yaml
# k8s/services/notifications-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: notifications-service
  namespace: production
spec:
  selector:
    app: notifications-service
  ports:
  - port: 5008
    targetPort: 5008
  type: ClusterIP
```

### 4. Ingress (опционально)

```yaml
# k8s/ingress/notifications-service.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: notifications-service-ingress
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.test-shem.ru
    secretName: api-tls
  rules:
  - host: api.test-shem.ru
    http:
      paths:
      - path: /api/v1/notifications
        pathType: Prefix
        backend:
          service:
            name: notifications-service
            port:
              number: 5008
```

## 🔧 Настройка директоров

### 1. Получение chat_id

Директор должен:
1. Найти бота в Telegram по username
2. Нажать `/start`
3. Написать `/chatid` для получения своего chat_id
4. Передать chat_id администратору

### 2. Обновление данных директора

```bash
# Через API
curl -X PUT https://api.test-shem.ru/api/v1/directors/1/telegram \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "123456789",
    "tgId": "user123"
  }'
```

### 3. Проверка настроек

```bash
# Получить всех директоров
curl https://api.test-shem.ru/api/v1/directors \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📨 Интеграция с другими сервисами

### Orders Service

```typescript
// В orders-service после создания заказа
import axios from 'axios';

async function notifyNewOrder(order) {
  await axios.post('http://notifications-service:5008/api/v1/notifications/new-order', {
    orderId: order.id,
    city: order.city,
    clientName: order.clientName,
    phone: order.phone,
    address: order.address,
    dateMeeting: order.dateMeeting,
    problem: order.problem,
    rk: order.rk,
    token: process.env.WEBHOOK_TOKEN,
  });
}
```

### При изменении даты

```typescript
async function notifyDateChange(order, newDate) {
  await axios.post('http://notifications-service:5008/api/v1/notifications/date-change', {
    orderId: order.id,
    city: order.city,
    clientName: order.clientName,
    newDate: newDate,
    oldDate: order.dateMeeting,
    token: process.env.WEBHOOK_TOKEN,
  });
}
```

### При отказе

```typescript
async function notifyOrderRejection(order, reason) {
  await axios.post('http://notifications-service:5008/api/v1/notifications/order-rejection', {
    orderId: order.id,
    city: order.city,
    clientName: order.clientName,
    phone: order.phone,
    reason: reason,
    token: process.env.WEBHOOK_TOKEN,
  });
}
```

## 🔍 Мониторинг

### Health Check

```bash
curl http://localhost:5008/api/v1/notifications/health
```

### Статистика уведомлений

```bash
curl http://localhost:5008/api/v1/notifications/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### История уведомлений

```bash
curl "http://localhost:5008/api/v1/notifications/history?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🛠️ Troubleshooting

### Telegram bot не отправляет сообщения

```bash
# 1. Проверьте токен бота
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe

# 2. Проверьте chat_id директора
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# 3. Проверьте логи сервиса
kubectl logs -f deployment/notifications-service -n production
```

### База данных не подключается

```bash
# Проверьте подключение к БД
kubectl exec -it deployment/notifications-service -n production -- \
  npx prisma db execute --sql "SELECT 1"
```

## 📚 API Documentation

После запуска доступна Swagger документация:
```
http://localhost:5008/api/docs
```

