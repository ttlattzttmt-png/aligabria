
'use server';

/**
 * @fileOverview محرك التطهير العميق - يقوم بفحص كافة ملفات المشروع واستبدال كافة الهويات القديمة بالجديدة آلياً.
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { BrandConfig as OldConfig } from '@/lib/brand-config';

export async function packageProject(formData: any) {
  const zip = new JSZip();
  const rootDir = process.cwd();

  // قائمة الاستبدال الشاملة (القديم -> الجديد)
  const replacements = [
    { search: OldConfig.name, replace: formData.name },
    { search: OldConfig.shortName, replace: formData.shortName },
    { search: OldConfig.adminEmail, replace: formData.adminEmail },
    { search: OldConfig.supportPhone, replace: formData.supportPhone },
    { search: OldConfig.supportEmail, replace: formData.supportEmail },
    { search: OldConfig.developerName, replace: formData.developerName },
    { search: OldConfig.developerContact, replace: formData.developerContact },
    { search: OldConfig.whatsappNumber, replace: formData.whatsappNumber },
  ];

  // دالة لتطهير المحتوى نصياً
  function purgeContent(content: string): string {
    let purged = content;
    
    // 1. استبدال كافة نصوص الهوية
    replacements.forEach(({ search, replace }) => {
      if (search && replace) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        purged = purged.replace(regex, replace);
      }
    });

    return purged;
  }

  // دالة لقراءة المجلدات بشكل تتابعي وإضافتها للـ ZIP مع التطهير
  async function addDirectoryToZip(currentDir: string, zipFolder: JSZip) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      const stats = fs.statSync(fullPath);
      const relativePath = path.relative(rootDir, fullPath);

      // استثناء الملفات الحساسة والمجلدات التي لا يجب أن يراها العميل
      if (
        file === 'node_modules' || 
        file === '.next' || 
        file === '.git' || 
        file === 'rebrand' || // حذف أداة الأتمتة نهائياً من النسخة
        file === '.env' ||
        file === 'package-lock.json'
      ) continue;

      if (stats.isDirectory()) {
        const nextFolder = zipFolder.folder(file);
        if (nextFolder) await addDirectoryToZip(fullPath, nextFolder);
      } else {
        let content: string | Buffer = fs.readFileSync(fullPath);
        const ext = path.extname(file);

        // تطهير كافة الملفات النصية فقط
        const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.rules', '.css', '.html', '.txt'];
        if (textExtensions.includes(ext)) {
          let textContent = content.toString();

          // معالجة خاصة لملفات الإعدادات لضمان دقة البيانات
          if (relativePath === 'src/lib/brand-config.ts') {
             textContent = `export const BrandConfig = ${JSON.stringify(formData, null, 2)};`;
          } else if (relativePath === 'src/firebase/config.ts') {
             textContent = `export const firebaseConfig = ${JSON.stringify(formData.firebase, null, 2)};`;
          } else {
             // تطهير شامل لبقية الملفات (بما في ذلك README و Layouts والـ PDF templates)
             textContent = purgeContent(textContent);
          }
          
          content = textContent;
        }

        zipFolder.file(file, content);
      }
    }
  }

  await addDirectoryToZip(rootDir, zip);

  // توليد الـ ZIP كـ Base64
  const base64 = await zip.generateAsync({ 
    type: 'base64',
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
  
  return base64;
}
