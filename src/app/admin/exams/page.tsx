
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Plus, 
  Loader2, 
  Trash2, 
  Settings2,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  ImageIcon,
  Printer,
  Zap,
  MessageCircle,
  Clock
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, query, updateDoc, getDocs, orderBy, where, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendAutomatedMessage, formatExamResultMessage } from '@/lib/whatsapp-utils';

export default function AdminExams() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<any>(null);
  const [activeCourseId, setActiveCourseId] = useState<string>('');
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0 });
  
  const [formData, setFormData] = useState({
    courseId: '',
    title: '',
    description: '',
    contentType: 'Quiz',
    passMark: '50',
    durationMinutes: '30',
    allowInstantResults: true,
    isVisible: true 
  });

  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'admin_config', 'whatsapp') : null), [firestore]);
  const { data: whatsappConfig } = useDoc(configRef);

  const coursesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const { data: courses } = useCollection(coursesRef);
  
  const examsRef = useMemoFirebase(() => 
    activeCourseId ? collection(firestore, 'courses', activeCourseId, 'content') : null
  , [firestore, activeCourseId]);

  const { data: allContent } = useCollection(examsRef);

  const exams = useMemo(() => {
    return allContent?.filter(item => item.contentType === 'Quiz' || item.contentType === 'Exam') || [];
  }, [allContent]);

  const handleAddExam = async () => {
    if (!firestore || !user || !formData.courseId || !formData.title) return;
    setIsAdding(true);
    try {
      await addDoc(collection(firestore, 'courses', formData.courseId, 'content'), {
        courseId: formData.courseId,
        title: formData.title,
        description: formData.description,
        contentType: formData.contentType,
        passMarkPercentage: Number(formData.passMark),
        durationMinutes: Number(formData.durationMinutes),
        allowInstantResultsDisplay: formData.allowInstantResults,
        isVisible: formData.isVisible,
        orderIndex: Date.now(),
        createdAt: serverTimestamp(),
        course_uploadedByAdminUserId: user.uid
      });
      toast({ title: "تم النشر بنجاح" });
      setIsAdding(false);
    } catch (e) { console.error(e); setIsAdding(false); }
  };

  const handleDeleteExam = async (exam: any) => {
    if (!firestore) return;
    const confirmed = window.confirm(`🚨 تحذير نهائي: هل أنت متأكد من مسح اختبار "${exam.title}"؟`);
    if (!confirmed) return;
    await deleteDoc(doc(firestore, 'courses', exam.courseId, 'content', exam.id));
    toast({ title: "تم الحذف النهائي" });
  };

  const toggleInstantResults = async (exam: any) => {
    if (!firestore) return;
    const newVal = !exam.allowInstantResultsDisplay;
    await updateDoc(doc(firestore, 'courses', exam.courseId, 'content', exam.id), {
      allowInstantResultsDisplay: newVal
    });
    toast({ title: newVal ? "تفعيل النتائج الفورية" : "إيقاف النتائج الفورية" });
  };

  const handleExamBroadcast = async (exam: any) => {
    if (!firestore || !whatsappConfig) {
      toast({ variant: "destructive", title: "نقص إعدادات", description: "يرجى ضبط إعدادات الواتساب أولاً." });
      return;
    }

    const attemptsSnap = await getDocs(query(
      collectionGroup(firestore, 'quiz_attempts'), 
      where('courseContentId', '==', exam.id),
      where('isGraded', '==', true)
    ));

    if (attemptsSnap.empty) {
      toast({ variant: "destructive", title: "لا توجد نتائج", description: "لم يتم تصحيح أي محاولات لهذا الامتحان بعد." });
      return;
    }

    if (!confirm(`هل أنت متأكد من بدء بث النتائج لـ ${attemptsSnap.size} طالب؟ سيصل إشعار لكل طالب وولي أمره.`)) return;

    setBroadcastingId(exam.id);
    setBroadcastProgress({ current: 0, total: attemptsSnap.size });

    for (let i = 0; i < attemptsSnap.docs.length; i++) {
      const att = attemptsSnap.docs[i].data();
      setBroadcastProgress(p => ({ ...p, current: i + 1 }));

      try {
        const studentSnap = await getDocs(query(collection(firestore, 'students'), where('id', '==', att.studentId)));
        const student = studentSnap.docs[0]?.data();

        if (student) {
          const msg = formatExamResultMessage(student.name, exam.title, att.score, att.pointsAchieved, att.totalPoints);
          
          await sendAutomatedMessage(student.studentPhoneNumber, msg, whatsappConfig as any);
          await new Promise(r => setTimeout(r, 5000)); // تأخير 5 ثوانٍ

          await sendAutomatedMessage(student.parentPhoneNumber, msg, whatsappConfig as any);
          await new Promise(r => setTimeout(r, 5000)); // تأخير 5 ثوانٍ
        }
      } catch (e) { console.error("Broadcast Error:", e); }
    }

    setBroadcastingId(null);
    toast({ title: "اكتمل البث الآلي", description: "تم إرسال كافة الدرجات بنجاح لهذا الامتحان." });
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">إدارة الاختبارات</h1>
          <p className="text-muted-foreground font-bold">تحكم في ظهور النتائج، تصدير نماذج الإجابة، والمراسلة الآلية.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 bg-primary text-primary-foreground font-bold rounded-2xl gap-2 shadow-xl">
              <Plus className="w-6 h-6" /> اختبار جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card text-right">
            <DialogHeader><DialogTitle className="text-2xl font-bold text-right">إنشاء اختبار جديد</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4 text-right">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الكورس</Label>
                  <Select value={formData.courseId} onValueChange={(v) => setFormData({...formData, courseId: v})}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الوقت (دقائق)</Label>
                  <Input type="number" value={formData.durationMinutes} onChange={(e) => setFormData({...formData, durationMinutes: e.target.value})} className="bg-background text-right" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>عنوان الاختبار</Label>
                <Input placeholder="مثال: امتحان الفيزياء الشامل" className="text-right" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddExam} disabled={isAdding} className="w-full h-12 bg-primary font-bold">نشر الاختبار</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {broadcastingId && (
        <Card className="p-8 bg-accent/5 border-accent/20 rounded-3xl animate-in slide-in-from-top duration-500">
          <div className="space-y-4">
             <div className="flex justify-between items-center text-accent font-black">
                <span>جاري بث نتائج الامتحان: {broadcastProgress.current} من {broadcastProgress.total}</span>
                <span>{Math.round((broadcastProgress.current/broadcastProgress.total)*100)}%</span>
             </div>
             <Progress value={(broadcastProgress.current/broadcastProgress.total)*100} className="h-3 bg-secondary" />
             <p className="text-xs text-muted-foreground flex items-center gap-2 justify-center">
                <Clock className="w-4 h-4 animate-spin" /> نظام حماية الدكتور نشط.. ننتظر 5 ثوانٍ لضمان وصول الرسالة بأمان.
             </p>
          </div>
        </Card>
      )}

      <Card className="bg-card border-primary/10 shadow-xl overflow-hidden rounded-[2.5rem]">
        <CardHeader className="border-b bg-secondary/10 flex flex-row-reverse items-center justify-between p-6">
            <Select value={activeCourseId} onValueChange={setActiveCourseId}>
              <SelectTrigger className="w-64 bg-background text-right h-12 rounded-xl font-bold"><SelectValue placeholder="اختر كورس لعرض امتحاناته" /></SelectTrigger>
              <SelectContent>
                {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="border-primary/20 text-primary px-4 py-1.5 rounded-full font-black">إجمالي الاختبارات: {exams.length}</Badge>
        </CardHeader>
        <CardContent className="p-8">
          {!activeCourseId ? (
            <div className="text-center py-24 text-muted-foreground italic flex flex-col items-center gap-4">
              <Settings2 className="w-20 h-20 opacity-5" />
              <p className="text-xl font-bold">يرجى اختيار كورس لعرض الاختبارات.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {exams.map((exam) => (
                <Card key={exam.id} className="relative overflow-hidden group border-primary/10 hover:border-primary/40 transition-all shadow-lg rounded-3xl bg-secondary/5">
                  <div className={`absolute top-0 right-0 w-2 h-full transition-colors ${exam.isVisible ? 'bg-accent' : 'bg-destructive/50'}`} />
                  <CardContent className="p-7 space-y-5 text-right">
                    <div className="flex justify-between items-start mb-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteExam(exam)}><Trash2 className="w-4 h-4" /></Button>
                      <h3 className="font-black text-lg line-clamp-1">{exam.title}</h3>
                    </div>

                    <div className="flex items-center justify-between bg-background/50 p-3 rounded-xl border border-white/5">
                       <span className="text-xs font-bold">نتائج فورية:</span>
                       <Switch checked={exam.allowInstantResultsDisplay} onCheckedChange={() => toggleInstantResults(exam)} />
                    </div>

                    <div className="flex flex-col gap-3">
                       <Button className="w-full bg-primary font-black h-12 rounded-xl" onClick={() => setSelectedExamForQuestions(exam)}>إدارة الأسئلة</Button>
                       
                       <Button 
                         variant="outline" 
                         className="w-full gap-2 h-11 rounded-xl font-bold border-accent/20 text-accent hover:bg-accent/5"
                         disabled={broadcastingId === exam.id}
                         onClick={() => handleExamBroadcast(exam)}
                       >
                         {broadcastingId === exam.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                         بث النتائج (واتساب)
                       </Button>

                       <Button variant="outline" className="w-full gap-2 h-11 rounded-xl font-bold" onClick={() => updateDoc(doc(firestore!, 'courses', exam.courseId, 'content', exam.id), { isVisible: !exam.isVisible })}>
                          {exam.isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {exam.isVisible ? "إخفاء عن الطلاب" : "إظهار للطلاب"}
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedExamForQuestions} onOpenChange={() => setSelectedExamForQuestions(null)}>
        <DialogContent className="max-w-5xl bg-card border-primary/20 max-h-[90vh] overflow-y-auto rounded-[2.5rem]">
          <DialogHeader>
            <div className="flex justify-between items-center flex-row-reverse w-full px-6 pt-6">
              <DialogTitle className="text-3xl font-black text-right">إدارة أسئلة: {selectedExamForQuestions?.title}</DialogTitle>
              <AnswerKeyPDFExport exam={selectedExamForQuestions} />
            </div>
          </DialogHeader>
          <div className="py-6">
            <QuestionManager exam={selectedExamForQuestions} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnswerKeyPDFExport({ exam }: { exam: any }) {
  const firestore = useFirestore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!firestore || !exam) return;
    setIsExporting(true);
    try {
      const qSnap = await getDocs(query(collection(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions'), orderBy('orderIndex', 'asc')));
      const questionsData = [];
      
      for (const qDoc of qSnap.docs) {
        const qData = qDoc.data();
        let correctText = '---';
        if (qData.questionType === 'MCQ') {
          const oSnap = await getDocs(collection(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions', qDoc.id, 'options'));
          const correct = oSnap.docs.find(d => d.data().isCorrect);
          correctText = correct?.data().optionText || '---';
        }
        questionsData.push({ ...qData, id: qDoc.id, correctText });
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>نموذج إجابة: ${exam.title}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; background: #fff; }
              .header { text-align: center; border-bottom: 3px solid #FFD700; padding-bottom: 20px; margin-bottom: 40px; }
              .question-box { border: 2px solid #eee; padding: 25px; margin-bottom: 30px; page-break-inside: avoid; border-radius: 15px; }
              .q-image { max-width: 100%; max-height: 400px; display: block; margin: 15px auto; border-radius: 10px; border: 1px solid #ddd; }
              .answer { color: #2e7d32; font-weight: bold; background: #e8f5e9; padding: 12px; border-radius: 8px; margin-top: 15px; border-right: 5px solid #2e7d32; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="header"><h1>نموذج إجابة: ${exam.title}</h1><p>منصة الدكتور التعليمية</p></div>
            ${questionsData.map((q, i) => `
              <div class="question-box">
                <h3 style="margin-top:0">س ${i+1}: ${q.questionText}</h3>
                ${q.imageUrl ? `<img src="${q.imageUrl}" class="q-image" />` : ''}
                <div class="answer">الإجابة الصحيحة: ${q.correctText}</div>
              </div>
            `).join('')}
            <div class="footer">صنع بكل فخر بواسطة : Mohamed Alaa - 01066272261</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    } catch (e) { console.error(e); } finally { setIsExporting(false); }
  };

  return (
    <Button onClick={handleExport} disabled={isExporting} variant="outline" className="gap-2 border-primary/20 text-primary font-black h-12 rounded-xl">
      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
      تصدير نموذج الإجابة PDF
    </Button>
  );
}

function QuestionManager({ exam }: { exam: any }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ 
    text: '', 
    type: 'MCQ', 
    points: '1', 
    imageUrl: '',
    options: ['', '', '', ''], 
    correctIndex: 0 
  });

  const questionsRef = useMemoFirebase(() => 
    exam ? query(collection(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions'), orderBy('orderIndex', 'asc')) : null
  , [firestore, exam]);

  const { data: questions, isLoading } = useCollection(questionsRef);

  const handleAddQuestion = async () => {
    if (!firestore || !exam || !newQuestion.text) return;
    setIsAdding(true);
    try {
      const qRef = await addDoc(collection(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions'), {
        questionText: newQuestion.text,
        questionType: newQuestion.type,
        points: Number(newQuestion.points),
        imageUrl: newQuestion.imageUrl || null,
        orderIndex: (questions?.length || 0) + 1,
        createdAt: serverTimestamp()
      });

      if (newQuestion.type === 'MCQ') {
        for (let i = 0; i < 4; i++) {
          await addDoc(collection(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions', qRef.id, 'options'), {
            optionText: newQuestion.options[i],
            isCorrect: i === newQuestion.correctIndex,
            orderIndex: i
          });
        }
      }

      toast({ title: "تم إضافة السؤال" });
      setNewQuestion({ text: '', type: 'MCQ', points: '1', imageUrl: '', options: ['', '', '', ''], correctIndex: 0 });
    } catch (e) { console.error(e); } finally { setIsAdding(false); }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!firestore || !exam) return;
    if(!confirm('حذف السؤال نهائياً؟')) return;
    await deleteDoc(doc(firestore, 'courses', exam.courseId, 'content', exam.id, 'questions', id));
    toast({ title: "تم الحذف" });
  };

  return (
    <div className="space-y-8 text-right p-4">
      <Card className="bg-secondary/20 border-dashed border-primary/20 p-8 rounded-3xl">
        <h3 className="font-black text-xl mb-6 flex flex-row-reverse items-center gap-2 justify-start"><Plus className="w-6 h-6 text-primary" /> إضافة سؤال جديد</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <Label className="font-bold">نص السؤال</Label>
                <Input placeholder="اكتب السؤال هنا..." className="text-right bg-background h-12 rounded-xl" value={newQuestion.text} onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})} />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label className="font-bold">النوع</Label>
                   <Select value={newQuestion.type} onValueChange={(v) => setNewQuestion({...newQuestion, type: v})}>
                      <SelectTrigger className="text-right bg-background h-12 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="MCQ">اختيار من متعدد</SelectItem>
                         <SelectItem value="ESSAY">سؤال مقالي</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <Label className="font-bold">الدرجات</Label>
                   <Input type="number" className="text-center bg-background h-12 rounded-xl" value={newQuestion.points} onChange={(e) => setNewQuestion({...newQuestion, points: e.target.value})} />
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 justify-end font-bold">رابط صورة السؤال (اختياري) <ImageIcon className="w-4 h-4 text-primary" /></Label>
            <Input placeholder="ألصق رابط الصورة المباشر هنا لظهوره للطالب" className="text-right bg-background h-12 rounded-xl" value={newQuestion.imageUrl} onChange={(e) => setNewQuestion({...newQuestion, imageUrl: e.target.value})} />
            {newQuestion.imageUrl && (
              <div className="mt-4 border-2 border-primary/10 rounded-2xl overflow-hidden bg-black/10 flex justify-center p-2 shadow-inner">
                 <img src={newQuestion.imageUrl} alt="Preview" className="max-h-56 object-contain" />
              </div>
            )}
          </div>

          {newQuestion.type === 'MCQ' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background/30 p-6 rounded-2xl border border-primary/5">
                {[0,1,2,3].map(i => (
                  <div key={i} className="flex flex-row-reverse items-center gap-3">
                    <Input placeholder={`خيار ${i+1}`} className="text-right flex-grow h-12 bg-background rounded-xl" value={newQuestion.options[i]} onChange={(e) => {
                        const opts = [...newQuestion.options];
                        opts[i] = e.target.value;
                        setNewQuestion({...newQuestion, options: opts});
                    }} />
                    <Button variant={newQuestion.correctIndex === i ? "default" : "outline"} className="w-12 h-12 p-0 rounded-xl" onClick={() => setNewQuestion({...newQuestion, correctIndex: i})}>
                      {newQuestion.correctIndex === i ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-5 h-5" />}
                    </Button>
                  </div>
                ))}
            </div>
          )}

          <Button onClick={handleAddQuestion} disabled={isAdding || !newQuestion.text} className="w-full bg-primary text-primary-foreground font-black h-14 rounded-2xl shadow-xl shadow-primary/20 text-lg">
            {isAdding ? <Loader2 className="w-6 h-6 animate-spin" /> : "نشر السؤال الآن"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <h4 className="font-black text-lg border-r-4 border-primary pr-3 mt-8">الأسئلة الحالية ({questions?.length || 0}):</h4>
        {isLoading ? <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /> :
        questions?.map((q, idx) => (
          <div key={q.id} className="p-6 bg-card border border-primary/5 rounded-[2rem] flex flex-row-reverse items-center justify-between group hover:border-primary/20 transition-all shadow-md">
             <div className="flex flex-row-reverse items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-black text-sm">{idx+1}</div>
                {q.imageUrl && <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden border-2 border-white/5 shadow-inner"><img src={q.imageUrl} className="w-full h-full object-contain" /></div>}
                <div className="text-right min-w-0">
                   <p className="font-bold text-lg truncate max-w-[500px]">{q.questionText}</p>
                   <div className="flex flex-row-reverse gap-4 mt-2">
                      <Badge variant="outline" className="text-[10px] font-black px-3 py-0.5 rounded-full">{q.questionType === 'MCQ' ? 'اختيار من متعدد' : 'سؤال مقالي'}</Badge>
                      <span className="text-[10px] font-bold text-primary">{q.points} درجة</span>
                   </div>
                </div>
             </div>
             <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-destructive/10" onClick={() => handleDeleteQuestion(q.id)}>
               <Trash2 className="w-5 h-5" />
             </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
