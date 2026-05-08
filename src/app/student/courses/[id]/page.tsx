
"use client";

import { useParams } from 'next/navigation';
import { Navbar } from '@/components/ui/navbar';
import { Footer } from '@/components/ui/footer';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, setDoc, serverTimestamp, getDocs, updateDoc, where } from 'firebase/firestore';
import { 
  Loader2, 
  CheckCircle, 
  FileQuestion, 
  Lock, 
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ShieldCheck,
  Zap,
  Gauge,
  Monitor,
  FastForward,
  Rewind,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

/**
 * @fileOverview مشغل النخبة V3.0 - Al-Bashmohandes Elite Engine
 * الحل النهائي لمشاكل المزامنة، التكبير، والتوافق مع الموبايل.
 */

export default function CourseViewer() {
  const { id } = useParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeContent, setActiveContent] = useState<any>(null);
  const [isVideoBlocked, setIsVideoBlocked] = useState(false);
  const [origin, setOrigin] = useState('');
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });

  // مراجع المشغل
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // حالة المشغل
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const courseRef = useMemoFirebase(() => (firestore && id) ? doc(firestore, 'courses', id as string) : null, [firestore, id]);
  const { data: course, isLoading: isCourseLoading } = useDoc(courseRef);

  const studentRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'students', user.uid) : null, [firestore, user]);
  const { data: studentProfile } = useDoc(studentRef);

  const enrollmentRef = useMemoFirebase(() => (firestore && user && id) ? doc(firestore, 'students', user.uid, 'enrollments', id as string) : null, [firestore, user, id]);
  const { data: enrollment, isLoading: isEnrollmentLoading } = useDoc(enrollmentRef);
  
  const contentRef = useMemoFirebase(() => (firestore && id) ? query(collection(firestore, 'courses', id as string, 'content'), orderBy('orderIndex', 'asc')) : null, [firestore, id]);
  const { data: contents, isLoading: isContentLoading } = useCollection(contentRef);

  const progressRef = useMemoFirebase(() => (firestore && user) ? collection(firestore, 'students', user.uid, 'video_progress') : null, [firestore, user]);
  const { data: watchedVideos } = useCollection(progressRef);

  const visibleContents = useMemo(() => {
    return contents?.filter(c => c.isVisible !== false) || [];
  }, [contents]);

  const isFree = course?.price === 0;

  // إخفاء الأدوات تلقائياً عند الخمول
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeedMenu) setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, showSpeedMenu]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [resetControlsTimer]);

  // علامة مائية ذكية عشوائية
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 70) + 15;
      const left = Math.floor(Math.random() * 70) + 15;
      setWatermarkPos({ top: `${top}%`, left: `${left}%` });
    }, 12000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // حماية المحتوى من التسجيل
  useEffect(() => {
    const handleBlur = () => setIsVideoBlocked(true);
    const handleFocus = () => setTimeout(() => setIsVideoBlocked(false), 500);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const sendCommand = useCallback((func: string, args: any[] = []) => {
    if (playerRef.current?.contentWindow) {
      playerRef.current.contentWindow.postMessage(JSON.stringify({ 
        event: 'command', 
        func, 
        args 
      }), '*');
    }
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      sendCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      sendCommand('playVideo');
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  const skipSeconds = (seconds: number) => {
    const target = currentTime + seconds;
    sendCommand('seekTo', [target, true]);
    setCurrentTime(target);
    resetControlsTimer();
  };

  const handleSeek = (value: number[]) => {
    if (!duration || duration <= 0) return;
    setIsDragging(true);
    const targetPercent = value[0];
    const seekTo = (targetPercent / 100) * duration;
    setCurrentTime(seekTo);
    sendCommand('seekTo', [seekTo, true]);
    // تأخير العودة للمزامنة التلقائية لضمان استقرار الفيديو
    setTimeout(() => setIsDragging(false), 800);
    resetControlsTimer();
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    sendCommand('setPlaybackRate', [rate]);
    setShowSpeedMenu(false);
    resetControlsTimer();
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(e => console.error(e));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
    resetControlsTimer();
  };

  // محرك المزامنة النووي (V3.0 Smart Polling)
  // يقوم بسحب البيانات يدوياً كل 400 ملي ثانية لضمان عدم توقف الشريط
  useEffect(() => {
    if (!activeContent || !origin) return;

    const syncInterval = setInterval(() => {
      // إرسال نبضة "أنا هنا" لليوتيوب
      sendCommand('listening');
      
      // طلب الوقت والمدة بشكل قسري
      if (isPlaying && !isDragging) {
        sendCommand('getCurrentTime');
        sendCommand('getDuration');
      }
    }, 400);

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('youtube.com')) return;
      try {
        const data = JSON.parse(event.data);
        
        // استلام بيانات الفيديو الحقيقية
        if (data.event === 'infoDelivery' && data.info) {
          const info = data.info;
          if (info.duration !== undefined && info.duration > 0) setDuration(info.duration);
          if (info.currentTime !== undefined && !isDragging) setCurrentTime(info.currentTime);
          if (info.playerState !== undefined) setIsPlaying(info.playerState === 1);
        }
        
        // تحديث الحالة عند الضغط اليدوي (إذا سمح المتصفح)
        if (data.event === 'onStateChange') {
          setIsPlaying(data.info === 1);
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeContent, isDragging, origin, isPlaying, sendCommand]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isFree && !enrollment && user && id && studentProfile && !isEnrollmentLoading && course && firestore) {
      const enRef = doc(firestore, 'students', user.uid, 'enrollments', id as string);
      setDoc(enRef, {
        id: id as string,
        courseId: id as string,
        studentId: user.uid,
        studentName: studentProfile.name,
        status: 'active',
        enrollmentDate: new Date().toISOString(),
        activationDate: new Date().toISOString(),
        progressPercentage: 0,
        isCompleted: false,
        courseTitle: course.title,
      }, { merge: true });
    }
  }, [isFree, enrollment, user, id, studentProfile, isEnrollmentLoading, firestore, course]);

  const markAsWatched = async (contentId: string) => {
    if (!firestore || !user || !id || !studentProfile) return;
    const videoLogRef = doc(firestore, 'students', user.uid, 'video_progress', contentId);
    await setDoc(videoLogRef, { 
      studentId: user.uid, 
      studentName: studentProfile.name, 
      courseId: id, 
      courseContentId: contentId, 
      isCompleted: true, 
      watchedDurationInSeconds: duration || 600, 
      lastWatchedAt: serverTimestamp() 
    }, { merge: true });
    
    const allWatchedRef = query(collection(firestore, 'students', user.uid, 'video_progress'), where('courseId', '==', id));
    const watchedSnap = await getDocs(allWatchedRef);
    const newPercent = Math.min(100, Math.round((watchedSnap.size / (visibleContents.length || 1)) * 100));

    await updateDoc(doc(firestore, 'students', user.uid, 'enrollments', id as string), { 
      progressPercentage: newPercent, 
      studentName: studentProfile.name, 
      lastActivityDate: new Date().toISOString() 
    });
    toast({ title: "عاش يا بشمهندس!", description: `وصلت لنسبة إنجاز ${newPercent}% في هذا الكورس.` });
  };

  useEffect(() => { 
    if (visibleContents.length > 0 && !activeContent) {
      setActiveContent(visibleContents[0]);
    }
  }, [visibleContents, activeContent]);

  if (isUserLoading || isCourseLoading || isEnrollmentLoading || isContentLoading) return <div className="flex justify-center py-40"><Loader2 className="w-12 animate-spin text-primary" /></div>;

  const hasAccess = (enrollment && enrollment.status === 'active') || isFree;
  if (!hasAccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-background">
      <Lock className="w-16 h-16 text-primary/40 animate-pulse" />
      <h2 className="text-3xl font-black text-white">هذا الكورس يتطلب تفعيل</h2>
      <p className="text-muted-foreground max-w-sm">يرجى استخدام كود التفعيل الخاص بك للوصول إلى هذا المحتوى التعليمي.</p>
      <Link href="/student/redeem"><Button className="bg-primary h-14 px-10 rounded-2xl font-black shadow-lg">تفعيل الكود الآن</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-right overflow-x-hidden">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {activeContent?.contentType === 'Video' ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                
                {/* مشغل النخبة V3.0 PRO */}
                <div 
                  ref={playerContainerRef} 
                  onMouseMove={resetControlsTimer}
                  onTouchStart={resetControlsTimer}
                  className={cn(
                    "relative bg-black overflow-hidden shadow-2xl transition-all duration-500 group select-none",
                    isFullscreen ? "fixed inset-0 w-full h-full z-[9999] rounded-none flex items-center justify-center" : "rounded-[2rem] md:rounded-[3rem] border-[4px] md:border-[8px] border-card aspect-video"
                  )}
                  onContextMenu={e => e.preventDefault()}
                >
                    {/* طبقة حماية Pointer-Events لمنع التفاعل مع مشغل يوتيوب مباشرة */}
                    <div className="absolute inset-0 z-40 bg-transparent" />
                    
                    {/* علامة مائية ملكية عائمة */}
                    <div 
                      className="absolute z-[45] pointer-events-none transition-all duration-[3000ms] ease-in-out opacity-20 text-[8px] md:text-xs font-black text-white bg-black/40 px-3 py-1.5 rounded-full border border-white/10 whitespace-nowrap"
                      style={{ top: watermarkPos.top, left: watermarkPos.left }}
                    >
                      {studentProfile?.name} | {studentProfile?.studentPhoneNumber}
                    </div>

                    {/* حماية تعتيم الخصوصية الفائقة */}
                    {isVideoBlocked && (
                      <div className="absolute inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-8">
                         <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20">
                            <ShieldCheck className="w-10 h-10 text-primary animate-pulse" />
                         </div>
                         <h3 className="text-2xl font-black text-white">المحتوى محمي يا بشمهندس</h3>
                         <p className="text-primary font-bold mt-2">يرجى العودة للصفحة لمتابعة الشرح.</p>
                      </div>
                    )}

                    {origin && (
                      <iframe 
                        ref={playerRef}
                        src={`https://www.youtube.com/embed/${getYouTubeId(activeContent.youtubeLink)}?enablejsapi=1&rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&showinfo=0&vq=hd1080&widgetid=1&origin=${origin}`} 
                        className="w-full h-full relative z-10 pointer-events-none scale-[1.01]"
                        allow="autoplay; encrypted-media"
                      />
                    )}

                    {/* واجهة تحكم النخبة مع اختفاء تلقائي ذكي */}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 z-[60] bg-gradient-to-t from-black via-black/80 to-transparent p-4 md:p-14 transition-all duration-700",
                      showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                    )}>
                      <div className="space-y-4 md:space-y-10">
                        
                        {/* شريط التقدم التفاعلي المتزامن V3 */}
                        <div className="flex flex-row-reverse items-center gap-4 md:gap-8">
                           <span className="text-[10px] md:text-sm text-white font-black min-w-[80px] md:min-w-[140px] text-left tabular-nums tracking-widest" dir="ltr">
                             {formatTime(currentTime)} / {formatTime(duration)}
                           </span>
                           <div className="flex-grow pt-1">
                             <Slider 
                              value={[duration > 0 ? (currentTime / duration) * 100 : 0]} 
                              max={100} 
                              step={0.1}
                              onValueChange={handleSeek}
                              className="cursor-pointer"
                             />
                           </div>
                        </div>
                        
                        {/* أزرار التحكم الملكية */}
                        <div className="flex items-center justify-between flex-row-reverse">
                          <div className="flex items-center gap-6 md:gap-16 flex-row-reverse">
                            <button onClick={() => skipSeconds(-10)} className="text-white/70 hover:text-primary transition-all active:scale-90"><Rewind className="w-6 h-6 md:w-10 md:h-10" /></button>
                            <button onClick={togglePlay} className="text-white hover:text-primary transition-all active:scale-90 scale-125 md:scale-[1.6]">
                              {isPlaying ? <Pause className="w-10 h-10 md:w-12 md:h-12 fill-current" /> : <Play className="w-10 h-10 md:w-12 md:h-12 fill-current" />}
                            </button>
                            <button onClick={() => skipSeconds(10)} className="text-white/70 hover:text-primary transition-all active:scale-90"><FastForward className="w-6 h-6 md:w-10 md:h-10" /></button>
                            
                            <div className="hidden lg:block h-12 w-px bg-white/10 mx-4" />

                            <button onClick={() => {
                              if(isMuted) { sendCommand('unMute'); setIsMuted(false); }
                              else { sendCommand('mute'); setIsMuted(true); }
                            }} className="hidden md:block text-white hover:text-primary transition-all">
                              {isMuted ? <VolumeX className="w-8 h-8 md:w-10 md:h-10" /> : <Volume2 className="w-8 h-8 md:w-10 md:h-10" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-5 md:gap-10">
                             {/* قائمة السرعة الذكية */}
                             <div className="relative">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }} 
                                  className="text-white font-black flex items-center gap-2 text-[10px] md:text-sm bg-white/10 px-4 py-2.5 md:px-8 md:py-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-all"
                                >
                                  <Gauge className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                  <span>{playbackRate}x</span>
                                </button>
                                
                                {showSpeedMenu && (
                                  <div className="absolute bottom-full mb-3 right-0 bg-card/98 backdrop-blur-3xl border border-primary/30 rounded-3xl overflow-hidden shadow-2xl z-[100] w-36 md:w-52 animate-in slide-in-from-bottom-3 duration-300">
                                     <div className="p-3 md:p-4 border-b border-white/5 text-center text-[10px] md:text-xs font-black text-primary uppercase">سرعة الشرح</div>
                                     {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                       <button 
                                         key={rate} 
                                         onClick={() => changeSpeed(rate)}
                                         className={cn(
                                           "w-full text-right px-6 py-3 md:px-8 md:py-4 text-xs md:text-sm font-black hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-between flex-row-reverse",
                                           playbackRate === rate ? "bg-primary/20 text-primary" : "text-white/80"
                                         )}
                                       >
                                         <span>{rate}x</span>
                                         {playbackRate === rate && <CheckCircle className="w-4 h-4" />}
                                       </button>
                                     ))}
                                  </div>
                                )}
                             </div>

                             <button onClick={toggleFullScreen} className="text-white/70 hover:text-primary transition-all p-1 md:p-2 scale-125 md:scale-[1.4]">
                                <Maximize className="w-7 h-7 md:w-9 md:h-9" />
                             </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* شعار محرك النخبة Secure */}
                    <div className="absolute top-4 left-4 md:top-10 md:left-12 z-40 bg-black/50 backdrop-blur-3xl px-5 py-2 md:px-8 md:py-3.5 rounded-full text-[9px] md:text-xs font-black border border-white/10 flex items-center gap-3 md:gap-4 text-white/95 pointer-events-none shadow-2xl">
                       <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary animate-pulse" /> 
                       <span className="tracking-widest uppercase">Elite Secure Engine V3</span>
                    </div>
                </div>

                <Card className="bg-card/60 backdrop-blur-3xl p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border-primary/20 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-primary" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6 md:gap-10">
                    <div className="text-right flex-grow space-y-3">
                      <h1 className="text-2xl md:text-4xl font-black text-primary leading-tight">{activeContent.title}</h1>
                      <div className="flex items-center gap-3 justify-end opacity-70">
                         <Badge className="bg-primary/20 text-primary text-[10px] md:text-xs font-black">حصة فيديو مؤمنة</Badge>
                         <p className="text-[10px] md:text-sm text-muted-foreground font-bold flex items-center gap-2">
                           <Clock className="w-4 h-4" /> تم النشر: {activeContent.createdAt?.seconds ? new Date(activeContent.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'الآن'}
                         </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => markAsWatched(activeContent.id)} 
                      disabled={watchedVideos?.some(v => v.courseContentId === activeContent.id)} 
                      className="w-full md:w-auto h-16 md:h-20 px-10 md:px-16 rounded-2xl md:rounded-3xl font-black bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-95 transition-all text-lg"
                    >
                      {watchedVideos?.some(v => v.courseContentId === activeContent.id) ? (
                        <span className="flex items-center gap-3"><CheckCircle className="w-6 h-6 md:w-7 md:h-7" /> تم تأكيد الحضور ✓</span>
                      ) : "تأكيد حضور الحصة الآن"}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-gradient-to-br from-primary/15 via-card to-background border-[6px] border-dashed border-primary/30 p-14 md:p-32 text-center space-y-10 md:space-y-12 rounded-[3.5rem] md:rounded-[5rem] shadow-2xl animate-in zoom-in-95 duration-1000 relative overflow-hidden">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/20 rounded-[2.5rem] md:rounded-[3rem] flex items-center justify-center mx-auto text-primary border border-primary/40 shadow-2xl">
                    <FileQuestion className="w-12 h-12 md:w-16 md:h-16" />
                  </div>
                  <div className="space-y-5">
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">{activeContent.title}</h2>
                    <p className="text-muted-foreground font-black text-lg md:text-2xl italic opacity-80">جاهز لتقييم مجهودك يا بشمهندس؟</p>
                  </div>
                  <Link href={`/student/exams/${activeContent.id}`} className="block pt-6">
                    <Button size="lg" className="w-full md:w-auto h-20 md:h-28 px-16 md:px-40 bg-primary text-primary-foreground font-black rounded-3xl md:rounded-[2.5rem] text-2xl md:text-4xl shadow-2xl hover:scale-105 active:scale-95 transition-all">
                      ابدأ الاختبار الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card/50 backdrop-blur-3xl border-primary/20 overflow-hidden shadow-2xl rounded-[2.5rem] md:rounded-[3.5rem] sticky top-24 border-t-[10px] border-t-primary">
              <CardHeader className="border-b bg-secondary/40 py-8 md:py-10 px-8 md:px-12 flex flex-row-reverse items-center justify-between">
                <CardTitle className="text-2xl md:text-3xl font-black flex items-center gap-4 md:gap-5 justify-end text-primary">
                  محتوى الكورس <Monitor className="w-6 h-6 md:w-8 md:h-8" />
                </CardTitle>
                <div className="bg-primary/25 text-primary px-4 py-2 md:px-6 md:py-2.5 rounded-full font-black text-xs md:text-lg border border-primary/30 shadow-inner">
                  {enrollment?.progressPercentage || 0}%
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[55vh] md:max-h-[65vh] overflow-y-auto custom-scrollbar">
                {visibleContents.length === 0 ? (
                   <div className="p-16 text-center text-muted-foreground italic opacity-50 font-bold">لا يوجد محتوى متاح حالياً.</div>
                ) : visibleContents.map((item, idx) => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveContent(item); if(window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                    className={cn(
                      "w-full p-8 md:p-10 text-right flex flex-row-reverse items-center gap-5 md:gap-8 transition-all border-b border-white/5 group relative", 
                      activeContent?.id === item.id ? "bg-primary/15" : "hover:bg-white/5"
                    )}
                  >
                    {activeContent?.id === item.id && <div className="absolute right-0 top-0 w-2 h-full bg-primary" />}
                    <div className={cn(
                      "w-12 h-12 md:w-14 md:h-14 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shrink-0 font-black text-sm md:text-lg transition-all shadow-xl", 
                      watchedVideos?.some(v => v.courseContentId === item.id) ? "bg-accent text-white" : "bg-secondary group-hover:bg-primary group-hover:text-primary-foreground"
                    )}>
                      {watchedVideos?.some(v => v.courseContentId === item.id) ? <CheckCircle className="w-6 h-6 md:w-8 md:h-8" /> : idx+1}
                    </div>
                    <div className="min-w-0 text-right">
                      <p className={cn("font-black text-lg md:text-xl truncate mb-2", activeContent?.id === item.id ? "text-primary" : "text-white/90")}>
                        {item.title}
                      </p>
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-50 block">
                        {item.contentType === 'Video' ? 'شرح فيديو سينمائي' : 'اختبار إلكتروني شامل'}
                      </span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.2); border-radius: 12px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,215,0,0.4); }
        /* حماية الموبايل - منع السحب لأسفل */
        body { overscroll-behavior-y: contain; }
      `}</style>
    </div>
  );
}

function getYouTubeId(url: string) {
  if (!url) return '';
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  return (match && match[2] && match[2].length === 11) ? match[2] : url;
}
