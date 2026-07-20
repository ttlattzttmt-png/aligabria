
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function StudentExamsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const attemptsRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return collection(firestore, 'students', user.uid, 'quiz_attempts');
  }, [firestore, user?.uid]);

  const { data: attempts, isLoading } = useCollection(attemptsRef);

  if (isUserLoading || isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right">
      <div>
        <h1 className="text-4xl font-headline font-bold mb-2">سجل درجاتي</h1>
        <p className="text-muted-foreground font-bold italic">تظهر النتائج فوراً إذا سمح الدكتور بذلك، أو بعد التصحيح اليدوي.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!attempts || attempts.length === 0 ? (
          <Card className="col-span-full p-12 text-center border-dashed border-2 bg-secondary/10 rounded-[2rem]">
             <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
             <p className="text-muted-foreground font-bold">لم تؤدِ أي اختبارات بعد.</p>
          </Card>
        ) : (
          attempts.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map((attempt) => (
            <ExamResultCard key={attempt.id} attempt={attempt} />
          ))
        )}
      </div>
    </div>
  );
}

function ExamResultCard({ attempt }: { attempt: any }) {
  const firestore = useFirestore();
  
  const examRef = useMemoFirebase(() => {
    if (!firestore || !attempt.courseId || !attempt.courseContentId) return null;
    return doc(firestore, 'courses', attempt.courseId, 'content', attempt.courseContentId);
  }, [firestore, attempt.courseId, attempt.courseContentId]);
  
  const { data: exam } = useDoc(examRef);
  
  // النتائج تظهر إذا كان الخيار مفعلاً في الإعدادات أو إذا اعتمد المدرس الدرجة يدوياً
  const canShowScore = exam?.allowInstantResultsDisplay || attempt.isGraded;

  return (
    <Card className="bg-card border-primary/10 rounded-3xl overflow-hidden shadow-lg transition-all hover:border-primary/30">
      <CardHeader className="border-b bg-secondary/5 py-4 px-6 flex flex-row-reverse items-center justify-between">
        <Badge variant={canShowScore ? "default" : "secondary"} className={cn(canShowScore ? "bg-accent text-white" : "opacity-50")}>
          {canShowScore ? "النتيجة متاحة" : "قيد التصحيح"}
        </Badge>
        <CardTitle className="text-lg font-black truncate max-w-[200px] text-right">
          {exam?.title || 'اختبار مجهول'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center p-6 bg-secondary/20 rounded-2xl border border-white/5">
          {canShowScore ? (
            <div className="text-center animate-in zoom-in">
              <p className="text-5xl font-black text-primary">{attempt.score}%</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-2">({attempt.pointsAchieved} من {attempt.totalPoints} درجة)</p>
            </div>
          ) : (
            <div className="text-center opacity-40">
              <Lock className="w-10 h-10 mb-2 mx-auto text-primary" />
              <p className="text-xs font-black">النتيجة ستظهر قريباً</p>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-row-reverse justify-between items-center text-[9px] text-muted-foreground font-bold">
          <span>{new Date(attempt.submittedAt).toLocaleDateString('ar-EG')}</span>
          <span className={cn(attempt.isGraded ? "text-accent" : "text-primary")}>
            {attempt.isGraded ? "مكتمل التصحيح ✓" : "جاري المراجعة..."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
