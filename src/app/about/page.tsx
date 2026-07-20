
"use client";

import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { ShieldCheck, Target, Award, Users, BookOpen, Heart } from 'lucide-react';

export default function AboutPage() {
  const values = [
    { icon: <Target className="w-8 h-8 text-primary" />, title: 'رؤيتنا', desc: 'أن نكون المنصة التعليمية الرائدة في تبسيط العلوم الكيميائية لطلاب الوطن العربي.' },
    { icon: <Award className="w-8 h-8 text-primary" />, title: 'رسالتنا', desc: 'تمكين الطلاب من فهم المواد العلمية بعمق من خلال شروحات مبتكرة واختبارات دقيقة.' },
    { icon: <Heart className="w-8 h-8 text-primary" />, title: 'قيمنا', desc: 'الأمانة العلمية، الابتكار في التعليم، ودعم الطالب في كل خطوة نحو النجاح.' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-4">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h1 className="text-5xl font-headline font-bold">عن منصة الدكتور</h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              بدأت منصة الدكتور كحلم لتبسيط العلوم الكيميائية المعقدة، واليوم نحن فخورون بخدمة آلاف الطلاب في المرحلة الثانوية، مقدمين لهم أفضل الأدوات التعليمية والتقنية للوصول للقمة.
            </p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
            {values.map((v, i) => (
              <div key={i} className="p-10 rounded-[2rem] bg-card border border-primary/5 hover:border-primary/20 transition-all text-center group">
                <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform">{v.icon}</div>
                <h3 className="text-2xl font-bold mb-4">{v.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="bg-secondary/20 rounded-[3rem] p-12 md:p-20 flex flex-col md:flex-row items-center gap-16">
            <div className="flex-grow space-y-8">
              <h2 className="text-4xl font-headline font-bold leading-tight">لماذا يثق بنا الطلاب وأولياء الأمور؟</h2>
              <div className="space-y-6">
                {[
                  { icon: <Users />, text: 'مجتمع تعليمي تفاعلي يضم آلاف الطلاب المتميزين.' },
                  { icon: <BookOpen />, text: 'منهج علمي منظم يبدأ من الصفر حتى الاحتراف.' },
                  { icon: <Award />, text: 'متابعة دورية واختبارات تحاكي نظام الامتحان الحقيقي.' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-4 text-lg">
                    <div className="text-primary">{f.icon}</div>
                    <p className="font-medium">{f.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/3 aspect-square bg-primary/10 rounded-full flex items-center justify-center p-10 border-4 border-primary/5">
               <ShieldCheck className="w-full h-full text-primary opacity-20" />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
