// Хардкод шаблонов сообщений

export const MESSAGE_TEMPLATES = {
  // Шаблоны для директоров
  new_order: {
    recipientType: 'director',
    format: (data: any) => `🆕 Поступил новый заказ №${data.orderId}

РК: ${data.rk || 'Не указано'}
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
    format: (data: any) => {
      // newDate уже отформатирован в сервисе, используем как есть
      const newDate = data.newDate || 'Не указано';

      return `📅 Заказ №${data.orderId} перенесен на ${newDate}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName}
📍 Адрес: ${data.address && data.address.trim() ? data.address : 'Не указано'}
🗓 Дата встречи: ${newDate}${data.city ? `\n🏙 Город: ${data.city}` : ''}`;
    },
  },

  order_rejection: {
    recipientType: 'both', // и директор и мастер
    format: (data: any) => {
      // Определяем заголовок в зависимости от причины
      let title: string;
      if (data.reason === 'Мастер отказался от заказа') {
        title = `❌ Заказ №${data.orderId} Мастер отказался`;
      } else if (data.reason === 'Отказ') {
        title = `❌ Заказ №${data.orderId} Отказ`;
      } else if (data.reason === 'Незаказ') {
        title = `❌ Заказ №${data.orderId} Незаказ`;
      } else {
        title = `❌ Заказ №${data.orderId} Отменен`;
      }
      
      // Форматируем дату только если она не отформатирована
      const formatDateIfNeeded = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Не указано';
        // Если уже отформатирована (содержит запятую и двоеточие), используем как есть
        if (/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return date.toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting);

      return `${title}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${dateMeeting}${data.city ? `\n🏙 Город: ${data.city}` : ''}`;
    },
  },

  // Шаблоны для мастеров
  master_assigned: {
    recipientType: 'master',
    format: (data: any) => {
      // dateMeeting уже отформатирован в сервисе, используем как есть
      const dateMeeting = data.dateMeeting || 'Не указано';

      return `👷 Вам назначен заказ №${data.orderId}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName && data.clientName.trim() ? data.clientName : 'Не указано'}
🗓 Дата встречи: ${dateMeeting}

⚠️ Подтвердите принятие заказа!`;
    },
  },

  master_reassigned: {
    recipientType: 'master',
    format: (data: any) => `🔄 Заказ №${data.orderId} передан другому мастеру`,
  },

  order_accepted: {
    recipientType: 'master',
    format: (data: any) => {
      // dateMeeting уже отформатирован в сервисе, используем как есть
      const dateMeeting = data.dateMeeting || 'Не указано';

      return `✅ Заказ №${data.orderId} принят

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName && data.clientName.trim() ? data.clientName : 'Не указано'}
📞 Номер: ${data.phone || 'Не указано'}
📍 Адрес: ${data.address || 'Не указано'}
🗓 Дата встречи: ${dateMeeting}`;
    },
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
    format: (data: any) => {
      // Форматируем дату только если она не отформатирована
      const formatDateIfNeeded = (dateStr: string | undefined, withTime: boolean = true): string => {
        if (!dateStr) return 'Не указано';
        // Если уже отформатирована, используем как есть
        if (withTime && /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        if (!withTime && /^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return withTime 
          ? date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting, true);
      const expectedClosingDate = formatDateIfNeeded(data.expectedClosingDate, false);

      return `🕐 Заказ №${data.orderId} в модерне

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${dateMeeting}
💳 Предоплата: ${data.prepayment || 'Не указано'}
📆 Дата закрытия: ${expectedClosingDate}
💬 Комментарий: ${data.comment && data.comment.trim() ? data.comment : 'Не указано'}`;
    },
  },

  close_order_reminder: {
    recipientType: 'master',
    format: (data: any) => {
      // Форматируем дату только если она не отформатирована
      const formatDateIfNeeded = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Не указано';
        if (/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return date.toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting);

      return `⚠️ Закройте заказ №${data.orderId}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${dateMeeting}
⏰ Просрочен на ${data.daysOverdue} дн.`;
    },
  },

  modern_closing_reminder: {
    recipientType: 'master',
    format: (data: any) => {
      // Форматируем дату только если она не отформатирована
      const formatDateIfNeeded = (dateStr: string | undefined, withTime: boolean = true): string => {
        if (!dateStr) return 'Не указано';
        if (withTime && /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        if (!withTime && /^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return withTime 
          ? date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting, true);
      const expectedClosingDate = formatDateIfNeeded(data.expectedClosingDate, false);

      const daysInfo = data.daysUntilClosing < 0 
        ? `⚠️ Просрочено на ${Math.abs(data.daysUntilClosing)} дн.`
        : data.daysUntilClosing === 0 && expectedClosingDate !== 'Не указано'
        ? '⏰ Сегодня день закрытия!'
        : expectedClosingDate === 'Не указано'
        ? '⚠️ Нужно закрыть модерн!'
        : `⏰ Осталось дней: ${data.daysUntilClosing}`;

      return `📆 Напоминание о закрытии модерна

📋 Заказ №${data.orderId}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName}
🗓 Дата встречи: ${dateMeeting}
📅 Дата закрытия: ${expectedClosingDate}
${daysInfo}`;
    },
  },

  // Уведомление об изменении города (для директора старого города)
  city_change_old_city: {
    recipientType: 'director',
    format: (data: any) => {
      const formatDateIfNeeded = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Не указано';
        if (/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting);
      const masterInfo = data.hadMaster ? '\n⚠️ Мастер снят с заказа' : '';

      return `🏙 Заказ №${data.orderId} перенесен в другой город

${data.oldCity} → ${data.newCity}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName || 'Не указано'}
🗓 Дата встречи: ${dateMeeting}${masterInfo}`;
    },
  },

  // Уведомление об изменении города (для директора нового города)
  city_change_new_city: {
    recipientType: 'director',
    format: (data: any) => {
      const formatDateIfNeeded = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Не указано';
        if (/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting);

      return `📥 Заказ №${data.orderId} перенесен в ваш город

Из города: ${data.oldCity}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName || 'Не указано'}
🗓 Дата встречи: ${dateMeeting}

⚠️ Требуется назначить мастера`;
    },
  },

  // Уведомление мастеру о снятии с заказа из-за смены города
  city_change: {
    recipientType: 'master',
    format: (data: any) => {
      return `❌ Вы сняты с заказа №${data.orderId}

Причина: город изменен с ${data.oldCity} на ${data.newCity}

👤 Клиент: ${data.clientName || 'Не указано'}`;
    },
  },

  // Уведомление об изменении адреса (директору и мастеру)
  address_change: {
    recipientType: 'both',
    format: (data: any) => {
      const formatDateIfNeeded = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Не указано';
        if (/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Не указано';
        return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      };
      
      const dateMeeting = formatDateIfNeeded(data.dateMeeting);

      return `📍 Адрес заказа №${data.orderId} изменен

${data.oldAddress} → ${data.newAddress}

РК: ${data.rk && data.rk.trim() ? data.rk : 'Не указано'}
Направление: ${data.typeEquipment && data.typeEquipment.trim() ? data.typeEquipment : 'БТ'}

👤 Клиент: ${data.clientName || 'Не указано'}
🗓 Дата встречи: ${dateMeeting}${data.city ? `\n🏙 Город: ${data.city}` : ''}`;
    },
  },
};

export type MessageType = keyof typeof MESSAGE_TEMPLATES;


