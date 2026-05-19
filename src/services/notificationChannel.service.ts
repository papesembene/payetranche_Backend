import { Alert, AlertChannel } from "@prisma/client";

export interface NotificationChannel {
  send(alert: Alert): Promise<void>;
}

class InAppNotificationChannel implements NotificationChannel {
  async send(_alert: Alert) {
    // Stored alerts are already available in-app.
  }
}

class SmsNotificationChannel implements NotificationChannel {
  async send(_alert: Alert) {
    // Future SMS provider integration point.
  }
}

class WhatsAppNotificationChannel implements NotificationChannel {
  async send(_alert: Alert) {
    // Future WhatsApp provider integration point.
  }
}

export function getNotificationChannel(channel: AlertChannel): NotificationChannel {
  const channels = {
    [AlertChannel.IN_APP]: new InAppNotificationChannel(),
    [AlertChannel.SMS]: new SmsNotificationChannel(),
    [AlertChannel.WHATSAPP]: new WhatsAppNotificationChannel(),
  };

  return channels[channel];
}
