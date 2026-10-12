import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = () => Capacitor.isNativePlatform();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** حفظ/مشاركة ملف: على الجوال يفتح نافذة المشاركة (واتساب، Drive، الملفات…)، وعلى الكمبيوتر يُنزَّل */
export async function shareFile(blob: Blob, filename: string, title = filename): Promise<'shared' | 'downloaded'> {
  if (isNative()) {
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache, recursive: true });
    try {
      await Share.share({ title, files: [res.uri], dialogTitle: title });
    } catch (e: any) {
      if (!/cancel/i.test(String(e?.message))) throw e;
    }
    return 'shared';
  }
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch {
      /* المستخدم ألغى — ننزّل الملف بدلًا من ذلك */
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/** نسخ احتياطية تلقائية داخل ذاكرة التطبيق (تُحفظ آخر 7 نسخ) */
export async function writeInternalBackup(json: string) {
  const name = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (isNative()) {
    await Filesystem.writeFile({ path: `backups/${name}`, data: json, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
    const list = await Filesystem.readdir({ path: 'backups', directory: Directory.Data });
    const files = list.files.map((f) => f.name).filter((n) => n.startsWith('backup-')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - 7))) {
      await Filesystem.deleteFile({ path: `backups/${old}`, directory: Directory.Data });
    }
  } else {
    try {
      localStorage.setItem('fabric-auto-backup', json);
      localStorage.setItem('fabric-auto-backup-date', name);
    } catch {
      /* مساحة المتصفح ممتلئة */
    }
  }
}

export async function listInternalBackups(): Promise<{ name: string; read: () => Promise<string> }[]> {
  if (isNative()) {
    try {
      const list = await Filesystem.readdir({ path: 'backups', directory: Directory.Data });
      return list.files
        .map((f) => f.name)
        .filter((n) => n.startsWith('backup-'))
        .sort()
        .reverse()
        .map((name) => ({
          name,
          read: async () =>
            String((await Filesystem.readFile({ path: `backups/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 })).data),
        }));
    } catch {
      return [];
    }
  }
  try {
    const json = localStorage.getItem('fabric-auto-backup');
    const name = localStorage.getItem('fabric-auto-backup-date') || 'backup.json';
    return json ? [{ name, read: async () => json }] : [];
  } catch {
    return [];
  }
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** تصغير الشعار وتحويله لنص base64 حتى يُحفظ مع البيانات والنسخ الاحتياطية */
export function imageToDataUrl(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function csvBlob(rows: (string | number)[][]): Blob {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
