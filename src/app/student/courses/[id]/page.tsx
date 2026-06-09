
"use client";

import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { 
  Loader2, 
  Clock, 
  PlayCircle, 
  PauseCircle,
  Lock, 
  BookOpen, 
  ChevronLeft, 
  Trophy, 
  CheckCircle2,
  Volume2,
  Settings2,
  Maximize
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';

// استيراد المشغل بشكل ديناميكي لضمان التوافقية
const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

export default function CourseViewer() {
  const { id } = useParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeContent, setActiveContent] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });

  // حالات المشغل المخصص
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);

  // جلب بروفايل الطالب
  const studentRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'students', user.uid) : null, [firestore, user]);
  const { data: studentProfile } = useDoc(studentRef);

  // جلب بيانات الكورس
  const courseRef = useMemoFirebase(() => (firestore && id) ? doc(firestore, 'courses', id as string) : null, [firestore, id]);
  const { data: course, isLoading: isCourseLoading } = useDoc(courseRef);

  // جلب الاشتراك
  const enrollmentRef = useMemoFirebase(() => (firestore && user && id) ? doc(firestore, 'students', user.uid, 'enrollments', id as string) : null, [firestore, user, id]);
  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc(enrollmentRef);
  
  // جلب محتوى الكورس
  const contentRef = useMemoFirebase(() => (firestore && id) ? query(collection(firestore, 'courses', id as string, 'content'), orderBy('orderIndex', 'asc')) : null, [firestore, id]);
  const { data: contents, isLoading: isContentLoading } = useCollection(contentRef);

  const visibleContents = useMemo(() => contents?.filter(c => c.isVisible !== false) || [], [contents]);

  // جلب سجل تقدم الطالب
  const videoProgressRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'students', user.uid, 'video_progress') : null, [firestore, user]);
  const { data: completedVideos } = useCollection(videoProgressRef);

  useEffect(() => { 
    if (visibleContents.length > 0 && !activeContent) {
      setActiveContent(visibleContents[0]);
    }
  }, [visibleContents, activeContent]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 70) + 10}%`,
        left: `${Math.floor(Math.random() * 70) + 10}%`
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // وظائف التحكم في المشغل
  const handlePlayPause = () => setPlaying(!playing);
  
  const handleProgress = (state: any) => {
    if (!seeking) {
      setPlayed(state.played);
    }
  };

  const handleSeekChange = (value: number[]) => {
    setPlayed(value[0]);
  };

  const handleSeekMouseUp = (value: number[]) => {
    setSeeking(false);
    playerRef.current?.seekTo(value[0]);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const handleMarkAsCompleted = async () => {
    if (!firestore || !user || !id || !activeContent || isCompleting) return;
    
    setIsCompleting(true);
    try {
      const progressDocRef = doc(firestore, 'students', user.uid, 'video_progress', activeContent.id);
      const progressSnap = await getDoc(progressDocRef);
      
      if (!progressSnap.exists() || !progressSnap.data().isCompleted) {
        await setDoc(progressDocRef, {
          courseId: id,
          contentId: activeContent.id,
          studentId: user.uid,
          isCompleted: true,
          completedAt: new Date().toISOString()
        }, { merge: true });

        await updateDoc(doc(firestore, 'students', user.uid), {
          points: increment(10)
        });

        if (enrollment) {
          const totalItems = visibleContents.length || 1;
          const newlyCompletedCount = (completedVideos?.length || 0) + 1;
          const newProgress = Math.min(100, Math.round((newlyCompletedCount / totalItems) * 100));
          
          await updateDoc(doc(firestore, 'students', user.uid, 'enrollments', id as string), {
            progressPercentage: newProgress,
            lastActivity: new Date().toISOString()
          });
        }

        toast({
          title: "عاش يا بطل! 🚀",
          description: "تم تسجيل إتمام المحاضرة وإضافة 10 نقاط لرصيدك.",
        });
      } else {
        toast({ title: "المحاضرة مكتملة بالفعل" });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "حدث خطأ في تحديث البيانات" });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isUserLoading || isCourseLoading || isEnrollmentLoading || isContentLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="font-bold text-muted-foreground animate-pulse italic">جاري تحضير القاعة التعليمية...</p>
      </div>
    );
  }

  const hasAccess = (enrollment && enrollment.status === 'active') || course?.price === 0;
  if (!hasAccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
      <Lock className="w-20 h-20 text-primary opacity-20" />
      <h2 className="text-3xl font-black">محتوى مغلق</h2>
      <p className="text-muted-foreground">بشمهندس، يرجى الاشتراك في الكورس أولاً لتتمكن من المشاهدة.</p>
      <Link href="/student/redeem"><Button className="bg-primary font-bold h-12 px-8 rounded-xl">تفعيل كود الحصة</Button></Link>
    </div>
  );

  const isCurrentVideoCompleted = completedVideos?.some(v => v.contentId === activeContent?.id);

  return (
    <div className="min-h-screen flex flex-col bg-background text-right">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            {activeContent?.contentType === 'Video' ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                {/* مشغل الفيديو المخصص */}
                <div ref={playerContainerRef} className="relative aspect-video rounded-[2.5rem] overflow-hidden bg-black shadow-2xl border border-white/10 group select-none">
                   <ReactPlayer
                      ref={playerRef}
                      url={activeContent.youtubeLink}
                      width="100%"
                      height="100%"
                      playing={playing}
                      volume={volume}
                      playbackRate={playbackRate}
                      onProgress={handleProgress}
                      onDuration={handleDuration}
                      config={{ 
                        youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 0, disablekb: 1 } } 
                      }}
                   />

                   {/* علامة مائية */}
                   <div 
                    className="absolute pointer-events-none opacity-10 select-none z-50 transition-all duration-1000"
                    style={{ top: watermarkPos.top, left: watermarkPos.left }}
                   >
                      <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 rotate-[-15deg]">
                        <p className="text-sm font-black text-white" dir="ltr">
                          {studentProfile?.studentPhoneNumber || 'AL-BASHMOHANDES'}
                        </p>
                      </div>
                   </div>

                   {/* واجهة تحكم مخصصة تظهر عند التحويم */}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                      <div className="space-y-4">
                        {/* شريط التقدم */}
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-mono text-white/70">{formatTime(played * duration)}</span>
                           <Slider 
                            value={[played]} 
                            max={0.999999} 
                            step={0.000001}
                            onValueChange={handleSeekChange}
                            onValueCommit={handleSeekMouseUp}
                            className="flex-grow cursor-pointer"
                           />
                           <span className="text-[10px] font-mono text-white/70">{formatTime(duration)}</span>
                        </div>

                        {/* أزرار التحكم */}
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-6">
                              <button onClick={handlePlayPause} className="text-white hover:text-primary transition-colors">
                                {playing ? <PauseCircle className="w-10 h-10" /> : <PlayCircle className="w-10 h-10" />}
                              </button>
                              
                              <div className="flex items-center gap-2 text-white/70 group/vol">
                                 <Volume2 className="w-5 h-5" />
                                 <Slider 
                                  value={[volume]} 
                                  max={1} 
                                  step={0.1} 
                                  onValueChange={(v) => setVolume(v[0])} 
                                  className="w-20"
                                 />
                              </div>
                           </div>

                           <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-white/50" />
                                <Select value={playbackRate.toString()} onValueChange={(v) => setPlaybackRate(parseFloat(v))}>
                                  <SelectTrigger className="w-24 h-8 bg-white/10 border-none text-white text-[10px] font-bold">
                                    <SelectValue placeholder="السرعة" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-white/10 text-white">
                                    <SelectItem value="0.5">0.5x</SelectItem>
                                    <SelectItem value="1">العادية</SelectItem>
                                    <SelectItem value="1.25">1.25x</SelectItem>
                                    <SelectItem value="1.5">1.5x</SelectItem>
                                    <SelectItem value="2">2x</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <button onClick={toggleFullScreen} className="text-white/70 hover:text-white transition-colors">
                                <Maximize className="w-6 h-6" />
                              </button>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                <Card className="bg-card border-primary/10 shadow-xl p-8 rounded-[2.5rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-primary" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6">
                    <div className="text-right flex-grow">
                      <h1 className="text-2xl md:text-3xl font-black text-primary mb-2">{activeContent.title}</h1>
                      <div className="flex items-center gap-3 justify-end opacity-70">
                         <Badge className="bg-accent/10 text-accent text-[10px] font-black border-accent/20">مشغل البشمهندس v1.1 ✓</Badge>
                         <p className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                           <Clock className="w-3.5 h-3.5" /> مضافة في: {activeContent.createdAt?.seconds ? new Date(activeContent.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'اليوم'}
                         </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-3">
                      <Button 
                        onClick={handleMarkAsCompleted}
                        disabled={isCompleting || isCurrentVideoCompleted}
                        className={cn(
                          "h-14 px-10 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95",
                          isCurrentVideoCompleted 
                            ? "bg-accent/20 text-accent border border-accent/30 cursor-default" 
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        {isCompleting ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                         isCurrentVideoCompleted ? <><CheckCircle2 className="w-6 h-6 ml-2" /> تم السماع</> : 
                         "تم سماع المحاضرة ✅"}
                      </Button>
                      {!isCurrentVideoCompleted && <p className="text-[10px] text-muted-foreground font-bold animate-pulse">اضغط هنا للحصول على +10 نقاط تفوق</p>}
                    </div>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-card border-2 border-dashed border-primary/20 p-20 text-center space-y-8 rounded-[3.5rem] shadow-2xl">
                  <Trophy className="w-20 h-20 text-primary mx-auto animate-bounce" />
                  <div className="space-y-4">
                    <h2 className="text-4xl font-black">{activeContent.title}</h2>
                    <p className="text-muted-foreground font-bold text-lg">بشمهندس، هذا الجزء عبارة عن اختبار تقييمي.</p>
                  </div>
                  <Link href={`/student/exams/${activeContent.id}`}>
                    <Button size="lg" className="h-16 px-12 bg-primary text-primary-foreground font-black rounded-2xl text-xl shadow-xl">
                      ابدأ الامتحان الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card border-primary/10 overflow-hidden shadow-2xl rounded-[3rem] sticky top-24">
              <CardHeader className="border-b bg-secondary/10 py-6 px-8 flex flex-row-reverse items-center justify-between">
                <p className="text-xl font-black flex items-center gap-2 text-primary">
                  دروس الكورس <BookOpen className="w-5 h-5" />
                </p>
                <Badge variant="outline" className="border-primary/40 text-primary font-black px-3 py-1 rounded-lg">
                  {enrollment?.progressPercentage || 0}% إنجاز
                </Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                {visibleContents.length === 0 ? (
                  <p className="p-10 text-center text-muted-foreground italic font-bold">لا توجد دروس حالياً.</p>
                ) : visibleContents.map((item, idx) => {
                  const isDone = completedVideos?.some(v => v.contentId === item.id);
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => setActiveContent(item)} 
                      className={cn(
                        "w-full p-6 text-right flex flex-row-reverse items-center gap-4 transition-all border-b border-white/5 group", 
                        activeContent?.id === item.id ? "bg-primary/10 border-r-4 border-r-primary" : "hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm transition-all", 
                        isDone ? "bg-accent text-white" : activeContent?.id === item.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground"
                      )}>
                        {isDone ? "✓" : idx+1}
                      </div>
                      <div className="text-right min-w-0 flex-grow">
                        <p className={cn("font-bold truncate text-sm transition-colors", activeContent?.id === item.id ? "text-primary" : "text-white/80")}>
                          {item.title}
                        </p>
                        <p className="text-[10px] opacity-40 mt-1 font-bold">{item.contentType === 'Video' ? 'فيديو شرح' : 'اختبار'}</p>
                      </div>
                      <ChevronLeft className={cn("w-4 h-4 opacity-0 transition-all", activeContent?.id === item.id ? "opacity-100 translate-x-0 text-primary" : "group-hover:opacity-30 group-hover:-translate-x-1")} />
                    </button>
                  );
                })}
              </CardContent>
              <div className="p-6 bg-secondary/5 border-t">
                 <Link href="/student/dashboard" className="w-full">
                    <Button variant="ghost" className="w-full font-black text-muted-foreground hover:text-primary">العودة للوحة التحكم</Button>
                 </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
