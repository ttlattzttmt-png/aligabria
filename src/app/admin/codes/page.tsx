"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Search, Plus, Ticket, Loader2, Trash2, User, BookOpen, RefreshCw, FileDown, Printer } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function ManageCodes() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genData, setGenData] = useState({ courseId: '', count: '10' });
  const [selectedCourseForExport, setSelectedCourseForExport] = useState('');

  const codesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'access_codes'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const coursesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'courses');
  }, [firestore, user]);

  const { data: codes, isLoading: isCodesLoading } = useCollection(codesRef);
  const { data: courses } = useCollection(coursesRef);

  const handleGenerateCodes = async () => {
    if (!firestore || !user || !genData.courseId) return;
    setIsGenerating(true);
    try {
      const count = parseInt(genData.count);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      
      for (let i = 0; i < count; i++) {
        let randomCode = '';
        for (let j = 0; j < 12; j++) {
          randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        await addDoc(collection(firestore, 'access_codes'), {
          code: randomCode,
          courseId: genData.courseId,
          generatedByAdminUserId: user.uid,
          createdAt: serverTimestamp(),
          isUsed: false,
          usedByStudentId: null,
          usedAt: null
        });
      }
      toast({ title: "تم التوليد بنجاح", description: `تم إنشاء ${count} كود تفعيل بنجاح.` });
      setGenData({ ...genData, courseId: '' });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "خطأ", description: "فشل إنشاء الأكواد." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!selectedCourseForExport || !codes) return;
    
    const courseCodes = codes.filter(c => c.courseId === selectedCourseForExport && !c.isUsed);
    const courseTitle = courses?.find(c => c.id === selectedCourseForExport)?.title || 'الكورس';

    if (courseCodes.length === 0) {
      toast({ variant: "destructive", title: "لا توجد أكواد", description: "لا توجد أكواد متاحة (غير مستخدمة) لهذا الكورس حالياً." });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>أكواد كورس: ${courseTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; background: #fff; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 40px; }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { color: #666; margin-top: 5px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .code-box { border: 2px dashed #000; padding: 20px; text-align: center; border-radius: 10px; }
            .code-text { font-size: 20px; font-weight: bold; letter-spacing: 2px; font-family: monospace; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; pt: 10px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>أكواد تفعيل كورس: ${courseTitle}</h1>
            <p>منصة الدكتور التعليمية - العدد الإجمالي: ${courseCodes.length} كود</p>
          </div>
          <div class="grid">
            ${courseCodes.map(c => `
              <div class="code-box">
                <div class="code-text">${c.code}</div>
                <div style="font-size: 10px; margin-top: 5px; color: #666;">كود اشتراك لمرة واحدة</div>
              </div>
            `).join('')}
          </div>
          <div class="footer">
            صنع بكل فخر بواسطة : Mohamed Alaa - تواصل فني: 01066272261
          </div>
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDeleteCode = async (id: string) => {
    if (!firestore) return;
    if (!confirm('هل أنت متأكد من حذف هذا الكود نهائياً؟')) return;
    try {
      await deleteDoc(doc(firestore, 'access_codes', id));
      toast({ title: "تم الحذف", description: "تم حذف الكود بنجاح." });
    } catch (e) { 
      console.error(e);
    }
  };

  const filteredCodes = codes?.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-right">
          <h1 className="text-3xl md:text-4xl font-headline font-bold mb-2">إدارة الأكواد الذكية</h1>
          <p className="text-muted-foreground">ولد آلاف الأكواد، احذفها، أو قم بتصديرها كملفات PDF للطباعة.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-14 px-6 border-primary/20 text-primary font-bold rounded-xl gap-2 shadow-sm">
                <FileDown className="w-5 h-5" /> تصدير PDF للطباعة
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card text-right">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-right">تصدير أكواد كورس محدد</DialogTitle></DialogHeader>
              <div className="py-6 space-y-4">
                <p className="text-sm text-muted-foreground">سيتم تصدير كافة الأكواد "غير المستخدمة" لهذا الكورس في ملف واحد جاهز للطباعة.</p>
                <Select value={selectedCourseForExport} onValueChange={setSelectedCourseForExport}>
                  <SelectTrigger className="h-12 bg-background"><SelectValue placeholder="اختر الكورس المراد تصدير أكواده" /></SelectTrigger>
                  <SelectContent>
                    {courses?.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button onClick={handleExportPDF} disabled={!selectedCourseForExport} className="w-full h-12 bg-accent text-white font-bold rounded-xl gap-2">
                  <Printer className="w-5 h-5" /> بدء التصدير والطباعة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-xl gap-2 shadow-lg">
                <Plus className="w-6 h-6" /> توليد أكواد جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card text-right">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-right">توليد أكواد ذكية (12 رمزاً)</DialogTitle></DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2 text-right">
                  <label className="text-sm font-bold">الكورس المستهدف</label>
                  <Select value={genData.courseId} onValueChange={(v) => setGenData({...genData, courseId: v})}>
                    <SelectTrigger className="h-12 bg-background"><SelectValue placeholder="اختر الكورس" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map(course => (
                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-sm font-bold">كمية الأكواد</label>
                  <Input type="number" value={genData.count} onChange={(e) => setGenData({...genData, count: e.target.value})} className="h-12 bg-background text-right" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleGenerateCodes} disabled={isGenerating || !genData.courseId} className="w-full h-12 bg-primary font-bold rounded-xl">توليد الآن</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-card border-primary/5 shadow-xl rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b bg-secondary/5 py-4 flex flex-row-reverse items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="ابحث عن كود محدد..." 
              className="pr-10 bg-background border-primary/10 text-right h-12 rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs">
            <RefreshCw className="w-4 h-4 animate-spin-slow" /> تزامن حيّ للأكواد
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-2">
                <TableHead className="text-right">كود التفعيل (12 رمزاً)</TableHead>
                <TableHead className="text-right">الكورس المرتبط</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-left">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isCodesLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : !filteredCodes || filteredCodes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">لا توجد أكواد مسجلة حالياً.</TableCell></TableRow>
              ) : (
                filteredCodes.map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="font-mono font-bold text-primary text-lg tracking-wider">{c.code}</TableCell>
                    <TableCell><CourseName courseId={c.courseId} /></TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${c.isUsed ? 'bg-accent/10 text-accent border-accent/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                        {c.isUsed ? 'مستخدم' : 'متاح'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {c.isUsed ? <StudentName studentId={c.usedByStudentId} /> : <span className="text-[10px] opacity-20 italic">---</span>}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDeleteCode(c.id)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CourseName({ courseId }: { courseId: string }) {
  const firestore = useFirestore();
  const courseRef = useMemoFirebase(() => courseId ? doc(firestore, 'courses', courseId) : null, [firestore, courseId]);
  const { data: course } = useDoc(courseRef);
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className="text-xs font-bold text-foreground">{course?.title || '...'}</span>
      <BookOpen className="w-3 h-3 text-primary opacity-50" />
    </div>
  );
}

function StudentName({ studentId }: { studentId: string }) {
  const firestore = useFirestore();
  const studentRef = useMemoFirebase(() => studentId ? doc(firestore, 'students', studentId) : null, [firestore, studentId]);
  const { data: student } = useDoc(studentRef);
  return (
    <div className="flex items-center gap-2 justify-end text-accent">
      <span className="text-xs font-bold">{student?.name || 'مستخدم'}</span>
      <User className="w-3 h-3" />
    </div>
  );
}