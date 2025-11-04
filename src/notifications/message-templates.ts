// Хардкод шаблонов сообщений

export const MESSAGE_TEMPLATES = {
  // Шаблоны для директоров
  new_order: {
    recipientType: 'director',
    format: (data: any) => `🆕 Поступил новый заказ №${data.orderId}

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
📞 Телефон: ${data.phone}
📍 Адрес: ${data.address}
🗓 Дата встречи: ${data.dateMeeting}
🔧 Проблема: ${data.problem}
🏙 Город: ${data.city}`,
  },

  date_change: {
    recipientType: 'both', // и директор и мастер
    format: (data: any) => `📅 Заказ №${data.orderId} перенесен на ${data.newDate}

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${data.newDate}${data.city ? `\n🏙 Город: ${data.city}` : ''}`,
  },

  order_rejection: {
    recipientType: 'both', // и директор и мастер
    format: (data: any) => `❌ Заказ №${data.orderId} Отменен

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}
💬 Причина: ${data.reason}${data.city ? `\n🏙 Город: ${data.city}` : ''}`,
  },

  // Шаблоны для мастеров
  master_assigned: {
    recipientType: 'master',
    format: (data: any) => `👷 Вам назначен заказ №${data.orderId}

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName || 'Не указано'}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}

⚠️ Подтвердите принятие заказа!`,
  },

  master_reassigned: {
    recipientType: 'master',
    format: (data: any) => `🔄 Заказ №${data.orderId} передан другому мастеру`,
  },

  order_accepted: {
    recipientType: 'master',
    format: (data: any) => `✅ Заказ №${data.orderId} принят

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName || 'Не указано'}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}`,
  },

  order_closed: {
    recipientType: 'master',
    format: (data: any) => `🔒 Заказ №${data.orderId} закрыт

👤 Клиент: ${data.clientName}
📅 Дата закрытия: ${data.closingDate}

💰 Итог: ${data.total || 'Не указано'}
📉 Расход: ${data.expense || 'Не указано'}
💵 Чистыми: ${data.net || 'Не указано'}
🔄 Сдача мастера: ${data.handover || 'Не указано'}`,
  },

  order_in_modern: {
    recipientType: 'master',
    format: (data: any) => `🕐 Заказ №${data.orderId} в модерне

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}
💳 Предоплата: ${data.prepayment || 'Не указано'}
📆 Дата закрытия: ${data.expectedClosingDate}
💬 Комментарий: ${data.comment || 'Не указано'}`,
  },

  close_order_reminder: {
    recipientType: 'master',
    format: (data: any) => `⚠️ Закройте заказ №${data.orderId}

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}
⏰ Просрочен на ${data.daysOverdue} дн.`,
  },

  modern_closing_reminder: {
    recipientType: 'master',
    format: (data: any) => {
      const daysInfo = data.daysUntilClosing < 0 
        ? `⚠️ Просрочено на ${Math.abs(data.daysUntilClosing)} дн.`
        : data.daysUntilClosing === 0 && data.expectedClosingDate !== 'Не указано'
        ? '⏰ Сегодня день закрытия!'
        : data.expectedClosingDate === 'Не указано'
        ? '⚠️ Нужно закрыть модерн!'
        : `⏰ Осталось дней: ${data.daysUntilClosing}`;

      return `📆 Напоминание о закрытии модерна

📋 Заказ №${data.orderId}

РК: ${data.rk || 'Не указано'}
Авито: ${data.avitoName || 'Не указано'}
Направление: ${data.typeEquipment || 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${data.dateMeeting || 'Не указано'}
📅 Дата закрытия: ${data.expectedClosingDate}
${daysInfo}`;
    },
  },
};

export type MessageType = keyof typeof MESSAGE_TEMPLATES;

