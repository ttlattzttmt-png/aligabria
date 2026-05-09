
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Lock, User, Loader2, Info } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const ADMIN_EMAIL = 'admin@al-bashmohandes.com';
  const MASTER_EMAIL = 'master@admin.com';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    // منع تسجيل دخول الماستر من صفحة الطالب/الادمن العادية وتوجيهه للمكان الصحيح
    if (email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
      toast({
        variant: "destructive",
        title: "حساب محمي",
        description: "هذا الحساب مخصص لأدوات الأتمتة فقط. يرجى الدخول من صفحة /rebrand"
      });
      return;
    }

    setIsLoading(true);
    try {
      // 1. تسجيل الدخول عبر Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCredential.user.email?.toLowerCase();

      // 2. التوجيه المباشر والذكي
      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        toast({ title: "مرحباً بك يا بشمهندس", description: "جاري فتح لوحة التحكم..." });
        router.push('/admin');
      } else {
        toast({ title: "تم الدخول بنجاح", description: "مرحباً بك في منصتك التعليمية." });
        router.push('/student');
      }

    } catch (error: any) {
      // التعامل مع أخطاء فايربيز بدون إظهار شاشة الـ Crash
      let errorMessage = "بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى.";
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = "البريد الإلكتروني أو كلمة المرور غير صحيحة. تأكد من صحة البيانات.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "تم حظر الدخول مؤقتاً بسبب محاولات كثيرة خاطئة. حاول لاحقاً.";
      }

      toast({
        variant: "destructive",
        title: "فشل الدخول",
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-3xl border border-primary/10 shadow-2xl relative overflow-hidden text-right">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary mb-6">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-headline font-bold mb-2">تسجيل الدخول</h2>
          <p className="text-muted-foreground">أهلاً بك في منصة البشمهندس التعليمية</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold flex items-center gap-2 justify-end">
              البريد الإلكتروني <User className="w-4 h-4 text-primary" />
            </Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="example@mail.com" 
              className="h-12 bg-background border-primary/10 focus:border-primary text-right" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" title="كلمة المرور" className="text-sm font-bold flex items-center gap-2 justify-end">
              كلمة المرور <Lock className="w-4 h-4 text-primary" />
            </Label>
            <Input 
              id="password" 
              type="password" 
              className="h-12 bg-background border-primary/10 focus:border-primary text-right" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "دخول للمنصة"}
          </Button>
        </form>

        <div className="relative space-y-4 pt-4 border-t">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-[10px] text-muted-foreground mr-6">
              ملاحظة: تأكد من تفعيل "Email/Password" في لوحة تحكم Firebase لكي يعمل الدخول.
            </AlertDescription>
          </Alert>
          <p className="text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="text-primary font-bold hover:underline">
              أنشئ حساباً جديداً
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
