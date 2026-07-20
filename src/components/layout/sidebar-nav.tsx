'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Video, 
  ClipboardList, 
  Users, 
  LogOut,
  BrainCircuit,
  PieChart,
  Megaphone,
  Menu,
  Search,
  Ticket,
  Trash2,
  BarChart3,
  ShieldAlert,
  MessageCircle,
  Trophy
} from 'lucide-react';
import { useAuth, initiateSignOut, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface SidebarNavProps {
  isAdmin?: boolean;
}

export function SidebarNav({ isAdmin = false }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  
  const studentRef = useMemoFirebase(() => (user && !isAdmin) ? doc(firestore, 'students', user.uid) : null, [firestore, user, isAdmin]);
  const { data: student } = useDoc(studentRef);

  // حماية أساسية للمنصة بالكامل (منع الـ Inspect والنسخ)
  useEffect(() => {
    const handleContext = (e: MouseEvent) => e.preventDefault();
    const handleKey = (e: KeyboardEvent) => {
      const forbiddenKeys = ['i', 'j', 'u', 'c'];
      if ((e.ctrlKey && e.shiftKey && forbiddenKeys.includes(e.key.toLowerCase())) || e.key === 'F12') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContext);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const studentLinks = [
    { label: 'لوحة التحكم العامة', icon: <LayoutDashboard className="w-5 h-5" />, href: '/student' },
    { label: 'كورساتي المفعلة', icon: <Video className="w-5 h-5" />, href: '/student/dashboard' },
    { label: 'استكشف الكورسات', icon: <Search className="w-5 h-5" />, href: '/courses' },
    { label: 'سجل درجاتي', icon: <ClipboardList className="w-5 h-5" />, href: '/student/exams' },
  ];

  const adminLinks = [
    { label: 'لوحة التحكم', icon: <PieChart className="w-5 h-5" />, href: '/admin' },
    { label: 'إدارة الكورسات', icon: <Video className="w-5 h-5" />, href: '/admin/courses' },
    { label: 'أكواد التفعيل', icon: <Ticket className="w-5 h-5" />, href: '/admin/codes' },
    { label: 'نقاط التفوق', icon: <Trophy className="w-5 h-5" />, href: '/admin/points' },
    { label: 'مركز الواتساب', icon: <MessageCircle className="w-5 h-5" />, href: '/admin/whatsapp' },
    { label: 'إحصائيات الطلاب', icon: <BarChart3 className="w-5 h-5" />, href: '/admin/insights' },
    { label: 'الطلاب والرقابة', icon: <Users className="w-5 h-5" />, href: '/admin/students' },
    { label: 'بناء الاختبارات', icon: <ClipboardList className="w-5 h-5" />, href: '/admin/exams' },
    { label: 'مركز التصحيح', icon: <BrainCircuit className="w-5 h-5" />, href: '/admin/exams/grading' },
    { label: 'حذف الكورسات', icon: <Trash2 className="w-5 h-5" />, href: '/admin/courses/delete' },
    { label: 'الإشعارات', icon: <Megaphone className="w-5 h-5" />, href: '/admin/notifications' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  const handleLogout = async () => {
    if (!auth) return;
    await initiateSignOut(auth);
    router.replace('/');
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-card">
      <Link href={user ? (isAdmin ? '/admin' : '/student') : '/'} className="p-6 flex items-center gap-3 border-b hover:bg-secondary/20 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20">ب</div>
        <span className="text-xl font-headline font-bold">الدكتور</span>
      </Link>

      <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
        {links.map((link, idx) => (
          <Link
            key={`${link.href}-${idx}`}
            href={link.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
              pathname === link.href 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <span className={cn(
              "transition-transform",
              pathname === link.href ? "text-primary-foreground" : "text-primary group-hover:scale-110"
            )}>
              {link.icon}
            </span>
            <span className="font-bold">{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t space-y-4">
        <div className="p-4 rounded-2xl bg-secondary/50 flex items-center gap-3 overflow-hidden border border-white/5">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate text-foreground">{user?.displayName || student?.name || (isAdmin ? 'المشرف العام' : 'طالب المنصة')}</p>
            <p className="text-[10px] text-muted-foreground truncate">{isAdmin ? 'صلاحيات كاملة' : (student?.academicYear || 'حساب طالب')}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors font-bold"
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 px-4 flex items-center justify-between">
        <Link href={user ? (isAdmin ? '/admin' : '/student') : '/'} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">ب</div>
          <span className="text-lg font-headline font-bold">الدكتور</span>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-72 text-right">
            <SheetHeader className="sr-only">
              <SheetTitle>قائمة التنقل</SheetTitle>
            </SheetHeader>
            <NavContent />
          </SheetContent>
        </Sheet>
      </header>
      <aside className="hidden lg:flex w-64 border-l bg-card flex-col h-screen fixed top-0 right-0 z-40 shadow-xl">
        <NavContent />
      </aside>
    </>
  );
}
