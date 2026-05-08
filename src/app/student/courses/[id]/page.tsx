
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
  Layout,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ShieldCheck,
  Zap,
  EyeOff,
  Gauge
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function CourseViewer() {
  const { id } = useParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeContent, setActiveContent] = useState<any>(null);
  const [isVideoBlocked, setIsVideoBlocked] = useState(false);

  // مراجع المشغل
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  
  // حالة المشغل
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  // حماية الفيديوهات
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

  const sendCommand = (func: string, args: any[] = []) => {
    if (playerRef.current?.contentWindow) {
      playerRef.current.contentWindow.postMessage(JSON.stringify({ 
        event: 'command', 
        func, 
        args 
      }), '*');
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      sendCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      sendCommand('playVideo');
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!duration || duration <= 0) return;
    setIsDragging(true);
    const seekTo = (value[0] / 100) * duration;
    setCurrentTime(seekTo);
    sendCommand('seekTo', [seekTo, true]);
    // إرجاع حالة السحب بعد فترة وجيزة للسماح للمزامنة بالعودة
    setTimeout(() => setIsDragging(false), 200);
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    sendCommand('setPlaybackRate', [rate]);
    setShowSpeedMenu(false);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(e => console.error(e));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // محرك المزامنة اللحظي المحدث - V8 Stability Engine
  useEffect(() => {
    const syncTimer = setInterval(() => {
      // نطلب من يوتيوب إرسال الحالة الحالية والوقت
      sendCommand('listening');
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') return;
        const data = JSON.parse(event.data);
        
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.currentTime !== undefined && !isDragging) {
            setCurrentTime(data.info.currentTime);
          }
          if (data.info.duration !== undefined && data.info.duration > 0) {
            setDuration(data.info.duration);
          }
          if (data.info.playerState !== undefined) {
            setIsPlaying(data.info.playerState === 1);
          }
        }
        
        if (data.event === 'onStateChange') {
          setIsPlaying(data.info === 1);
          if (data.info === 1) sendCommand('listening');
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearInterval(syncTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [activeContent, isDragging]);

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
    <div className="min-h-screen flex flex-col bg-background text-right">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {activeContent?.contentType === 'Video' ? (
              <div className="space-y-6 animate-in fade-in duration-700">
                
                <div 
                  ref={playerContainerRef} 
                  className={cn(
                    "relative bg-black overflow-hidden shadow-2xl transition-all duration-300 group select-none",
                    isFullscreen ? "fixed inset-0 w-full h-full z-[9999] rounded-none flex items-center justify-center" : "rounded-[2.5rem] border-[4px] border-card aspect-video"
                  )}
                >
                    {/* طبقة حماية تمنع التفاعل مع اليوتيوب وتسمح بالتفاعل مع عناصرنا فقط */}
                    <div className="absolute inset-0 z-40 bg-transparent" onContextMenu={e => e.preventDefault()} />
                    
                    {isVideoBlocked && (
                      <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-8">
                         <EyeOff className="w-16 h-16 text-primary mb-4 animate-pulse" />
                         <h3 className="text-2xl font-black text-white">المحتوى محمي</h3>
                         <p className="text-primary font-bold mt-2">يرجى العودة للصفحة لمتابعة الشرح يا بشمهندس.</p>
                      </div>
                    )}

                    <iframe 
                      ref={playerRef}
                      src={`https://www.youtube.com/embed/${getYouTubeId(activeContent.youtubeLink)}?enablejsapi=1&rel=0&modestbranding=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&showinfo=0&vq=hd1080&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`} 
                      className="w-full h-full relative z-10 pointer-events-none"
                      allow="autoplay; encrypted-media"
                    />

                    {/* واجهة التحكم المخصصة - V8 UI */}
                    <div className="absolute bottom-0 left-0 right-0 z-[60] bg-gradient-to-t from-black via-black/40 to-transparent p-4 md:p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="space-y-6">
                        <div className="flex flex-row-reverse items-center gap-6">
                           <span className="text-xs text-white font-black min-w-[120px] text-left tabular-nums" dir="ltr">
                             {formatTime(currentTime)} / {formatTime(duration)}
                           </span>
                           <div className="flex-grow pt-2">
                             <Slider 
                              value={[duration > 0 ? (currentTime / duration) * 100 : 0]} 
                              max={100} 
                              step={0.1}
                              onValueChange={handleSeek}
                              className="cursor-pointer relative z-[70] pointer-events-auto"
                             />
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between flex-row-reverse px-2 pb-2">
                          <div className="flex items-center gap-10 flex-row-reverse">
                            <button onClick={togglePlay} className="text-white hover:text-primary transition-all active:scale-90 relative z-[70] pointer-events-auto">
                              {isPlaying ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current" />}
                            </button>
                            
                            <button onClick={() => {
                              if(isMuted) { sendCommand('unMute'); setIsMuted(false); }
                              else { sendCommand('mute'); setIsMuted(true); }
                            }} className="text-white hover:text-primary relative z-[70] pointer-events-auto">
                              {isMuted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
                            </button>
                          </div>

                          <div className="flex items-center gap-6 relative">
                             <div className="relative">
                                <button 
                                  onClick={() => setShowSpeedMenu(!showSpeedMenu)} 
                                  className="text-white/90 hover:text-primary flex items-center gap-2 text-sm font-black bg-white/10 px-6 py-3 rounded-2xl border border-white/10 relative z-[70] pointer-events-auto"
                                >
                                  <Gauge className="w-4 h-4" />
                                  <span>{playbackRate}x</span>
                                </button>
                                
                                {showSpeedMenu && (
                                  <div className="absolute bottom-full mb-4 right-0 bg-card border border-primary/20 rounded-2xl overflow-hidden shadow-2xl z-[100] w-40 animate-in slide-in-from-bottom-2">
                                     {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                       <button 
                                         key={rate} 
                                         onClick={() => changeSpeed(rate)}
                                         className={cn(
                                           "w-full text-right px-6 py-4 text-xs font-black hover:bg-primary hover:text-primary-foreground transition-all pointer-events-auto",
                                           playbackRate === rate ? "bg-primary/20 text-primary" : "text-white"
                                         )}
                                       >
                                         {rate}x {rate === 1 && "(عادي)"}
                                       </button>
                                     ))}
                                  </div>
                                )}
                             </div>

                             <button onClick={toggleFullScreen} className="text-white hover:text-primary transition-all p-2 relative z-[70] pointer-events-auto">
                                <Maximize className="w-8 h-8" />
                             </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute top-6 left-8 z-40 bg-black/60 backdrop-blur-xl px-5 py-2 rounded-full text-[11px] font-black border border-white/10 flex items-center gap-3 text-white pointer-events-none">
                       <Zap className="w-4 h-4 text-primary animate-pulse" /> Al-Bashmohandes Secure HD
                    </div>
                </div>

                <Card className="bg-card/50 backdrop-blur-xl p-8 rounded-[2.5rem] border-primary/10 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-primary" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6">
                    <div className="text-right flex-grow space-y-1">
                      <h1 className="text-2xl font-black text-primary">{activeContent.title}</h1>
                      <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-2 justify-end">
                        <Clock className="w-3 h-3" /> تم النشر: {activeContent.createdAt?.seconds ? new Date(activeContent.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'الآن'}
                      </p>
                    </div>
                    <Button 
                      onClick={() => markAsWatched(activeContent.id)} 
                      disabled={watchedVideos?.some(v => v.courseContentId === activeContent.id)} 
                      className="h-16 px-12 rounded-2xl font-black bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                    >
                      {watchedVideos?.some(v => v.courseContentId === activeContent.id) ? (
                        <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> تم تأكيد الحضور ✓</span>
                      ) : "تأكيد حضور هذه الحصة"}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-gradient-to-br from-primary/5 via-card to-background border-2 border-dashed border-primary/20 p-20 text-center space-y-8 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto text-primary">
                    <FileQuestion className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black text-foreground">{activeContent.title}</h2>
                    <p className="text-muted-foreground font-bold italic">هذا الاختبار جاهز لك الآن يا بشمهندس.</p>
                  </div>
                  <Link href={`/student/exams/${activeContent.id}`} className="block pt-6">
                    <Button size="lg" className="h-20 px-24 bg-primary text-primary-foreground font-black rounded-3xl text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.03] transition-transform">
                      ابدأ الاختبار الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card/40 backdrop-blur-md border-primary/10 overflow-hidden shadow-2xl rounded-[2.5rem] sticky top-24">
              <CardHeader className="border-b bg-secondary/20 py-6 px-8 flex flex-row-reverse items-center justify-between">
                <CardTitle className="text-xl font-black flex items-center gap-3 justify-end text-primary">
                  دروس الكورس <Layout className="w-6 h-6" />
                </CardTitle>
                <Badge className="bg-primary/20 text-primary px-3 py-1 rounded-full font-black">{enrollment?.progressPercentage || 0}%</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[65vh] overflow-y-auto">
                {visibleContents.length === 0 ? (
                   <div className="p-10 text-center text-muted-foreground italic">لا يوجد محتوى متاح حالياً.</div>
                ) : visibleContents.map((item, idx) => (
                  <button 
                    key={item.id} 
                    onClick={() => setActiveContent(item)} 
                    className={cn(
                      "w-full p-6 text-right flex flex-row-reverse items-center gap-5 transition-all border-b border-white/5", 
                      activeContent?.id === item.id ? "bg-primary/10 border-r-4 border-primary" : "hover:bg-secondary/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm", 
                      watchedVideos?.some(v => v.courseContentId === item.id) ? "bg-accent text-white" : "bg-secondary"
                    )}>
                      {idx+1}
                    </div>
                    <div className="min-w-0 text-right">
                      <p className={cn("font-bold text-base truncate", activeContent?.id === item.id ? "text-primary" : "text-foreground")}>
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-black mt-0.5">
                        {item.contentType === 'Video' ? 'شرح فيديو مؤمن' : 'اختبار إلكتروني'}
                      </p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function getYouTubeId(url: string) {
  if (!url) return '';
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  return (match && match[2] && match[2].length === 11) ? match[2] : url;
}
