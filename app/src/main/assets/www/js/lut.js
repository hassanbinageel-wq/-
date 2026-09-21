/* محلّل ملفات LUT بصيغة .cube (3D و 1D) — متسامح مع BOM والتباعد والتعليقات.
 * ترتيب بيانات .cube: القناة الحمراء تتغيّر أسرع، ثم الخضراء، ثم الزرقاء.
 */
const LutParser = (() => {

  function parseCube(text) {
    if (typeof text !== 'string') text = String(text || '');
    text = text.replace(/^﻿/, '').replace(/\u0000/g, ''); // إزالة BOM وأي بايت صفري
    const m3 = text.match(/LUT_3D_SIZE\s+(\d+)/i);
    const m1 = text.match(/LUT_1D_SIZE\s+(\d+)/i);
    let title = ''; const tm = text.match(/TITLE\s+"([^"]*)"/i); if (tm) title = tm[1];

    // اجمع كل الأسطر الرقمية (تبدأ برقم أو إشارة سالبة/نقطة)
    const values = [];
    const lines = text.split(/\r?\n/);
    for (let raw of lines) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      if (!/^[-+.\d]/.test(line)) continue; // سطر كلمة مفتاحية (TITLE/DOMAIN/LUT_..)
      const parts = line.split(/[\s,]+/).map(Number);
      if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        values.push(parts[0], parts[1], parts[2]);
      }
    }

    if (m3) {
      const size = parseInt(m3[1], 10);
      const expected = size * size * size * 3;
      if (values.length < expected)
        throw new Error(`عدد قيم LUT (${Math.floor(values.length/3)}) أقل من المتوقّع (${size*size*size}). قد يكون الملف ناقصًا.`);
      return { size, title, rgb: Float32Array.from(values.slice(0, expected)), domainMin:[0,0,0], domainMax:[1,1,1] };
    }
    if (m1) {
      const n = parseInt(m1[1], 10);
      if (values.length < n*3) throw new Error(`LUT أحادي ناقص القيم.`);
      return build1DAs3D(n, values, title);
    }
    throw new Error('لم يُعثر على LUT_3D_SIZE أو LUT_1D_SIZE في الملف. تأكّد أنه ملف ‎.cube صالح.');
  }

  // يحوّل LUT أحادي (منحنى لكل قناة) إلى مكعّب 3D قابل للتطبيق
  function build1DAs3D(n, values, title) {
    const rgb = new Float32Array(n*n*n*3);
    let i = 0;
    for (let b=0;b<n;b++) for (let g=0;g<n;g++) for (let r=0;r<n;r++) {
      rgb[i++] = values[r*3+0];
      rgb[i++] = values[g*3+1];
      rgb[i++] = values[b*3+2];
    }
    return { size:n, title: title||'1D', rgb, domainMin:[0,0,0], domainMax:[1,1,1] };
  }

  function identity(size = 2) {
    const rgb = new Float32Array(size * size * size * 3);
    let i = 0;
    for (let b = 0; b < size; b++)
      for (let g = 0; g < size; g++)
        for (let r = 0; r < size; r++) { rgb[i++]=r/(size-1); rgb[i++]=g/(size-1); rgb[i++]=b/(size-1); }
    return { size, title: 'identity', rgb, domainMin:[0,0,0], domainMax:[1,1,1] };
  }

  function toStorable(lut) {
    return { size: lut.size, title: lut.title, rgb: Array.from(lut.rgb), domainMin: lut.domainMin, domainMax: lut.domainMax };
  }
  function fromStorable(o) {
    return { size: o.size, title: o.title || '', rgb: Float32Array.from(o.rgb), domainMin: o.domainMin || [0,0,0], domainMax: o.domainMax || [1,1,1] };
  }

  return { parseCube, identity, toStorable, fromStorable };
})();
