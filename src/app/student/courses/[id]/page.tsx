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
  Maximize,
  Play
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';

// استيراد المشغل بشكل ديناميكي
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
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);

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

  // تحديث العلامة المائية
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: `${Math.floor(Math.random() * 70) + 10}%`,
        left: `${Math.floor(Math.random() * 70) + 10}%`
      });
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // وظيفة إخفاء أدوات التحكم تلقائياً
  const startControlsTimer = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setShowControls(true);
    
    if (playing) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
  };

  const handleMouseMove = () => {
    startControlsTimer();
  };

  const handlePlayPause = () => {
    const nextState = !playing;
    setPlaying(nextState);
    if (nextState) startControlsTimer();
    else setShowControls(true);
  };
  
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

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error entering fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
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

        toast({ title: "عاش يا بطل! 🚀", description: "تم تسجيل إتمام المحاضرة وإضافة 10 نقاط لرصيدك." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "حدث خطأ" });
    } finally {
      setIsCompleting(false);
    }
  };

  if (isUserLoading || isCourseLoading || isEnrollmentLoading || isContentLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="font-bold text-muted-foreground italic text-lg">جاري التحميل...</p>
      </div>
    );
  }

  const hasAccess = (enrollment && enrollment.status === 'active') || course?.price === 0;
  if (!hasAccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
      <Lock className="w-20 h-20 text-primary opacity-20" />
      <h2 className="text-3xl font-black">محتوى مغلق</h2>
      <p className="text-muted-foreground font-bold">يرجى الاشتراك في الكورس أولاً لتتمكن من المشاهدة.</p>
      <Link href="/student/redeem"><Button className="bg-primary font-bold h-12 px-8 rounded-xl">تفعيل كود الحصة</Button></Link>
    </div>
  );

  const isCurrentVideoCompleted = completedVideos?.some(v => v.contentId === activeContent?.id);

  return (
    <div className="min-h-screen flex flex-col bg-background text-right selection:bg-primary/30">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            {activeContent?.contentType === 'Video' ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                <div 
                  ref={playerContainerRef} 
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => playing && setShowControls(false)}
                  className={cn(
                    "relative aspect-video rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-black shadow-2xl border border-white/10 group select-none flex flex-col transition-all",
                    !showControls && playing ? "cursor-none" : "cursor-default"
                  )}
                >
                   <ReactPlayer
                      ref={playerRef}
                      url={activeContent.youtubeLink}
                      width="100%"
                      height="100%"
                      playing={playing}
                      volume={volume}
                      playbackRate={playbackRate}
                      onProgress={handleProgress}
                      onDuration={(d) => setDuration(d)}
                      config={{ youtube: { playerVars: { modestbranding: 1, rel: 0, controls: 0, disablekb: 1 } } }}
                   />

                   <div onClick={handlePlayPause} className={cn("absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer z-40 transition-opacity duration-500", (playing && !showControls) ? "opacity-0" : "opacity-100")}>
                      {!playing && (
                        <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xl scale-100 hover:scale-110 transition-transform duration-300">
                          <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1" />
                        </div>
                      )}
                   </div>

                   <div className={cn("absolute pointer-events-none opacity-10 select-none z-30 transition-all duration-1000", !showControls && playing ? "opacity-5" : "opacity-10")} style={{ top: watermarkPos.top, left: watermarkPos.left }}>
                      <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 rotate-[-15deg]">
                        <p className="text-xs md:text-sm font-black text-white" dir="ltr">{studentProfile?.studentPhoneNumber || 'AL-BASHMOHANDES'}</p>
                      </div>
                   </div>

                   <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent flex flex-col justify-end p-4 md:p-6 z-50 transition-all duration-500", showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full")}>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 md:gap-4">
                           <span className="text-[10px] text-white/70">{formatTime(played * duration)}</span>
                           <Slider value={[played]} max={0.999999} step={0.000001} onValueChange={handleSeekChange} onValueCommit={handleSeekMouseUp} className="flex-grow cursor-pointer" />
                           <span className="text-[10px] text-white/70">{formatTime(duration)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4 md:gap-6">
                              <button onClick={handlePlayPause} className="text-white hover:text-primary transition-all">
                                {playing ? <PauseCircle className="w-8 h-8 md:w-10 md:h-10" /> : <PlayCircle className="w-8 h-8 md:w-10 md:h-10" />}
                              </button>
                              <div className="hidden md:flex items-center gap-2 text-white/70">
                                 <Volume2 className="w-5 h-5" />
                                 <Slider value={[volume]} max={1} step={0.1} onValueChange={(v) => setVolume(v[0])} className="w-20" />
                              </div>
                           </div>
                           <div className="flex items-center gap-2 md:gap-3">
                              <div className="flex bg-white/10 rounded-lg md:rounded-xl p-0.5 md:p-1 border border-white/10 overflow-hidden">
                                 {[1, 1.5, 2].map((rate) => (
                                   <button key={rate} onClick={() => setPlaybackRate(rate)} className={cn("px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-black rounded-md transition-all", playbackRate === rate ? "bg-primary text-primary-foreground shadow-lg" : "text-white/50 hover:bg-white/5")}>{rate}x</button>
                                 ))}
                              </div>
                              <button onClick={toggleFullScreen} className="text-white/70 hover:text-primary p-2"><Maximize className="w-5 h-5 md:w-6 md:h-6" /></button>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                <Card className="bg-card border-primary/10 shadow-xl p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-primary" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6">
                    <div className="text-right flex-grow">
                      <h1 className="text-xl md:text-3xl font-black text-primary mb-2 leading-tight">{activeContent.title}</h1>
                      <div className="flex items-center gap-3 justify-end opacity-70">
                         <Badge className="bg-accent/10 text-accent text-[10px] font-black border-accent/20">مشغل النخبة V3.0 ✓</Badge>
                         <p className="text-[10px] md:text-xs text-muted-foreground font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> مضافة في: {activeContent.createdAt?.seconds ? new Date(activeContent.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'اليوم'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                      <Button onClick={handleMarkAsCompleted} disabled={isCompleting || isCurrentVideoCompleted} className={cn("w-full md:w-auto h-12 md:h-14 px-6 md:px-10 rounded-xl md:rounded-2xl font-black text-sm md:text-lg transition-all", isCurrentVideoCompleted ? "bg-accent/20 text-accent cursor-default" : "bg-primary text-primary-foreground")}>
                        {isCompleting ? <Loader2 className="w-5 h-5 animate-spin" /> : isCurrentVideoCompleted ? <><CheckCircle2 className="w-5 h-5 ml-2" /> تم السماع</> : "تم سماع المحاضرة ✅"}
                      </Button>
                      {!isCurrentVideoCompleted && <p className="text-[9px] text-muted-foreground font-bold animate-pulse">اضغط هنا للحصول على +10 نقاط تفوق</p>}
                    </div>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-card border-2 border-dashed border-primary/20 p-8 md:p-20 text-center space-y-6 md:space-y-8 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-500">
                  <Trophy className="w-12 h-12 md:w-20 md:h-20 text-primary mx-auto animate-bounce" />
                  <div className="space-y-2 md:space-y-4">
                    <h2 className="text-xl md:text-4xl font-black leading-tight">{activeContent.title}</h2>
                    <p className="text-muted-foreground font-bold text-sm md:text-lg italic">بشمهندس، هذا الجزء عبارة عن اختبار تقييمي.</p>
                  </div>
                  <Link href={`/student/exams/${activeContent.id}`} className="block">
                    <Button size="lg" className="w-full md:w-auto h-14 md:h-16 px-8 md:px-12 bg-primary text-primary-foreground font-black rounded-xl md:rounded-2xl text-lg md:text-xl shadow-xl shadow-primary/20 active:scale-95 transition-transform">
                      ابدأ الامتحان الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card border-primary/10 overflow-hidden shadow-2xl rounded-2xl md:rounded-[3rem] sticky top-24">
              <CardHeader className="border-b bg-secondary/10 py-4 md:py-6 px-6 md:px-8 flex flex-row-reverse items-center justify-between">
                <p className="text-lg md:text-xl font-black flex items-center gap-2 text-primary">دروس الكورس <BookOpen className="w-5 h-5" /></p>
                <Badge variant="outline" className="border-primary/40 text-primary font-black px-3 py-1 rounded-xl text-[10px] md:text-xs">{enrollment?.progressPercentage || 0}% إنجاز</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[50vh] lg:max-h-[60vh] overflow-y-auto">
                {visibleContents.length === 0 ? (
                  <p className="p-10 text-center text-muted-foreground italic font-bold opacity-50">لا توجد دروس حالياً.</p>
                ) : visibleContents.map((item, idx) => {
                  const isDone = completedVideos?.some(v => v.contentId === item.id);
                  return (
                    <button key={item.id} onClick={() => { setActiveContent(item); setPlaying(false); setShowControls(true); }} className={cn("w-full p-4 md:p-6 text-right flex flex-row-reverse items-center gap-3 md:gap-4 transition-all border-b border-white/5", activeContent?.id === item.id ? "bg-primary/10 border-r-4 border-r-primary" : "hover:bg-white/5")}>
                      <div className={cn("w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 font-black text-xs md:text-sm", isDone ? "bg-accent text-white" : activeContent?.id === item.id ? "bg-primary text-primary-foreground shadow-lg" : "bg-secondary text-muted-foreground")}>
                        {isDone ? "✓" : idx+1}
                      </div>
                      <div className="text-right min-w-0 flex-grow">
                        <p className={cn("font-bold truncate text-xs md:text-sm", activeContent?.id === item.id ? "text-primary" : "text-white/80")}>{item.title}</p>
                        <p className="text-[9px] md:text-[10px] opacity-40 mt-1 font-bold">{item.contentType === 'Video' ? 'فيديو شرح' : 'اختبار'}</p>
                      </div>
                      <ChevronLeft className={cn("w-4 h-4 opacity-0 transition-all", activeContent?.id === item.id ? "opacity-100 text-primary" : "")} />
                    </button>
                  );
                })}
              </CardContent>
              <div className="p-4 md:p-6 bg-secondary/5 border-t">
                 <Link href="/student/dashboard" className="w-full"><Button variant="ghost" className="w-full font-black text-xs md:text-sm text-muted-foreground hover:text-primary rounded-xl">العودة للوحة التحكم</Button></Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}