
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
  Settings,
  Gauge
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  // مراجع وبيانات المشغل الخاص
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

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

  // حماية الفيديوهات من التسجيل أو الخروج
  useEffect(() => {
    const handleBlur = () => setIsVideoBlocked(true);
    const handleFocus = () => setTimeout(() => setIsVideoBlocked(false), 1000);
    const preventContext = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('contextmenu', preventContext);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('contextmenu', preventContext);
    };
  }, []);

  // التحكم في مشغل يوتيوب برمجياً
  const sendPlayerCommand = (command: string, args: any[] = []) => {
    if (playerRef.current?.contentWindow) {
      playerRef.current.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: command,
        args: args
      }), '*');
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      sendPlayerCommand('pauseVideo');
    } else {
      sendPlayerCommand('playVideo');
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (duration > 0) {
      const seekTo = (value[0] / 100) * duration;
      sendPlayerCommand('seekTo', [seekTo, true]);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    sendPlayerCommand('setPlaybackRate', [rate]);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // تنسيق الوقت (ثواني إلى دقيقة:ثانية)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // استقبال رسائل حالة المشغل من يوتيوب
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // تحديث الوقت والمدة إذا كان المشغل يرسل التحديثات
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.currentTime !== undefined) setCurrentTime(data.info.currentTime);
          if (data.info.duration !== undefined) setDuration(data.info.duration);
          if (data.info.playerState === 1) setIsPlaying(true);
          if (data.info.playerState === 2) setIsPlaying(false);
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (isFree && !enrollment && user && id && studentProfile && !isEnrollmentLoading && course && firestore) {
      const enRef = doc(firestore, 'students', user.uid, 'enrollments', id as string);
      setDoc(enRef, {
        id: id as string, courseId: id as string, studentId: user.uid, studentName: studentProfile.name, status: 'active', enrollmentDate: new Date().toISOString(), activationDate: new Date().toISOString(), progressPercentage: 0, isCompleted: false, courseTitle: course.title,
      }, { merge: true });
    }
  }, [isFree, enrollment, user, id, studentProfile, isEnrollmentLoading, firestore, course]);

  const markAsWatched = async (contentId: string) => {
    if (!firestore || !user || !id || !studentProfile) return;
    const videoLogRef = doc(firestore, 'students', user.uid, 'video_progress', contentId);
    await setDoc(videoLogRef, { studentId: user.uid, studentName: studentProfile.name, courseId: id, courseContentId: contentId, isCompleted: true, watchedDurationInSeconds: duration || 600, lastWatchedAt: serverTimestamp() }, { merge: true });
    
    const allWatchedRef = query(collection(firestore, 'students', user.uid, 'video_progress'), where('courseId', '==', id));
    const watchedSnap = await getDocs(allWatchedRef);
    const newPercent = Math.min(100, Math.round((watchedSnap.size / (visibleContents.length || 1)) * 100));

    await updateDoc(doc(firestore, 'students', user.uid, 'enrollments', id as string), { progressPercentage: newPercent, studentName: studentProfile.name, lastActivityDate: new Date().toISOString() });
    toast({ title: "أحسنت يا بشمهندس!", description: `إنجازك في هذا الكورس وصل لـ ${newPercent}%` });
  };

  useEffect(() => { 
    if (visibleContents.length > 0 && !activeContent) setActiveContent(visibleContents[0]); 
  }, [visibleContents, activeContent]);

  if (isUserLoading || isCourseLoading || isEnrollmentLoading || isContentLoading) return <div className="flex justify-center py-40"><Loader2 className="w-12 animate-spin text-primary" /></div>;

  const hasAccess = (enrollment && enrollment.status === 'active') || isFree;
  if (!hasAccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-background">
      <Lock className="w-16 h-16 text-primary/40 animate-pulse" />
      <h2 className="text-3xl font-black">هذا الكورس يتطلب تفعيل</h2>
      <p className="text-muted-foreground max-w-sm">بشمهندس، هذا المحتوى محمي. يرجى تفعيل الكود الخاص بك للوصول للشروحات.</p>
      <Link href="/student/redeem"><Button className="bg-primary h-14 px-10 rounded-2xl font-bold">تفعيل كود الآن</Button></Link>
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
                {/* مشغل فيديو البشمهندس الخاص والآمن */}
                <div ref={playerContainerRef} className="relative bg-black rounded-[2rem] overflow-hidden border-[4px] border-card shadow-2xl aspect-video group">
                    {/* طبقة حماية تمنع التفاعل مع المشغل الأصلي */}
                    <div className="absolute inset-0 z-20 cursor-default bg-transparent" />
                    
                    {/* واجهة التعتيم الذكية */}
                    {isVideoBlocked && (
                      <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-8">
                         <EyeOff className="w-16 h-16 text-primary mb-4 animate-pulse" />
                         <h3 className="text-2xl font-black text-white">المحتوى محمي</h3>
                         <p className="text-primary font-bold mt-2">يرجى العودة للصفحة لمواصلة المشاهدة بأمان.</p>
                      </div>
                    )}

                    <iframe 
                      ref={playerRef}
                      src={`https://www.youtube.com/embed/${getYouTubeId(activeContent.youtubeLink)}?rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&controls=0&disablekb=1&fs=0&iv_load_policy=3&showinfo=0&vq=hd1080`} 
                      className="w-full h-full relative z-10 pointer-events-none scale-[1.01]"
                      allow="autoplay; encrypted-media"
                    />

                    {/* شريط التحكم المخصص للمنصة */}
                    <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="space-y-4">
                        <div className="flex flex-row-reverse items-center gap-4">
                           <span className="text-[10px] text-white/70 font-mono" dir="ltr">{formatTime(currentTime)} / {formatTime(duration)}</span>
                           <Slider 
                            value={[duration > 0 ? (currentTime / duration) * 100 : 0]} 
                            max={100} 
                            step={0.1}
                            onValueChange={handleSeek}
                            className="cursor-pointer flex-grow"
                           />
                        </div>
                        
                        <div className="flex items-center justify-between flex-row-reverse px-2">
                          <div className="flex items-center gap-6 flex-row-reverse">
                            <button onClick={togglePlay} className="text-white hover:text-primary transition-all active:scale-90">
                              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                            </button>
                            
                            <div className="flex items-center gap-2 flex-row-reverse">
                              <button onClick={() => {
                                if(isMuted) { sendPlayerCommand('unMute'); setIsMuted(false); }
                                else { sendPlayerCommand('mute'); setIsMuted(true); }
                              }} className="text-white">
                                {isMuted ? <VolumeX /> : <Volume2 />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-5">
                             {/* اختيار السرعة */}
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-white/80 hover:text-primary flex items-center gap-1.5 text-xs font-black bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                                    <Gauge className="w-4 h-4" />
                                    <span>{playbackRate}x</span>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-card border-primary/20">
                                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                    <DropdownMenuItem 
                                      key={rate} 
                                      onClick={() => changeSpeed(rate)}
                                      className={cn("text-xs font-bold", playbackRate === rate && "text-primary bg-primary/10")}
                                    >
                                      {rate}x {rate === 1 && "(عادي)"}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                             </DropdownMenu>

                             <div className="text-white/40 font-mono text-[9px] flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
                               <span>Secure Mode</span>
                               <ShieldCheck className="w-3 h-3 text-primary" />
                             </div>

                             <button onClick={toggleFullScreen} className="text-white hover:text-primary transition-all">
                                <Maximize className="w-5 h-5" />
                             </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute top-4 left-6 z-30 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black border border-white/10 pointer-events-none flex items-center gap-2 text-white">
                       <Zap className="w-3 h-3 text-primary animate-pulse" /> Al-Bashmohandes Secure PRO
                    </div>
                </div>

                <Card className="bg-card/50 backdrop-blur-xl p-8 rounded-[2rem] border-primary/10 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1 h-full bg-primary/20" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6">
                    <div className="text-right flex-grow space-y-1">
                      <h1 className="text-2xl font-black text-primary">{activeContent.title}</h1>
                      <div className="flex items-center gap-3 justify-end text-[10px] text-muted-foreground font-bold">
                         <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> تم الرفع: {activeContent.createdAt?.seconds ? new Date(activeContent.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : 'قيد المعالجة'}</span>
                         <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-accent" /> دقة آمنة HD 1080p</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => markAsWatched(activeContent.id)} 
                      disabled={watchedVideos?.some(v => v.courseContentId === activeContent.id)} 
                      className="h-16 px-12 rounded-2xl font-black bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition-all active:scale-95"
                    >
                      {watchedVideos?.some(v => v.courseContentId === activeContent.id) ? (
                        <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> تم الحضور ✓</span>
                      ) : "تأكيد حضور الدرس"}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-gradient-to-br from-primary/5 via-card to-background border-2 border-dashed border-primary/20 p-16 text-center space-y-8 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto text-primary shadow-inner">
                    <FileQuestion className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black text-foreground">{activeContent.title}</h2>
                    <p className="text-muted-foreground font-bold italic">جاهز لاختبار معلوماتك يا بشمهندس؟</p>
                  </div>
                  <Link href={`/student/exams/${activeContent.id}`} className="block pt-6">
                    <Button size="lg" className="h-20 px-20 bg-primary text-primary-foreground font-black rounded-3xl text-2xl shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                      ابدأ الاختبار الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card/40 backdrop-blur-md border-primary/10 overflow-hidden shadow-2xl rounded-[2.5rem] sticky top-24">
              <CardHeader className="border-b bg-secondary/20 py-6 px-8 flex flex-row-reverse items-center justify-between">
                <CardTitle className="text-xl font-black flex items-center gap-3 justify-end">
                  محتويات الكورس <Layout className="w-6 h-6 text-primary" />
                </CardTitle>
                <Badge className="bg-primary/20 text-primary px-3 py-1 rounded-full font-black">{enrollment?.progressPercentage || 0}%</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[65vh] overflow-y-auto">
                {visibleContents.length === 0 ? (
                   <div className="p-10 text-center text-muted-foreground italic font-bold">لا يوجد محتوى مضاف حالياً.</div>
                ) : visibleContents.map((item, idx) => (
                  <button 
                    key={item.id} 
                    onClick={() => setActiveContent(item)} 
                    className={cn(
                      "w-full p-6 text-right flex flex-row-reverse items-center gap-5 transition-all border-b border-white/5 group", 
                      activeContent?.id === item.id ? "bg-primary/10 border-r-4 border-primary shadow-inner" : "hover:bg-secondary/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm transition-colors shadow-sm", 
                      watchedVideos?.some(v => v.courseContentId === item.id) ? "bg-accent text-white" : "bg-secondary group-hover:bg-primary/20"
                    )}>
                      {idx+1}
                    </div>
                    <div className="min-w-0 text-right">
                      <p className={cn("font-bold text-base truncate", activeContent?.id === item.id ? "text-primary" : "text-foreground")}>
                        {item.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-black mt-0.5">
                        {item.contentType === 'Video' ? 'شرح فيديو آمن' : 'اختبار إلكتروني'}
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
