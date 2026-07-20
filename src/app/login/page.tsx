
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Lock, User, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { BrandConfig } from '@/lib/brand-config';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCredential.user.email?.toLowerCase();

      // التوجيه بناءً على الإيميل المسجل في الإعدادات المركزية
      if (userEmail === BrandConfig.adminEmail.toLowerCase()) {
        toast({ title: "مرحباً بك يا دكتور", description: "جاري فتح لوحة التحكم..." });
        router.push('/admin');
      } else {
        toast({ title: "تم الدخول بنجاح", description: "مرحباً بك في منصتك التعليمية." });
        router.push('/student');
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "فشل الدخول",
        description: "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-10 rounded-[2.5rem] border border-primary/10 shadow-2xl relative overflow-hidden text-right">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-6">
            <ShieldCheck className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-headline font-black mb-2">تسجيل الدخول</h2>
          <p className="text-muted-foreground font-bold">أهلاً بك في {BrandConfig.name}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-black flex items-center gap-2 justify-end">
              البريد الإلكتروني <User className="w-4 h-4 text-primary" />
            </Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="example@mail.com" 
              className="h-14 bg-background border-primary/10 focus:border-primary text-right rounded-2xl" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" title="كلمة المرور" className="text-sm font-black flex items-center gap-2 justify-end">
              كلمة المرور <Lock className="w-4 h-4 text-primary" />
            </Label>
            <Input 
              id="password" 
              type="password" 
              className="h-14 bg-background border-primary/10 focus:border-primary text-right rounded-2xl" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-16 bg-primary text-primary-foreground hover:bg-primary/90 text-xl font-black rounded-2xl shadow-xl shadow-primary/20"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "دخول للمنصة"}
          </Button>
        </form>

        <div className="relative space-y-4 pt-4 border-t border-white/5">
          <p className="text-center text-sm text-muted-foreground font-bold">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="text-primary font-black hover:underline">
              أنشئ حساباً جديداً
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
