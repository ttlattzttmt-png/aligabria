
/**
 * @fileOverview أدوات مساعدة للربط الاحترافي مع واتساب - نظام الإرسال الآلي
 */
import { BrandConfig } from '@/lib/brand-config';

interface GatewayConfig {
  apiKey: string;
  instanceId: string;
  senderNumber: string;
}

export const formatEgyptianNumber = (phoneNumber: string) => {
  if (!phoneNumber) return '';
  const clean = phoneNumber.replace(/\D/g, '');
  if (clean.startsWith('01')) return `2${clean}`;
  if (clean.startsWith('1')) return `20${clean}`;
  if (!clean.startsWith('20') && clean.length === 10) return `20${clean}`;
  return clean.startsWith('20') ? clean : `20${clean}`;
};

export const sendAutomatedMessage = async (to: string, message: string, config?: GatewayConfig) => {
  if (!config?.apiKey || !config?.instanceId) {
    const formattedNum = formatEgyptianNumber(to);
    const url = `https://wa.me/${formattedNum}?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') window.open(url, '_blank');
    return { success: true, mode: 'manual' };
  }

  try {
    const formattedNum = formatEgyptianNumber(to);
    const response = await fetch(`https://api.ultramsg.com/${config.instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: config.apiKey,
        to: formattedNum,
        body: message,
        priority: '10'
      })
    });

    const result = await response.json();
    return { success: !!result.sent || result.status === 'success', mode: 'api', result };
  } catch (error) {
    console.error("WhatsApp API Error:", error);
    const formattedNum = formatEgyptianNumber(to);
    const url = `https://wa.me/${formattedNum}?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') window.open(url, '_blank');
    return { success: false, mode: 'fallback', error };
  }
};

export const formatExamResultMessage = (studentName: string, examTitle: string, score: number, points: number, total: number) => {
  return `*${BrandConfig.name}* 🎓
  
مرحباً، نود إبلاغكم بنتيجة اختبار الطالب: *${studentName}*
في مادة/اختبار: *${examTitle}*

الدرجة النهائية: *${score}%*
نقاط الطالب: ${points} من ${total}

مع تمنياتنا بدوام التفوق والنجاح. ✨
--------------------------------
تم الإرسال آلياً عبر نظام المراسلة الذكي الخاص بالمنصة.`;
};

export const formatNotificationMessage = (title: string, message: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `*إشعار هام من ${BrandConfig.shortName}* 📢

*${title}*

${message}

يمكنك الدخول للمنصة للمتابعة: ${origin}
--------------------------------
الدكتور مستقبلك يبدأ من هنا. 🚀`;
};
