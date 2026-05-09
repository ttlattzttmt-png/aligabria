"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy, 
  Users, 
  Plus, 
  Minus, 
  Loader2, 
  Search, 
  Star, 
  TrendingUp,
  RefreshCw,
  Medal
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, increment, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminPointsPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pointsToAdd, setPointsToAdd] = useState<number>(10);

  // جلب كافة الكورسات للاختيار
  const coursesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const { data: courses } = useCollection(coursesRef);

  // جلب كافة الطلاب لبناء الخارطة
  const studentsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'students') : null), [firestore]);
  const { data: allStudents, isLoading: isStudentsLoading } = useCollection(studentsRef);

  // جلب كافة الاشتراكات لتصفية الطلاب حسب الكورس
  const enrollmentsRef = useMemoFirebase(() => (firestore ? collectionGroup(firestore, 'enrollments') : null), [firestore]);
  const { data: allEnrollments, isLoading: isEnLoading } = useCollection(enrollmentsRef);

  // تصفية وترتيب الطلاب
  const filteredStudents = useMemo(() => {
    if (!allStudents || !selectedCourseId) return [];

    // 1. الحصول على ID الطلاب المشتركين في الكورس المختار
    const enrolledStudentIds = allEnrollments
      ?.filter(en => en.courseId === selectedCourseId)
      .map(en => en.studentId) || [];

    // 2. تصفية الطلاب بناءً على الاشتراك والبحث والترتيب التنازلي للنقاط
    return allStudents
      .filter(s => enrolledStudentIds.includes(s.id))
      .filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (b.points || 0) - (a.points || 0));
  }, [allStudents, allEnrollments, selectedCourseId, searchTerm]);

  const handleUpdatePoints = async (studentId: string, amount: number, studentName: string) => {
    if (!firestore) return;
    try {
      const studentRef = doc(firestore, 'students', studentId);
      await updateDoc(studentRef, {
        points: increment(amount)
      });
      toast({ 
        title: amount > 0 ? "تم منح النقاط" : "تم خصم النقاط", 
        description: `تم تحديث رصيد الطالب ${studentName} بنجاح.` 
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث النقاط." });
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-headline font-black mb-2 flex items-center gap-3 justify-end text-primary">
            لوحة الشرف والمكافآت <Trophy className="w-10 h-10" />
          </h1>
          <p className="text-muted-foreground font-bold">امنح نقاط التفوق لطلابك لتحفيزهم على النجاح.</p>
        </div>
        <div className="bg-accent/10 text-accent px-6 py-3 rounded-2xl border border-accent/20 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin-slow" />
          <span className="font-black text-sm">تزامن حيّ للرصيد</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* أدوات التحكم */}
        <Card className="lg:col-span-1 bg-card border-primary/10 rounded-[2rem] overflow-hidden h-fit shadow-xl">
           <CardHeader className="bg-secondary/10 border-b p-6">
              <CardTitle className="text-lg font-black">إعدادات العرض</CardTitle>
           </CardHeader>
           <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black mr-2 opacity-50">1. اختر الكورس المستهدف</label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger className="h-12 bg-background font-bold border-primary/5">
                    <SelectValue placeholder="اختر الكورس" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black mr-2 opacity-50">2. البحث عن طالب</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="بحث بالاسم..." 
                    className="h-12 pr-10 text-right bg-background border-primary/5" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <label className="text-xs font-black mr-2 opacity-50">كمية النقاط للعملية الواحدة</label>
                <div className="flex items-center gap-2">
                   <Input 
                    type="number" 
                    value={pointsToAdd} 
                    onChange={(e) => setPointsToAdd(Number(e.target.value))}
                    className="h-12 text-center text-xl font-black bg-background border-primary/10"
                   />
                </div>
              </div>
           </CardContent>
        </Card>

        {/* قائمة الطلاب */}
        <Card className="lg:col-span-3 bg-card border-primary/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
           <CardHeader className="border-b bg-secondary/5 flex flex-row-reverse items-center justify-between p-8">
              <div className="flex items-center gap-3">
                 <Badge className="bg-primary/20 text-primary border-primary/10 font-black px-4 py-1">
                    إجمالي الطلاب: {filteredStudents.length}
                 </Badge>
              </div>
              <div className="flex flex-row-reverse items-center gap-2">
                 <Medal className="w-5 h-5 text-primary" />
                 <span className="font-black text-lg">قائمة الأوائل والمشتركين</span>
              </div>
           </CardHeader>
           
           <CardContent className="p-0 overflow-x-auto">
              {!selectedCourseId ? (
                <div className="p-40 text-center text-muted-foreground italic flex flex-col items-center gap-4">
                  <TrendingUp className="w-20 h-20 opacity-5" />
                  <p className="text-xl font-bold">بشمهندس، يرجى اختيار كورس أولاً لعرض طلابه.</p>
                </div>
              ) : isStudentsLoading || isEnLoading ? (
                <div className="p-40 text-center"><Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-40 text-center text-muted-foreground italic">لا يوجد طلاب مسجلون في هذا الكورس حالياً.</div>
              ) : (
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-secondary/10 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b">
                      <th className="px-8 py-5">الترتيب</th>
                      <th className="px-8 py-5">الطالب</th>
                      <th className="px-8 py-5 text-center">الرصيد الحالي</th>
                      <th className="px-8 py-5 text-left">منح مكافأة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-8 py-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm",
                             idx === 0 ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 rotate-3" :
                             idx === 1 ? "bg-zinc-400 text-white" :
                             idx === 2 ? "bg-orange-600 text-white" : "bg-secondary text-muted-foreground"
                           )}>
                              {idx + 1}
                           </div>
                        </td>
                        <td className="px-8 py-4">
                           <div className="flex items-center gap-3 justify-end">
                              <div className="text-right">
                                 <p className="font-black text-sm text-foreground">{s.name}</p>
                                 <p className="text-[10px] text-muted-foreground font-mono">{s.studentPhoneNumber}</p>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-xs">
                                 {s.name[0]}
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-4 text-center">
                           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-background rounded-full border border-primary/10 shadow-inner">
                              <Star className="w-4 h-4 text-primary fill-current" />
                              <span className="text-xl font-black text-primary">{s.points || 0}</span>
                              <span className="text-[10px] font-bold opacity-40">نقطة</span>
                           </div>
                        </td>
                        <td className="px-8 py-4 text-left">
                           <div className="flex items-center gap-2">
                              <Button 
                                onClick={() => handleUpdatePoints(s.id, pointsToAdd, s.name)}
                                className="bg-accent hover:bg-accent/90 text-white font-black rounded-xl h-11 px-6 gap-2 shadow-lg shadow-accent/10 active:scale-95 transition-transform"
                              >
                                 <Plus className="w-4 h-4" /> إضافة {pointsToAdd}
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => handleUpdatePoints(s.id, -pointsToAdd, s.name)}
                                className="border-destructive/20 text-destructive hover:bg-destructive/5 font-black rounded-xl h-11 px-4 active:scale-95 transition-transform"
                              >
                                 <Minus className="w-4 h-4" />
                              </Button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
