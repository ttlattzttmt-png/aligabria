"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, User, Phone, PhoneCall, GraduationCap, Loader2, Mail, Lock } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    parentPhone: '',
    academicYear: '1',
    password: ''
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;

    setIsLoading(true);
    try {
      // 1. إنشاء الحساب في Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;

      // 2. كتابة بيانات الطالب في Firestore والانتظار حتى النجاح
      await setDoc(doc(firestore, 'students', uid), {
        id: uid,
        name: formData.name,
        email: formData.email,
        studentPhoneNumber: formData.phone,
        parentPhoneNumber: formData.parentPhone,
        academicYear: formData.academicYear === '1' ? 'الصف الأول الثانوي' : formData.academicYear === '2' ? 'الصف الثاني الثانوي' : 'الصف الثالث الثانوي',
        registrationDate: new Date().toISOString(),
        lastLoginDate: new Date().toISOString(),
        points: 0
      });

      toast({
        title: "تم التسجيل بنجاح",
        description: "أهلاً بك في عائلة الدكتور."
      });
      
      // التوجيه للوحة التحكم
      router.push('/student');

    } catch (error: any) {
      console.error("Registration error:", error);
      let errorMessage = "حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "هذا البريد مسجل بالفعل.";
      
      toast({
        variant: "destructive",
        title: "فشل إنشاء الحساب",
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 bg-card items-center justify-center p-12 border-l relative overflow-hidden text-right">
        <div className="absolute inset-0 bg-primary/5 blur-3xl" />
        <div className="max-w-md space-y-8 animate-in fade-in slide-in-from-right duration-700 relative z-10">
          <div className="flex items-center gap-3 justify-end">
            <span className="text-4xl font-headline font-bold text-primary">الدكتور</span>
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-headline font-bold leading-tight">انضم إلى مجتمع المتميزين</h1>
          <p className="text-xl text-muted-foreground">سجل الآن للحصول على وصول كامل لكورسات الكيمياء بأحدث الطرق التعليمية.</p>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-12">
          <form onSubmit={handleRegister} className="space-y-6 text-right">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2 justify-end">الاسم رباعي <User className="w-4 h-4 text-primary" /></Label>
              <Input id="name" placeholder="أدخل اسمك بالكامل" className="h-12 bg-card border-primary/10 text-right" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold flex items-center gap-2 justify-end">البريد الإلكتروني <Mail className="w-4 h-4 text-primary" /></Label>
              <Input id="email" type="email" placeholder="example@mail.com" className="h-12 bg-card border-primary/10 text-right" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-bold flex items-center gap-2 justify-end">رقم الهاتف <Phone className="w-4 h-4 text-primary" /></Label>
                <Input id="phone" type="tel" placeholder="01xxxxxxxxx" className="h-12 bg-card border-primary/10 text-right" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parentPhone" className="text-sm font-bold flex items-center gap-2 justify-end">هاتف ولي الأمر <PhoneCall className="w-4 h-4 text-primary" /></Label>
                <Input id="parentPhone" type="tel" placeholder="01xxxxxxxxx" className="h-12 bg-card border-primary/10 text-right" value={formData.parentPhone} onChange={(e) => setFormData({...formData, parentPhone: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold flex items-center gap-2 justify-end">السنة الدراسية <GraduationCap className="w-4 h-4 text-primary" /></Label>
              <Select value={formData.academicYear} onValueChange={(val) => setFormData({...formData, academicYear: val})}>
                <SelectTrigger className="h-12 bg-card border-primary/10 text-right"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">الصف الأول الثانوي</SelectItem>
                  <SelectItem value="2">الصف الثاني الثانوي</SelectItem>
                  <SelectItem value="3">الصف الثالث الثانوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="كلمة المرور" className="text-sm font-bold flex items-center gap-2 justify-end">كلمة المرور <Lock className="w-4 h-4 text-primary" /></Label>
              <Input id="password" type="password" className="h-12 bg-card border-primary/10 text-right" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "إنشاء الحساب الآن"}
            </Button>
          </form>
          <p className="text-center text-muted-foreground">لديك حساب بالفعل؟ <Link href="/login" className="text-primary font-bold hover:underline">سجل دخولك من هنا</Link></p>
        </div>
      </div>
    </div>
  );
}