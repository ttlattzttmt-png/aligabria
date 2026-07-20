
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Video, Ticket, ClipboardList, TrendingUp, Loader2, Clock, Megaphone } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';

export default function AdminOverview() {
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('ar-EG'));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return query(collection(firestore, 'students'), orderBy('registrationDate', 'desc'));
  }, [firestore, user, isUserLoading]);

  const coursesRef = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return collection(firestore, 'courses');
  }, [firestore, user, isUserLoading]);

  const codesRef = useMemoFirebase(() => {
    if (!firestore || isUserLoading || !user) return null;
    return collection(firestore, 'access_codes');
  }, [firestore, user, isUserLoading]);

  const { data: students, isLoading: isStudentsLoading } = useCollection(studentsRef);
  const { data: courses, isLoading: isCoursesLoading } = useCollection(coursesRef);
  const { data: codes, isLoading: isCodesLoading } = useCollection(codesRef);

  const stats = [
    { title: 'إجمالي الطلاب', val: students?.length || 0, icon: <Users className="text-blue-500" />, trend: 'تحديث لحظي' },
    { title: 'الكورسات المفعلة', val: courses?.length || 0, icon: <Video className="text-primary" />, trend: 'متاح للطلاب' },
    { title: 'الأكواد المتاحة', val: codes?.filter(c => !c.isUsed).length || 0, icon: <Ticket className="text-accent" />, trend: 'غير مستخدمة' },
    { title: 'عمليات التسجيل', val: students?.length || 0, icon: <TrendingUp className="text-purple-500" />, trend: 'هذا الشهر' },
  ];

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!user) return <div className="p-20 text-center text-muted-foreground italic">يرجى تسجيل الدخول كمسؤول أولاً.</div>;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-headline font-bold">لوحة تحكم الدكتور</h1>
        <div className="bg-primary/10 text-primary px-4 md:px-6 py-2 rounded-2xl text-sm font-bold border border-primary/20 flex items-center gap-2 self-start md:self-auto">
          <Clock className="w-4 h-4" />
          {currentTime || '...'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((s, i) => (
          <Card key={i} className="bg-card border-primary/5 hover:border-primary/20 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground">{s.title}</CardTitle>
              <div className="p-2 rounded-lg bg-secondary group-hover:scale-110 transition-transform">{s.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold mb-1">{s.val}</div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-accent" /> {s.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <Card className="lg:col-span-2 bg-card">
          <CardHeader className="border-b"><CardTitle className="text-xl">أحدث الطلاب المسجلين</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isStudentsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !students || students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">لا يوجد طلاب مسجلون حالياً.</div>
            ) : (
              <div className="divide-y">
                {students.slice(0, 5).map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-secondary/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {student.name?.[0] || 'S'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{student.academicYear}</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">نشط</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="border-b"><CardTitle className="text-xl">إجراءات سريعة</CardTitle></CardHeader>
          <CardContent className="p-6 space-y-4">
            <button onClick={() => window.location.href='/admin/notifications'} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
              <Megaphone className="w-5 h-5" /> إرسال إشعار عام
            </button>
            <button onClick={() => window.location.href='/admin/exams/grading'} className="w-full py-4 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-all flex items-center justify-center gap-2">
              <ClipboardList className="w-5 h-5" /> مراجعة الامتحانات
            </button>
            <div className="pt-4 border-t text-center">
              <p className="text-[10px] text-muted-foreground">تحكم كامل في المنصة بشكل لحظي وآمن.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
