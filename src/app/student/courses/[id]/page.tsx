
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
  Monitor,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  FastForward,
  Rewind,
  Settings
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-youtube';

export default function CourseViewer() {
  const { id } = useParams();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeContent, setActiveContent] = useState<any>(null);
  const [isBlocked, setIsBlocked] = useState(false);

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

  useEffect(() => { 
    if (visibleContents.length > 0 && !activeContent) {
      setActiveContent(visibleContents[0]);
    }
  }, [visibleContents, activeContent]);

  // حماية المحتوى
  useEffect(() => {
    const handleBlur = () => setIsBlocked(true);
    const handleFocus = () => setTimeout(() => setIsBlocked(false), 1500);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const markAsWatched = async (contentId: string) => {
    if (!firestore || !user || !id || !studentProfile) return;
    const videoLogRef = doc(firestore, 'students', user.uid, 'video_progress', contentId);
    await setDoc(videoLogRef, { 
      studentId: user.uid, 
      studentName: studentProfile.name, 
      courseId: id, 
      courseContentId: contentId, 
      isCompleted: true, 
      lastWatchedAt: serverTimestamp() 
    }, { merge: true });
    
    const watchedSnap = await getDocs(query(collection(firestore, 'students', user.uid, 'video_progress'), where('courseId', '==', id)));
    const newPercent = Math.min(100, Math.round((watchedSnap.size / (visibleContents.length || 1)) * 100));

    await updateDoc(doc(firestore, 'students', user.uid, 'enrollments', id as string), { 
      progressPercentage: newPercent, 
      studentName: studentProfile.name, 
      lastActivityDate: new Date().toISOString() 
    });
    toast({ title: "عاش يا بشمهندس!", description: `وصلت لنسبة إنجاز ${newPercent}% في هذا الكورس.` });
  };

  if (isUserLoading || isCourseLoading || isEnrollmentLoading || isContentLoading) return <div className="flex justify-center py-40"><Loader2 className="w-12 animate-spin text-primary" /></div>;

  const hasAccess = (enrollment && enrollment.status === 'active') || course?.price === 0;

  if (!hasAccess) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 bg-background">
      <Lock className="w-16 h-16 text-primary/40" />
      <h2 className="text-3xl font-black text-white">هذا الكورس يتطلب تفعيل</h2>
      <Link href="/student/redeem"><Button className="bg-primary h-14 px-10 rounded-2xl font-black shadow-lg">تفعيل الكود الآن</Button></Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-right overflow-x-hidden">
      <Navbar />
      {isBlocked && (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6">
          <Lock className="w-20 h-20 text-primary mb-4 animate-pulse" />
          <h2 className="text-3xl font-black text-white">المحتوى محمي</h2>
          <p className="text-muted-foreground mt-2">يرجى العودة لتبويب الدراسة لمواصلة المشاهدة.</p>
        </div>
      )}
      <main className="flex-grow pt-24 pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {activeContent?.contentType === 'Video' ? (
              <div className="space-y-6">
                <div className="relative group">
                  <EliteVideoPlayer 
                    src={activeContent.youtubeLink} 
                    studentName={studentProfile?.name} 
                    studentPhone={studentProfile?.studentPhoneNumber}
                  />
                </div>

                <Card className="bg-card border-primary/20 shadow-2xl p-8 rounded-[2rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-primary" />
                  <div className="flex flex-col md:flex-row-reverse justify-between items-center gap-6">
                    <div className="text-right flex-grow">
                      <h1 className="text-3xl font-black text-primary mb-2">{activeContent.title}</h1>
                      <div className="flex items-center gap-3 justify-end opacity-70">
                         <Badge className="bg-primary/20 text-primary font-black">حصة فيديو مؤمنة</Badge>
                         <span className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> مدعوم بـ Video.js</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => markAsWatched(activeContent.id)} 
                      disabled={watchedVideos?.some(v => v.courseContentId === activeContent.id)} 
                      className="w-full md:w-auto h-14 px-8 rounded-xl font-black bg-primary text-primary-foreground shadow-xl"
                    >
                      {watchedVideos?.some(v => v.courseContentId === activeContent.id) ? (
                        <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> تم تأكيد الحضور</span>
                      ) : "تأكيد حضور الحصة"}
                    </Button>
                  </div>
                </Card>
              </div>
            ) : activeContent ? (
              <Card className="bg-gradient-to-br from-primary/10 via-card to-background border-2 border-dashed border-primary/20 p-20 text-center space-y-8 rounded-[3rem]">
                  <FileQuestion className="w-20 h-20 text-primary mx-auto" />
                  <h2 className="text-4xl font-black">{activeContent.title}</h2>
                  <Link href={`/student/exams/${activeContent.id}`}>
                    <Button size="lg" className="h-16 px-12 bg-primary text-primary-foreground font-black rounded-2xl text-xl shadow-xl">
                      ابدأ الاختبار الآن ✍️
                    </Button>
                  </Link>
              </Card>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <Card className="bg-card border-primary/10 overflow-hidden shadow-2xl rounded-[2.5rem] sticky top-24">
              <CardHeader className="border-b bg-secondary/5 py-6 px-8 flex flex-row-reverse items-center justify-between">
                <CardTitle className="text-xl font-black flex items-center gap-3 justify-end text-primary">
                  قائمة الدروس <Monitor className="w-5 h-5" />
                </CardTitle>
                <Badge variant="outline" className="border-primary/30 text-primary">{enrollment?.progressPercentage || 0}%</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                {visibleContents.map((item, idx) => (
                  <button 
                    key={item.id} 
                    onClick={() => setActiveContent(item)} 
                    className={cn(
                      "w-full p-6 text-right flex flex-row-reverse items-center gap-4 transition-all border-b border-white/5", 
                      activeContent?.id === item.id ? "bg-primary/10" : "hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black", 
                      watchedVideos?.some(v => v.courseContentId === item.id) ? "bg-accent text-white" : "bg-secondary"
                    )}>
                      {watchedVideos?.some(v => v.courseContentId === item.id) ? <CheckCircle className="w-5 h-5" /> : idx+1}
                    </div>
                    <p className={cn("font-bold truncate", activeContent?.id === item.id ? "text-primary" : "text-white/80")}>
                      {item.title}
                    </p>
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

/**
 * مشغل فيديو النخبة V5 - مدعوم بـ Video.js الأصلي
 * مزامنة كاملة، أمان عالي، اختفاء تلقائي، ودعم موبايل
 */
function EliteVideoPlayer({ src, studentName, studentPhone }: { src: string, studentName?: string, studentPhone?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [watermarkPos, setWatermarkPos] = useState({ top: 10, left: 10 });

  // تهيئة Video.js
  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, {
      autoplay: false,
      controls: false,
      responsive: true,
      fluid: true,
      techOrder: ['youtube'],
      sources: [{ type: 'video/youtube', src: src }],
      youtube: { 
        modestbranding: 1, 
        rel: 0, 
        showinfo: 0, 
        iv_load_policy: 3,
        origin: window.location.origin
      }
    }, () => {
      console.log('Elite Player Ready');
    });

    playerRef.current = player;

    player.on('timeupdate', () => setCurrentTime(player.currentTime() || 0));
    player.on('durationchange', () => setDuration(player.duration() || 0));
    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('volumechange', () => {
      setVolume(player.volume());
      setIsMuted(player.muted());
    });

    return () => {
      if (player) player.dispose();
    };
  }, [src]);

  // نظام الاختفاء التلقائي
  useEffect(() => {
    let timeout: any;
    const handleMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => isPlaying && setShowControls(false), 3500);
    };
    const container = containerRef.current;
    container?.addEventListener('mousemove', handleMove);
    container?.addEventListener('touchstart', handleMove);
    return () => {
      container?.removeEventListener('mousemove', handleMove);
      container?.removeEventListener('touchstart', handleMove);
    };
  }, [isPlaying]);

  // العلامة المائية المتحركة
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkPos({
        top: Math.random() * 80 + 5,
        left: Math.random() * 70 + 5
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (val: number[]) => {
    const time = val[0];
    playerRef.current.currentTime(time);
    setCurrentTime(time);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative bg-black rounded-[2.5rem] overflow-hidden shadow-2xl aspect-video group select-none touch-none"
      onContextMenu={e => e.preventDefault()}
    >
      {/* Video.js Engine */}
      <div data-vjs-player>
        <video ref={videoRef} className="video-js vjs-big-play-centered" />
      </div>

      {/* Watermark */}
      <div 
        className="absolute z-10 pointer-events-none transition-all duration-[3000ms] opacity-30 text-[10px] md:text-xs font-black bg-black/40 text-white px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm"
        style={{ top: `${watermarkPos.top}%`, left: `${watermarkPos.left}%` }}
      >
        {studentName} | {studentPhone}
      </div>

      {/* Overlay الحماية */}
      <div className="absolute inset-0 z-0 bg-transparent" />

      {/* Custom Controls */}
      <div className={cn(
        "absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-500",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        
        {/* Play/Pause Large Center */}
        {!isPlaying && (
          <button 
            onClick={() => playerRef.current.play()}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-primary/20 text-primary flex items-center justify-center backdrop-blur-md border border-primary/30 hover:scale-110 transition-transform shadow-2xl"
          >
            <Play className="w-12 h-12 fill-current" />
          </button>
        )}

        <div className="p-4 md:p-8 space-y-4">
          {/* Progress Bar */}
          <div className="flex flex-col gap-2">
            <Slider 
              value={[currentTime]} 
              max={duration || 100} 
              step={1} 
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between items-center text-[10px] md:text-sm font-black text-white/70 font-mono">
              <span>{formatTime(duration)}</span>
              <span>{formatTime(currentTime)}</span>
            </div>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between flex-row-reverse">
            <div className="flex items-center gap-2 md:gap-5 flex-row-reverse">
              <button onClick={() => isPlaying ? playerRef.current.pause() : playerRef.current.play()} className="text-white hover:text-primary transition-colors">
                {isPlaying ? <Pause className="w-6 h-6 md:w-8 md:h-8" /> : <Play className="w-6 h-6 md:w-8 md:h-8" />}
              </button>
              
              <button onClick={() => playerRef.current.currentTime(currentTime - 10)} className="text-white/60 hover:text-white"><RotateCcw className="w-5 h-5 md:w-6 md:h-6" /></button>
              <button onClick={() => playerRef.current.currentTime(currentTime + 10)} className="text-white/60 hover:text-white"><FastForward className="w-5 h-5 md:w-6 md:h-6" /></button>
              
              <div className="flex items-center gap-2 md:gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/5 group/vol">
                <button onClick={() => playerRef.current.muted(!isMuted)} className="text-white/80">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 md:w-5 md:h-5" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5" />}
                </button>
                <div className="w-16 md:w-24 overflow-hidden group-hover/vol:w-24 transition-all">
                  <Slider 
                    value={[isMuted ? 0 : volume]} 
                    max={1} 
                    step={0.01} 
                    onValueChange={(v) => playerRef.current.volume(v[0])} 
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-row-reverse">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white font-black rounded-full h-10 px-4 bg-white/5 border border-white/5 hover:bg-white/10 gap-2">
                    {playbackRate}x <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card/95 backdrop-blur-xl border-primary/20 text-white font-bold rounded-2xl">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <DropdownMenuItem 
                      key={rate} 
                      onClick={() => { playerRef.current.playbackRate(rate); setPlaybackRate(rate); }}
                      className={cn("justify-end cursor-pointer", playbackRate === rate && "text-primary")}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button onClick={toggleFullscreen} className="text-white/80 hover:text-white">
                <Maximize className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
