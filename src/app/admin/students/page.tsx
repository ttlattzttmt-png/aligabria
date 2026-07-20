"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { 
  Search, 
  Phone, 
  Calendar, 
  Loader2,
  Mail,
  GraduationCap,
  ClipboardList,
  Clock,
  Trash2,
  BookOpen,
  CheckCircle2,
  User as UserIcon,
  MessageCircle
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, deleteDoc, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendAutomatedMessage } from '@/lib/whatsapp-utils';

export default function AdminStudents() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'admin_config', 'whatsapp') : null), [firestore]);
  const { data: whatsappConfig } = useDoc(configRef);

  const studentsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'students'), orderBy('registrationDate', 'desc'));
  }, [firestore, user]);

  const { data: students, isLoading } = useCollection(studentsRef);

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!firestore) return;
    if (!confirm(`هل أنت متأكد من حذف الطالب "${name}"؟`)) return;
    try {
      await deleteDoc(doc(firestore, 'students', id));
      toast({ title: "تم الحذف" });
    } catch (e) { console.error(e); }
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.studentPhoneNumber && s.studentPhoneNumber.includes(searchTerm))
    );
  }, [students, searchTerm]);

  const handleQuickMessage = async (phoneNumber: string, name: string) => {
    const msg = `مرحباً يا دكتور ${name.split(' ')[0]}.. كيف يمكننا مساعدتك اليوم؟`;
    await sendAutomatedMessage(phoneNumber, msg, whatsappConfig as any);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold">إدارة الطلاب والرقابة</h1>
          <p className="text-muted-foreground font-bold">تابع ملفات الطلاب ودرجاتهم بتزامن لحظي وبحث ذكي.</p>
        </div>
        <div className="bg-primary/10 text-primary px-6 py-3 rounded-2xl border border-primary/20 font-bold">
           إجمالي المسجلين: {students?.length || 0}
        </div>
      </div>

      <Card className="bg-card border-primary/5 shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b bg-secondary/5 flex flex-row-reverse items-center justify-between p-6">
          <div className="relative w-full max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالاسم أو الهاتف..." 
              className="pr-10 bg-background border-primary/10 text-right h-12 rounded-xl" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/5">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right">اسم الطالب</TableHead>
                <TableHead className="text-right">السنة الدراسية</TableHead>
                <TableHead className="text-right">رقم الهاتف</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredStudents.map(s => (
                <TableRow key={s.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="font-bold">{s.name}</TableCell>
                  <TableCell className="text-right"><Badge variant="outline">{s.academicYear}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-mono text-xs">{s.studentPhoneNumber}</span>
                      <Button 
                        onClick={() => handleQuickMessage(s.studentPhoneNumber, s.name)} 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-accent"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center gap-2">
                       <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(s)} className="rounded-xl font-bold h-9">عرض</Button>
                       <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteStudent(s.id, s.name)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl bg-card rounded-3xl overflow-hidden p-0 text-right">
          <DialogHeader className="sr-only">
            <DialogTitle>بيانات الطالب: {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <ScrollArea className="max-h-[85vh]">
              <div className="p-8 bg-primary/5 border-b">
                <h2 className="text-3xl font-black text-primary">{selectedStudent.name}</h2>
                <div className="flex gap-4 justify-end text-sm text-muted-foreground mt-2 font-bold">
                  <span>{selectedStudent.email}</span>
                  <span>{selectedStudent.academicYear}</span>
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                   <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-[10px] font-bold text-primary mb-1">هاتف الطالب</p>
                      <div className="flex items-center justify-between flex-row-reverse">
                        <p className="font-black text-sm" dir="ltr">{selectedStudent.studentPhoneNumber}</p>
                        <Button onClick={() => sendAutomatedMessage(selectedStudent.studentPhoneNumber, "", whatsappConfig as any)} variant="ghost" size="icon" className="h-6 w-6 text-accent"><MessageCircle className="w-4 h-4" /></Button>
                      </div>
                   </div>
                   <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-[10px] font-bold text-primary mb-1">هاتف ولي الأمر</p>
                      <div className="flex items-center justify-between flex-row-reverse">
                        <p className="font-black text-sm" dir="ltr">{selectedStudent.parentPhoneNumber}</p>
                        <Button onClick={() => sendAutomatedMessage(selectedStudent.parentPhoneNumber, "", whatsappConfig as any)} variant="ghost" size="icon" className="h-6 w-6 text-accent"><MessageCircle className="w-4 h-4" /></Button>
                      </div>
                   </div>
                   <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-primary mb-1">تاريخ التسجيل</p>
                      <p className="font-black text-sm">{new Date(selectedStudent.registrationDate).toLocaleDateString('ar-EG')}</p>
                   </div>
                   <div className="p-4 bg-secondary/20 rounded-2xl border border-white/5">
                      <p className="text-[10px] font-bold text-primary mb-1">النقاط</p>
                      <p className="font-black text-sm">{selectedStudent.points || 0}</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <StudentEnrollmentsProgress studentId={selectedStudent.id} />
                  <StudentAcademicAttempts studentId={selectedStudent.id} />
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentEnrollmentsProgress({ studentId }: { studentId: string }) {
  const firestore = useFirestore();
  const enrollmentsGroupRef = useMemoFirebase(() => collectionGroup(firestore, 'enrollments'), [firestore]);
  const { data: allEnrollments, isLoading } = useCollection(enrollmentsGroupRef);

  const studentEnrollments = useMemo(() => {
    return allEnrollments?.filter(en => en.studentId === studentId) || [];
  }, [allEnrollments, studentId]);

  return (
    <div className="space-y-4">
       <h3 className="text-lg font-black border-r-4 border-primary pr-3 flex items-center gap-2 justify-end">الاشتراكات والتقدم <BookOpen className="w-4 h-4" /></h3>
       {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> : 
         studentEnrollments.map(en => (
            <div key={en.id} className="p-4 bg-card border rounded-2xl space-y-2">
               <div className="flex justify-between items-center flex-row-reverse">
                  <p className="font-bold text-xs">{en.courseTitle}</p>
                  <Badge variant="outline" className="text-[10px]">{en.progressPercentage}%</Badge>
               </div>
               <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${en.progressPercentage}%` }} />
               </div>
            </div>
         ))
       }
    </div>
  );
}

function StudentAcademicAttempts({ studentId }: { studentId: string }) {
  const firestore = useFirestore();
  const attemptsGroupRef = useMemoFirebase(() => collectionGroup(firestore, 'quiz_attempts'), [firestore]);
  const { data: allAttempts, isLoading } = useCollection(attemptsGroupRef);

  const studentAttempts = useMemo(() => {
    return allAttempts?.filter(at => at.studentId === studentId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) || [];
  }, [allAttempts, studentId]);

  return (
    <div className="space-y-4">
       <h3 className="text-lg font-black border-r-4 border-accent pr-3 flex items-center gap-2 justify-end">نتائج الامتحانات <ClipboardList className="w-4 h-4" /></h3>
       {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent" /> :
         studentAttempts.map(a => (
            <div key={a.id} className="p-4 bg-secondary/10 border rounded-2xl flex flex-row-reverse justify-between items-center">
               <div className="text-right">
                  <p className="font-black text-primary text-sm">{a.score}%</p>
                  <p className="text-[9px] font-bold text-muted-foreground">{new Date(a.submittedAt).toLocaleDateString('ar-EG')}</p>
               </div>
               <Badge className="text-[9px] h-5">{a.isGraded ? "مكتمل" : "مراجعة"}</Badge>
            </div>
         ))
       }
    </div>
  );
}
