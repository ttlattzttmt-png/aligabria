"use client";

import { useState } from 'react';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, MapPin, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "تم استلام رسالتك",
        description: "سيرد عليك فريق الدعم في أقرب وقت ممكن.",
      });
      (e.target as HTMLFormElement).reset();
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-5xl font-headline font-bold">اتصل بنا</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              نحن هنا لمساعدتك والإجابة على استفساراتك. تواصل معنا بأي طريقة تفضلها.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-card border-primary/10 overflow-hidden shadow-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="flex items-center gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold mb-1">رقم الهاتف / واتساب</p>
                      <p className="text-xl font-bold" dir="ltr">01066272261</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold mb-1">البريد الإلكتروني</p>
                      <p className="text-lg font-bold">support@al-doctor.com</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-bold mb-1">العنوان</p>
                      <p className="text-lg font-bold">المنصة أونلاين - الغربية، مصر</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="p-8 rounded-[2rem] bg-primary text-primary-foreground space-y-4 shadow-xl shadow-primary/20">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> دعم فني سريع
                </h3>
                <p className="text-sm opacity-90 leading-relaxed">
                  فريق السكرتارية متاح للرد على استفسارات الطلاب وأولياء الأمور يومياً من 10 صباحاً حتى 10 مساءً.
                </p>
              </div>
            </div>

            <div className="lg:col-span-2">
              <Card className="bg-card border-primary/10 shadow-sm">
                <CardContent className="p-10">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold">الاسم بالكامل</label>
                        <Input placeholder="أدخل اسمك" className="h-12 bg-background border-primary/10" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold">رقم الهاتف</label>
                        <Input placeholder="01xxxxxxxxx" className="h-12 bg-background border-primary/10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">موضوع الرسالة</label>
                      <Input placeholder="عن ماذا تود الاستفسار؟" className="h-12 bg-background border-primary/10" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">تفاصيل الرسالة</label>
                      <Textarea placeholder="اكتب رسالتك هنا بالتفصيل..." className="min-h-[150px] bg-background border-primary/10" required />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl text-lg shadow-lg shadow-primary/20"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 ml-2" /> إرسال الرسالة الآن</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}