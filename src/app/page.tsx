"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowLeft, BookOpen, Video, Award, Users, Star, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';

export default function Home() {
  const heroImg = PlaceHolderImages.find(img => img.id === 'hero-bg');
  const firestore = useFirestore();

  const latestCoursesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'courses'), orderBy('createdAt', 'desc'), limit(3));
  }, [firestore]);

  const { data: courses, isLoading } = useCollection(latestCoursesRef);

  const features = [
    { icon: <Video className="w-6 h-6" />, title: 'شروحات وافية', desc: 'فيديوهات بجودة عالية تغطي كل أجزاء المنهج الدراسي.' },
    { icon: <BookOpen className="w-6 h-6" />, title: 'امتحانات دورية', desc: 'اختبارات إلكترونية ومقالية لقياس مستواك باستمرار.' },
    { icon: <Award className="w-6 h-6" />, title: 'شهادات تفوق', desc: 'تكريم ودعم الطلاب المتفوقين الأوائل على المنصة.' },
  ];

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />
      
      <main className="flex-grow pt-16">
        {/* Hero Section */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src={heroImg?.imageUrl || ''}
              alt="Hero"
              fill
              className="object-cover opacity-20"
              priority
              data-ai-hint="engineering background"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl animate-in fade-in slide-in-from-right duration-1000">
              <span className="inline-block px-5 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold mb-8 border border-primary/20">
                مرحباً بك في مستقبل التعليم الذكي
              </span>
              <h1 className="text-4xl md:text-7xl font-headline font-bold mb-8 leading-[1.2] md:leading-[1.1]">
                تعلم الكيمياء مع <span className="text-primary italic">الدكتور</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed max-w-2xl">
                المنصة المتكاملة لطلاب المرحلة الثانوية. شروحات مبسطة، امتحانات تفاعلية، ومتابعة دقيقة لمستواك الدراسي للوصول للقمة.
              </p>
              <div className="flex flex-wrap gap-5">
                <Link href="/register">
                  <Button size="lg" className="h-16 px-10 text-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-2xl shadow-2xl shadow-primary/20">
                    سجل الآن مجاناً
                  </Button>
                </Link>
                <Link href="/courses">
                  <Button size="lg" variant="outline" className="h-16 px-10 text-lg hover:bg-secondary border-primary/40 text-primary rounded-2xl">
                    تصفح الكورسات
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-secondary/30 border-y border-primary/5">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
              {[
                { label: 'طالب متفوق', val: '+5000', icon: <Users /> },
                { label: 'كورس متاح', val: '+20', icon: <BookOpen /> },
                { label: 'ساعة شرح', val: '+300', icon: <Video /> },
                { label: 'تقييم ممتاز', val: '4.9/5', icon: <Star /> },
              ].map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-5 group-hover:scale-110 group-hover:rotate-12 transition-all">
                    {stat.icon}
                  </div>
                  <h3 className="text-4xl font-bold mb-2">{stat.val}</h3>
                  <p className="text-muted-foreground font-medium text-sm md:text-base">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Latest Courses */}
        <section className="py-32">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-6">
              <div className="text-right">
                <h2 className="text-3xl md:text-5xl font-headline font-bold mb-6">أحدث الكورسات المضافة</h2>
                <p className="text-muted-foreground text-lg md:text-xl">اختر الكورس المناسب لسنتك الدراسية وابدأ رحلة التفوق الآن.</p>
              </div>
              <Link href="/courses" className="flex items-center gap-3 text-primary hover:text-primary/80 transition-colors font-bold text-lg group">
                مشاهدة كل الكورسات <ArrowLeft className="w-6 h-6 group-hover:-translate-x-2 transition-transform" />
              </Link>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-24">
                <Loader2 className="w-16 h-16 animate-spin text-primary" />
              </div>
            ) : !courses || courses.length === 0 ? (
              <div className="text-center py-24 bg-secondary/10 rounded-[3rem] border-2 border-dashed">
                <BookOpen className="w-20 h-20 mx-auto mb-6 opacity-10" />
                <p className="text-muted-foreground text-xl">لا توجد كورسات متاحة حالياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                {courses.map((course, idx) => (
                  <div key={course.id} className="group bg-card rounded-[2.5rem] border border-primary/5 overflow-hidden hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-3">
                    <div className="relative h-64">
                      <Image
                        src={course.imageUrl || PlaceHolderImages[(idx % 3) + 1]?.imageUrl || ''}
                        alt={course.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        unoptimized={!!course.imageUrl}
                      />
                      <div className="absolute top-5 right-5 bg-primary text-primary-foreground text-[10px] md:text-xs font-bold px-4 py-2 rounded-full shadow-2xl">
                        {course.targetAcademicYear}
                      </div>
                    </div>
                    <div className="p-8 text-right space-y-6">
                      <h3 className="text-2xl font-headline font-bold leading-tight">{course.title}</h3>
                      <div className="flex flex-row-reverse items-center gap-5 text-sm text-muted-foreground">
                        <span className="flex flex-row-reverse items-center gap-2"><Video className="w-5 h-5 text-primary" /> شرح وافي</span>
                        <span className="flex flex-row-reverse items-center gap-2"><Users className="w-5 h-5 text-primary" /> +200 طالب</span>
                      </div>
                      <div className="flex flex-row-reverse items-center justify-between mt-8 pt-6 border-t border-white/5">
                        <span className="text-3xl font-black text-accent">{course.price} ج.م</span>
                        <Link href="/register">
                          <Button variant="secondary" className="font-bold rounded-2xl h-12 px-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">اشترك الآن</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Why Us Section */}
        <section className="py-32 bg-card/50 border-y border-primary/5">
          <div className="container mx-auto px-4 text-center mb-24">
            <h2 className="text-3xl md:text-5xl font-headline font-bold mb-6">لماذا تختار منصة الدكتور؟</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">نحن لسنا مجرد منصة فيديوهات، بل رفيقك في رحلة النجاح بخطوات مدروسة وعلمية.</p>
          </div>
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {features.map((f, i) => (
                <div key={i} className="bg-background p-12 rounded-[3rem] border border-primary/10 text-center hover:border-primary transition-all duration-500 shadow-xl shadow-primary/5 group">
                  <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-10 group-hover:rotate-6 group-hover:scale-110 transition-all">
                    {f.icon}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-headline font-bold mb-6">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-32">
          <div className="container mx-auto px-4">
            <div className="bg-gradient-to-l from-primary to-yellow-600 rounded-[4rem] p-12 md:p-24 text-center text-primary-foreground relative overflow-hidden shadow-2xl">
              <div className="relative z-10">
                <h2 className="text-4xl md:text-7xl font-headline font-bold mb-10 leading-tight">جاهز تبدأ رحلة النجاح؟</h2>
                <p className="text-xl md:text-2xl mb-16 opacity-90 max-w-3xl mx-auto font-medium leading-relaxed">
                  انضم لآلاف الطلاب الذين بدأوا بالفعل في تحقيق أحلامهم مع الدكتور. مستقبلك يبدأ من هنا.
                </p>
                <div className="flex flex-wrap justify-center gap-8">
                  <Link href="/register">
                    <Button size="lg" variant="secondary" className="h-18 px-14 text-xl font-bold rounded-[1.5rem] shadow-2xl">إنشاء حساب جديد</Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="h-18 px-14 text-xl font-bold border-white/30 hover:bg-white/10 rounded-[1.5rem]">تسجيل الدخول</Button>
                  </Link>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-black/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
