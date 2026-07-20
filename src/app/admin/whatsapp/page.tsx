
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  MessageCircle, 
  Send, 
  CheckCircle2, 
  Users, 
  Loader2,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  Zap,
  CheckSquare,
  Square
} from 'lucide-react';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, setDoc, collection, deleteDoc, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendAutomatedMessage } from '@/lib/whatsapp-utils';

export default function WhatsAppDashboard() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  // إعدادات الربط
  const [gatewayConfig, setGatewayConfig] = useState({
    senderNumber: '',
    apiKey: '',
    instanceId: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // إعدادات البث
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'course' | 'specific'>('all');
  const [audienceTarget, setAudienceTarget] = useState<'student' | 'parent' | 'both'>('student');
  const [selectedCourseId, setSelectedCourseId] = useState('all_courses');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [sendDelay, setSendDelay] = useState(7); // ثواني بين كل رسالة

  // حالة الإرسال الآلي
  const [isSending, setIsSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });

  const configRef = useMemoFirebase(() => (firestore ? doc(firestore, 'admin_config', 'whatsapp') : null), [firestore]);
  const { data: savedConfig } = useDoc(configRef);

  useEffect(() => {
    if (savedConfig) {
      setGatewayConfig({
        senderNumber: savedConfig.senderNumber || '',
        apiKey: savedConfig.apiKey || '',
        instanceId: savedConfig.instanceId || ''
      });
    }
  }, [savedConfig]);

  const studentsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'students') : null), [firestore]);
  const coursesRef = useMemoFirebase(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const enrollmentsGroupRef = useMemoFirebase(() => (firestore ? collectionGroup(firestore, 'enrollments') : null), [firestore]);
  
  const { data: students } = useCollection(studentsRef);
  const { data: courses } = useCollection(coursesRef);
  const { data: allEnrollments } = useCollection(enrollmentsGroupRef);

  // منطق الفلترة والبحث المطور
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    let list = [...students];
    
    // فلترة حسب الكورس
    if (selectedCourseId !== 'all_courses') {
      const courseStudentIds = allEnrollments?.filter(en => en.courseId === selectedCourseId).map(en => en.studentId) || [];
      list = list.filter(s => courseStudentIds.includes(s.id));
    }

    // بحث بالاسم أو الهاتف
    if (searchTerm) {
      const sLower = searchTerm.toLowerCase();
      list = list.filter(s => 
        (s.name || '').toLowerCase().includes(sLower) || 
        (s.studentPhoneNumber || '').includes(sLower) ||
        (s.parentPhoneNumber || '').includes(sLower)
      );
    }
    
    return list;
  }, [students, selectedCourseId, searchTerm, allEnrollments]);

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const allIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(allIds);
    toast({ title: "تم تحديد الجميع", description: `تم اختيار ${allIds.length} طالب من القائمة الحالية.` });
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
    toast({ title: "تم إلغاء التحديد" });
  };

  const handleSaveConfig = async () => {
    if (!firestore || !gatewayConfig.senderNumber) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'admin_config', 'whatsapp'), { 
        ...gatewayConfig, 
        status: gatewayConfig.apiKey ? 'connected' : 'standalone', 
        lastUpdated: new Date().toISOString() 
      }, { merge: true });
      toast({ title: "تم حفظ الإعدادات بنجاح" });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const startAutomatedBroadcast = async () => {
    if (!broadcastMessage || isSending) return;
    
    const targets = targetType === 'specific' 
      ? students?.filter(s => selectedStudentIds.includes(s.id)) 
      : filteredStudents;

    if (!targets || targets.length === 0) {
      toast({ variant: "destructive", title: "لا يوجد مستلمون", description: "يرجى تحديد طلاب للإرسال إليهم." });
      return;
    }

    setIsSending(true);
    setSendingProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const s = targets[i];
      setSendingProgress(p => ({ ...p, current: i + 1 }));

      // إرسال للطالب
      if (audienceTarget === 'student' || audienceTarget === 'both') {
        await sendAutomatedMessage(s.studentPhoneNumber, broadcastMessage, savedConfig as any);
      }
      
      // إرسال لولي الأمر
      if (audienceTarget === 'parent' || audienceTarget === 'both') {
        await sendAutomatedMessage(s.parentPhoneNumber, broadcastMessage, savedConfig as any);
      }

      // تأخير زمني لمنع الحظر (Delay)
      if (i < targets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, sendDelay * 1000));
      }
    }

    setIsSending(false);
    toast({ title: "اكتمل البث الآلي", description: `تمت مراسلة ${targets.length} طالب بنجاح.` });
    setBroadcastMessage('');
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 animate-spin text-primary" /></div>;

  const isApiReady = !!(savedConfig?.apiKey && savedConfig?.instanceId);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-right">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="text-right">
          <h1 className="text-4xl md:text-5xl font-headline font-black mb-2 flex items-center gap-3 justify-end">
            منظومة المراسلة والتحكم <MessageCircle className="w-10 h-10 text-accent" />
          </h1>
          <p className="text-muted-foreground font-bold">تحكم كامل في الطلاب، الكورسات، والبث الآلي المجدول.</p>
        </div>
        <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 shadow-lg ${isApiReady ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
           {isApiReady ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
           <span className="font-black text-sm">{isApiReady ? 'الربط الحقيقي نشط' : 'وضع الإرسال اليدوي'}</span>
        </div>
      </div>

      <Tabs defaultValue="broadcast" className="space-y-8">
        <TabsList className="bg-card border h-16 p-1.5 rounded-3xl">
          <TabsTrigger value="broadcast" className="h-full rounded-2xl px-8 font-black">إدارة البث المتقدم</TabsTrigger>
          <TabsTrigger value="config" className="h-full rounded-2xl px-8 font-black">إعدادات الـ API</TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* قائمة الطلاب والفلترة */}
            <Card className="lg:col-span-1 bg-card border-primary/10 rounded-[2rem] overflow-hidden flex flex-col h-[800px]">
               <CardHeader className="bg-secondary/10 border-b p-6 space-y-4">
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black opacity-50 block">فلترة حسب الكورس</Label>
                     <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="h-12 bg-background font-bold border-primary/5">
                           <SelectValue placeholder="اختر الكورس" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="all_courses">كل الكورسات</SelectItem>
                           {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>

                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="ابحث بالاسم أو الهاتف..." 
                      className="h-12 pr-10 text-right bg-background" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSelectAll} variant="outline" className="flex-1 h-10 gap-2 font-bold text-[10px] border-primary/20">
                      <CheckSquare className="w-3 h-3" /> تحديد الكل
                    </Button>
                    <Button onClick={handleDeselectAll} variant="outline" className="flex-1 h-10 gap-2 font-bold text-[10px] border-destructive/20 text-destructive">
                      <Square className="w-3 h-3" /> إلغاء التحديد
                    </Button>
                  </div>
               </CardHeader>
               
               <CardContent className="p-0 flex-grow relative">
                  <ScrollArea className="h-full absolute inset-0">
                     <div className="p-4 space-y-2">
                        {filteredStudents.length === 0 ? (
                          <div className="text-center py-20 text-muted-foreground italic text-xs">لا يوجد طلاب مطابقين للبحث.</div>
                        ) : filteredStudents.map(s => (
                           <div 
                             key={s.id} 
                             onClick={() => handleToggleStudent(s.id)}
                             className={`flex flex-row-reverse items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${selectedStudentIds.includes(s.id) ? 'bg-primary/10 border-primary/40 shadow-inner' : 'bg-secondary/5 border-white/5 hover:bg-secondary/10'}`}
                           >
                              <div className="flex flex-row-reverse items-center gap-4">
                                 <Checkbox 
                                   checked={selectedStudentIds.includes(s.id)} 
                                   onCheckedChange={() => handleToggleStudent(s.id)} 
                                   className="pointer-events-none"
                                 />
                                 <div className="text-right">
                                    <p className="text-xs font-black">{s.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{s.studentPhoneNumber}</p>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </ScrollArea>
               </CardContent>
               <div className="p-4 bg-secondary/20 border-t flex justify-between items-center px-6">
                  <span className="text-[10px] font-black opacity-50">تم اختيار:</span>
                  <Badge className="bg-primary text-primary-foreground font-black">{selectedStudentIds.length} طالب</Badge>
               </div>
            </Card>

            {/* محرر الرسالة وأدوات التحكم */}
            <Card className="lg:col-span-2 bg-card border-primary/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[800px]">
               <CardHeader className="bg-secondary/10 p-8 border-b">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <CardTitle className="text-3xl font-black">نص الرسالة الجماعية</CardTitle>
                    <div className="flex flex-col items-end gap-2">
                       <span className="text-[10px] font-black opacity-60">تأخير الحماية: {sendDelay} ثوانٍ</span>
                       <Input 
                        type="range" min="3" max="30" 
                        value={sendDelay} 
                        onChange={(e) => setSendDelay(Number(e.target.value))} 
                        className="w-32 h-2 accent-primary" 
                       />
                    </div>
                  </div>
               </CardHeader>
               
               <CardContent className="p-8 flex-grow flex flex-col gap-6">
                  <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 space-y-4">
                    <Label className="font-black text-xs block mb-2">من يستلم الرسالة؟</Label>
                    <RadioGroup value={audienceTarget} onValueChange={(v:any) => setAudienceTarget(v)} className="flex flex-row-reverse flex-wrap gap-8">
                       <div className="flex items-center gap-2 flex-row-reverse"><RadioGroupItem value="student" /><Label className="font-bold cursor-pointer">الطالب فقط</Label></div>
                       <div className="flex items-center gap-2 flex-row-reverse"><RadioGroupItem value="parent" /><Label className="font-bold cursor-pointer">ولي الأمر فقط</Label></div>
                       <div className="flex items-center gap-2 flex-row-reverse"><RadioGroupItem value="both" /><Label className="font-bold cursor-pointer">الاثنين معاً</Label></div>
                    </RadioGroup>
                  </div>

                  <Textarea 
                    placeholder="اكتب رسالتك هنا.. سيتم استخدام الاسم الرباعي للطالب تلقائياً إذا كان الإرسال فردياً."
                    className="flex-grow bg-secondary/10 rounded-[2.5rem] border-primary/10 p-10 font-bold text-2xl text-right resize-none focus:border-primary focus:ring-0 shadow-inner"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    disabled={isSending}
                  />

                  {isSending && (
                    <div className="space-y-3 animate-in slide-in-from-bottom duration-500 bg-secondary/10 p-6 rounded-3xl border border-white/5">
                       <div className="flex justify-between text-xs font-black text-primary">
                          <span>جاري بث الرسائل الآلية: {sendingProgress.current} / {sendingProgress.total}</span>
                          <span className="font-mono">{Math.round((sendingProgress.current / sendingProgress.total) * 100)}%</span>
                       </div>
                       <Progress value={(sendingProgress.current / sendingProgress.total) * 100} className="h-4 bg-background rounded-full border border-primary/10" />
                       <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-2">
                          <Clock className="w-3 h-3 animate-spin text-primary" /> نظام الحماية نشط.. ننتظر {sendDelay} ثوانٍ بين كل عملية.
                       </p>
                    </div>
                  )}

                  {!isApiReady && (
                    <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-500 text-[11px] font-bold">
                       <AlertCircle className="w-5 h-5 shrink-0" />
                       <span>تنبيه: أنت في "وضع الإرسال اليدوي"؛ ستقوم المنصة بفتح المحادثات لك. للتشغيل الآلي الكامل، يرجى ضبط الـ API Key في الإعدادات.</span>
                    </div>
                  )}

                  <Button 
                    className={`w-full h-24 text-white font-black text-3xl rounded-[2.5rem] shadow-2xl gap-5 transition-all active:scale-95 ${isSending ? 'bg-secondary cursor-not-allowed' : 'bg-accent hover:bg-accent/90 shadow-accent/20'}`}
                    onClick={startAutomatedBroadcast}
                    disabled={!broadcastMessage || isSending || (targetType === 'specific' && selectedStudentIds.length === 0)}
                  >
                    {isSending ? <Loader2 className="w-10 h-10 animate-spin" /> : <Zap className="w-10 h-10 fill-current" />}
                    {isSending ? "جاري الإرسال الآلي..." : `إرسال إلى ${selectedStudentIds.length || filteredStudents.length} مستلم`}
                  </Button>
               </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="config">
           <Card className="max-w-4xl mx-auto bg-card border-primary/10 rounded-[3rem] p-12 space-y-12 text-right shadow-2xl">
              <div className="text-center space-y-4">
                 <h2 className="text-4xl font-black text-primary">إعدادات الربط المؤسسي</h2>
                 <p className="text-muted-foreground font-bold text-lg italic">اربط المنصة ببوابة المراسلة العالمية لتفعيل الأتمتة الكاملة.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <Label className="font-black text-lg mr-2 block">رقم الواتساب الرسمي</Label>
                    <Input 
                      placeholder="مثال: 01066272261" 
                      className="h-16 text-center text-2xl font-black rounded-2xl bg-secondary/30 border-primary/5 focus:border-primary"
                      value={gatewayConfig.senderNumber}
                      onChange={(e) => setGatewayConfig({...gatewayConfig, senderNumber: e.target.value})}
                    />
                 </div>
                 <div className="space-y-4">
                    <Label className="font-black text-lg mr-2 block">Instance ID (المعرف)</Label>
                    <Input 
                      placeholder="معرف الجهاز في البوابة" 
                      className="h-16 text-center font-mono text-xl rounded-2xl bg-secondary/30 border-primary/5 focus:border-primary"
                      value={gatewayConfig.instanceId}
                      onChange={(e) => setGatewayConfig({...gatewayConfig, instanceId: e.target.value})}
                    />
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="font-black text-lg mr-2 block">API Key (مفتاح الربط السري)</Label>
                 <Input 
                   type="password"
                   placeholder="ألصق رمز الـ Token هنا" 
                   className="h-16 text-center font-mono text-xl rounded-2xl bg-secondary/30 border-primary/5 focus:border-primary"
                   value={gatewayConfig.apiKey}
                   onChange={(e) => setGatewayConfig({...gatewayConfig, apiKey: e.target.value})}
                 />
              </div>

              <div className="flex flex-col gap-6 pt-6">
                 <Button 
                   onClick={handleSaveConfig} 
                   disabled={isSaving || !gatewayConfig.senderNumber} 
                   className="w-full h-20 bg-primary text-primary-foreground font-black text-2xl rounded-3xl shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-transform"
                 >
                   {isSaving ? <Loader2 className="w-8 h-8 animate-spin" /> : "تفعيل وحفظ منظومة الربط"}
                 </Button>
                 
                 {savedConfig?.senderNumber && (
                    <Button 
                      onClick={async () => {
                        if(confirm('هل أنت متأكد من حذف إعدادات الربط؟')) {
                          await deleteDoc(doc(firestore!, 'admin_config', 'whatsapp'));
                          toast({ title: "تم الحذف" });
                        }
                      }} 
                      variant="ghost" 
                      className="text-destructive font-black text-sm h-14 hover:bg-destructive/10 rounded-2xl"
                    >
                      <Trash2 className="w-5 h-5 ml-2" /> إلغاء ربط الرقم الحالي وتصفير الإعدادات
                    </Button>
                 )}
              </div>

              <div className="p-8 bg-secondary/20 rounded-[2.5rem] border-2 border-dashed border-white/5 space-y-6">
                 <h4 className="font-black text-xl flex items-center gap-3 justify-end text-primary">توجيهات الحماية القصوى <AlertCircle className="w-6 h-6" /></h4>
                 <ul className="text-sm text-muted-foreground space-y-4 font-bold leading-relaxed text-right">
                    <li className="flex flex-row-reverse gap-3 items-start"><span className="text-primary">•</span> <span>نوصي بشدة بترك التأخير عند (7 ثوانٍ) على الأقل في حالة المراسلات التي تتخطى 50 طالب.</span></li>
                    <li className="flex flex-row-reverse gap-3 items-start"><span className="text-primary">•</span> <span>كود الدولة المصري (+20) يتم إضافته ومعالجة الرقم آلياً من قبل النظام البرمجي للمنصة.</span></li>
                    <li className="flex flex-row-reverse gap-3 items-start"><span className="text-primary">•</span> <span>في حالة تعطل الـ API، سيتحول النظام آلياً لوضع "الفتح اليدوي" لضمان عدم توقف تواصلك مع الطلاب.</span></li>
                 </ul>
              </div>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
