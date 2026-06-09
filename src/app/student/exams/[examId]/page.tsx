"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Clock, 
  Trophy,
  ShieldAlert,
  XCircle,
  Layout,
  ChevronRight,
  ChevronLeft,
  SendHorizontal,
  Lock
} from 'lucide-react';
import { useUser, useFirebase, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, addDoc, doc, getDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function TakeExamPage() {
  const { examId } = useParams();
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [finishedResult, setFinishedResult] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (finishedResult) return;
    const triggerProtection = () => setIsBlocked(true);
    const restoreView = () => setTimeout(() => setIsBlocked(false), 2000);
    
    window.addEventListener('blur', triggerProtection);
    window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') triggerProtection(); });
    window.addEventListener('focus', restoreView);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    return () => {
      window.removeEventListener('blur', triggerProtection);
      window.removeEventListener('focus', restoreView);
    };
  }, [finishedResult]);

  useEffect(() => {
    const findCourse = async () => {
      if (!firestore || !examId) return;
      const snap = await getDocs(collection(firestore, 'courses'));
      for (const d of snap.docs) {
        const cSnap = await getDocs(query(collection(firestore, 'courses', d.id, 'content'), where('__name__', '==', examId)));
        if (!cSnap.empty) { setCourseId(d.id); break; }
      }
    };
    findCourse();
  }, [firestore, examId]);

  const previousAttemptsRef = useMemoFirebase(() => {
    if (!firestore || !user || !examId) return null;
    return query(
      collection(firestore, 'students', user.uid, 'quiz_attempts'),
      where('courseContentId', '==', examId)
    );
  }, [firestore, user, examId]);

  const { data: previousAttempts, isLoading: isCheckingAttempts } = useCollection(previousAttemptsRef);

  const examRef = useMemoFirebase(() => (firestore && courseId && examId) ? doc(firestore, 'courses', courseId, 'content', examId as string) : null, [firestore, courseId, examId]);
  const { data: exam, isLoading: isExamLoading } = useDoc(examRef);

  useEffect(() => { 
    if (exam?.durationMinutes && timeLeft === null) setTimeLeft(exam.durationMinutes * 60); 
  }, [exam, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !finishedResult && !previousAttempts?.length) handleSubmit();
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft(p => p! - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, finishedResult, previousAttempts]);

  const questionsRef = useMemoFirebase(() => (firestore && courseId && examId) ? query(collection(firestore, 'courses', courseId, 'content', examId as string, 'questions'), orderBy('orderIndex', 'asc')) : null, [firestore, courseId, examId]);
  const { data: questions, isLoading: isQuestionsLoading } = useCollection(questionsRef);

  const handleSubmit = async () => {
    if (isSubmitting || !questions || !user || !firestore) return;
    
    setIsSubmitting(true);
    try {
      const studentRef = doc(firestore, 'students', user.uid);
      const studentSnap = await getDoc(studentRef);
      const studentData = studentSnap.exists() ? studentSnap.data() : null;
      const name = studentData?.name || 'طالب مجهول';
      
      let scoreAchieved = 0;
      let totalPoints = 0;
      const submissionAnswers = [];

      for (const q of questions) {
        totalPoints += (Number(q.points) || 0);
        const ans = answers[q.id] || {};
        let correct = false;
        let points = 0;

        if (q.questionType === 'MCQ') {
          const optsRef = collection(firestore, 'courses', courseId!, 'content', examId as string, 'questions', q.id, 'options');
          const optsSnap = await getDocs(optsRef);
          const correctOpt = optsSnap.docs.find(d => d.data().isCorrect);
          if (correctOpt && correctOpt.id === ans.mcqOptionId) { 
            correct = true; 
            points = (Number(q.points) || 0); 
            scoreAchieved += points; 
          }
        }
        
        submissionAnswers.push({ 
          questionId: q.id, 
          questionType: q.questionType, 
          mcqSelectedOptionId: ans.mcqOptionId || null, 
          essayAnswerText: ans.essayText || '', 
          isCorrect: correct, 
          scoreAchieved: points, 
          maxPoints: (Number(q.points) || 0)
        });
      }

      const finalPercent = totalPoints > 0 ? Math.round((scoreAchieved / totalPoints) * 100) : 0;
      
      const attRef = await addDoc(collection(firestore, 'students', user.uid, 'quiz_attempts'), {
        studentId: user.uid, 
        studentName: name, 
        courseContentId: examId, 
        courseId: courseId, 
        submittedAt: new Date().toISOString(), 
        isGraded: questions.every(q => q.questionType === 'MCQ'), 
        score: finalPercent, 
        pointsAchieved: scoreAchieved, 
        totalPoints: totalPoints
      });

      for (const a of submissionAnswers) { 
        await addDoc(collection(firestore, 'students', user.uid, 'quiz_attempts', attRef.id, 'answers'), a); 
      }

      setFinishedResult({ 
        score: finalPercent, 
        points: scoreAchieved, 
        total: totalPoints, 
        isSuccess: finalPercent >= (exam?.passMarkPercentage || 50) 
      });
      
      toast({ title: "تم تسليم الامتحان" });
    } catch (e: any) { 
      console.error(e); 
      toast({ variant: "destructive", title: "خطأ في التسليم" });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (isBlocked) return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center text-center p-8">
      <ShieldAlert className="w-16 md:w-20 h-16 md:h-20 text-primary mb-6 animate-pulse" />
      <h2 className="text-2xl md:text-3xl font-black text-white">🚨 محتوى محمي</h2>
      <p className="text-primary font-bold mt-2 text-sm md:text-base">يمنع تصوير الشاشة لضمان نزاهة الامتحان.</p>
    </div>
  );

  if (previousAttempts && previousAttempts.length > 0 && !finishedResult) {
    const lastAttempt = previousAttempts[0];
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <Card className="w-full max-w-lg bg-card border-primary/20 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="h-3 md:h-4 bg-orange-500" />
          <CardContent className="p-8 md:p-10 space-y-6 md:space-y-8">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto text-orange-500">
              <Lock className="w-10 h-10 md:w-12 md:h-12" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-black">الاختبار مكتمل</h1>
              <p className="text-muted-foreground font-bold text-sm md:text-base">لقد استنفدت محاولتك في هذا الاختبار مسبقاً.</p>
            </div>
            <div className="p-5 md:p-6 bg-secondary/30 rounded-2xl md:rounded-3xl border border-white/5 space-y-2">
               <p className="text-[10px] font-black text-muted-foreground uppercase">نتيجتك السابقة</p>
               <p className="text-4xl md:text-5xl font-black text-primary">{lastAttempt.score}%</p>
               <p className="text-[10px] opacity-60">تاريخ: {new Date(lastAttempt.submittedAt).toLocaleDateString('ar-EG')}</p>
            </div>
            <Link href="/student/dashboard" className="block"><Button className="w-full h-14 md:h-16 bg-primary text-primary-foreground font-black rounded-xl md:rounded-2xl text-lg shadow-xl">العودة للوحة التحكم</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (finishedResult) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-right">
      <Card className="w-full max-w-lg bg-card border-primary/20 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        <div className={cn("h-3 md:h-4", finishedResult.isSuccess ? "bg-accent" : "bg-destructive")} />
        <CardContent className="p-8 md:p-12">
           <div className="text-center mb-8 md:mb-10 space-y-4">
              <div className={cn("w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto", finishedResult.isSuccess ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive")}>
                {finishedResult.isSuccess ? <Trophy className="w-10 h-10 md:w-12 md:h-12" /> : <XCircle className="w-10 h-10 md:w-12 md:h-12" />}
              </div>
              <h1 className="text-2xl md:text-4xl font-black">{finishedResult.isSuccess ? "عاش يا بطل!" : "محاولة جيدة"}</h1>
              <p className="text-muted-foreground font-bold text-sm md:text-base italic">لقد أتممت الاختبار بنجاح.</p>
           </div>
           {exam?.allowInstantResultsDisplay ? (
              <div className="grid grid-cols-1 gap-4 mb-8 md:mb-10">
                <div className="p-6 md:p-8 bg-secondary/30 rounded-2xl md:rounded-3xl border border-white/5 flex flex-col items-center justify-center">
                  <p className="text-5xl md:text-6xl font-black text-primary">{finishedResult.score}%</p>
                  <p className="text-[10px] font-black text-muted-foreground mt-2 uppercase">نسبة النجاح</p>
                </div>
              </div>
           ) : (
             <Card className="bg-primary/5 border-dashed border-primary/20 p-6 md:p-8 text-center rounded-2xl md:rounded-3xl mb-8 md:mb-10">
                <p className="text-primary font-bold text-sm md:text-base leading-relaxed">تم استلام إجاباتك بنجاح. ستظهر النتائج فور اعتمادها.</p>
             </Card>
           )}
           <Link href="/student/dashboard" className="block"><Button className="w-full h-14 md:h-16 bg-primary text-primary-foreground font-black rounded-xl md:rounded-2xl text-lg shadow-xl">العودة للوحة التحكم</Button></Link>
        </CardContent>
      </Card>
    </div>
  );

  const currentQ = questions?.[activeQuestionIndex];
  if (isCheckingAttempts || isExamLoading || isQuestionsLoading || !currentQ) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="font-bold text-muted-foreground">جاري التحضير...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32 text-right">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b w-full flex items-center justify-between p-3 md:p-4 px-4 md:px-6 shadow-sm">
          <div className="text-xs md:text-lg font-black bg-primary/10 px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-primary flex items-center gap-1.5 md:gap-2 border border-primary/20">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" /> 
            {timeLeft !== null ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 font-black px-4 md:px-10 h-10 md:h-12 rounded-lg md:rounded-xl text-xs md:text-sm gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
            <span>تسليم</span>
          </Button>
      </div>

      <main className="container mx-auto p-4 max-w-4xl pt-4 md:pt-6 space-y-6">
        <Card className="bg-card border-primary/10 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
           <div className="flex justify-between items-center flex-row-reverse mb-6">
             <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-3 md:px-4 py-1 text-[10px] md:text-sm rounded-full">سؤال {activeQuestionIndex + 1} من {questions.length}</Badge>
             <Badge variant="secondary" className="font-bold text-[9px] md:text-xs">{currentQ.points} درجة</Badge>
           </div>
           {currentQ.imageUrl && (
             <div className="w-full rounded-xl md:rounded-2xl overflow-hidden border-2 border-primary/10 bg-black/5 mb-6 md:mb-8 flex justify-center shadow-inner">
                <img src={currentQ.imageUrl} alt="" className="w-full h-auto max-h-[400px] md:max-h-[600px] object-contain block" />
             </div>
           )}
           <h2 className="text-lg md:text-2xl font-bold leading-relaxed border-r-4 border-primary pr-3 md:pr-4 mb-6 md:mb-8">{currentQ.questionText}</h2>
           {currentQ.questionType === 'MCQ' ? (
             <MCQOptions courseId={courseId!} examId={examId as string} qId={currentQ.id} selected={answers[currentQ.id]?.mcqOptionId} onSelect={(id:string) => setAnswers({...answers, [currentQ.id]: {mcqOptionId: id}})} />
           ) : (
             <Textarea placeholder="اكتب إجابتك هنا..." className="min-h-[150px] md:min-h-[200px] bg-secondary/10 rounded-2xl md:rounded-3xl p-4 md:p-6 text-base md:text-lg border-primary/5 text-right resize-none" value={answers[currentQ.id]?.essayText || ''} onChange={(e) => setAnswers({...answers, [currentQ.id]: {essayText: e.target.value}})} />
           )}
           <div className="flex justify-between pt-8 md:pt-10 gap-3 md:gap-4">
              <Button variant="outline" disabled={activeQuestionIndex === 0} onClick={() => setActiveQuestionIndex(p => p - 1)} className="h-12 md:h-14 flex-1 rounded-xl md:rounded-2xl font-black border-primary/20 text-primary text-xs md:text-base gap-1.5 md:gap-2"><ChevronRight className="w-4 h-4 md:w-5 md:h-5" /> السابق</Button>
              <Button variant="outline" disabled={activeQuestionIndex === questions.length - 1} onClick={() => setActiveQuestionIndex(p => p + 1)} className="h-12 md:h-14 flex-1 rounded-xl md:rounded-2xl font-black border-primary/20 text-primary text-xs md:text-base gap-1.5 md:gap-2">التالي <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" /></Button>
           </div>
        </Card>
        <Card className="bg-card border-primary/5 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] shadow-lg">
            <h3 className="font-black text-[10px] md:text-xs mb-3 md:mb-4 border-b border-white/5 pb-2 flex items-center gap-2 justify-end opacity-60">خارطة تقدمك <Layout className="w-3.5 h-3.5" /></h3>
            <div className="flex flex-wrap gap-2 justify-center">
               {questions.map((q, i) => {
                  const isSolved = (answers[q.id]?.mcqOptionId || (answers[q.id]?.essayText && answers[q.id]?.essayText.trim().length > 0));
                  return (
                    <button key={q.id} onClick={() => setActiveQuestionIndex(i)} className={cn("w-9 h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center font-black text-xs md:text-sm transition-all shadow-sm", activeQuestionIndex === i ? "ring-2 md:ring-4 ring-primary/30 bg-primary text-primary-foreground scale-110" : isSolved ? "bg-accent text-white" : "bg-secondary/40 text-muted-foreground")}>{i + 1}</button>
                  );
               })}
            </div>
        </Card>
      </main>
    </div>
  );
}

function MCQOptions({ courseId, examId, qId, selected, onSelect }: any) {
  const firestore = useFirestore();
  const optionsRef = useMemoFirebase(() => firestore ? collection(firestore, 'courses', courseId, 'content', examId, 'questions', qId, 'options') : null, [firestore, qId, courseId, examId]);
  const { data: options, isLoading } = useCollection(optionsRef);
  if (isLoading) return <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>;
  return (
    <div className="grid gap-2 md:gap-3">
      {options?.map(o => (
        <div key={o.id} onClick={() => onSelect(o.id)} className={cn("flex flex-row-reverse items-center gap-3 md:gap-4 p-4 md:p-6 border-2 rounded-2xl md:rounded-3xl cursor-pointer transition-all active:scale-[0.98]", selected === o.id ? "border-primary bg-primary/10 shadow-inner" : "border-white/5 bg-secondary/5")}>
           <div className={cn("w-5 h-5 md:w-6 md:h-6 rounded-full border-2 shrink-0", selected === o.id ? "border-primary bg-primary" : "border-muted")} />
           <Label className="flex-grow font-bold text-base md:text-xl cursor-pointer text-right leading-tight">{o.optionText}</Label>
        </div>
      ))}
    </div>
  );
}