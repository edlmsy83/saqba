/* ═══════════════════════════════════════════════════
   بوابة سقبا — Shared Utilities
   - XSS Sanitizer
   - Image Compressor
   - Form Validators
   - Helpers
   ═══════════════════════════════════════════════════ */

// ── XSS SANITIZER ───────────────────────────────────
// منع حقن الكود الخبيث في innerHTML
const Sanitizer = {
  // تحويل الحروف الخطيرة إلى HTML entities
  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // تنظيف نص مع السماح بـ line breaks فقط
  text(str) {
    return this.escape(str).replace(/\n/g, '<br>');
  },

  // استخدام textContent بدلاً من innerHTML للنصوص البسيطة
  setTextSafe(el, str) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (el) el.textContent = str ?? '';
  }
};

// اختصار مريح
const esc = (s) => Sanitizer.escape(s);


// ── IMAGE COMPRESSOR ─────────────────────────────────
// ضغط الصور قبل رفعها لـ Firebase Storage
const ImageCompressor = {
  /**
   * @param {File} file - ملف الصورة الأصلي
   * @param {object} options - خيارات الضغط
   * @param {number} options.maxWidth  - أقصى عرض بالبكسل (افتراضي: 1200)
   * @param {number} options.maxHeight - أقصى ارتفاع بالبكسل (افتراضي: 1200)
   * @param {number} options.quality  - جودة JPEG من 0 إلى 1 (افتراضي: 0.82)
   * @param {number} options.maxSizeKB - الحد الأقصى للحجم بـ KB (افتراضي: 800)
   * @returns {Promise<File>} - ملف مضغوط
   */
  async compress(file, options = {}) {
    const {
      maxWidth  = 1200,
      maxHeight = 1200,
      quality   = 0.82,
      maxSizeKB = 800,
    } = options;

    // إذا الصورة صغيرة أصلاً — أرجعها كما هي
    if (file.size <= maxSizeKB * 1024) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        // حساب الأبعاد الجديدة مع الحفاظ على النسبة
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        // الرسم على Canvas
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // تحديد نوع الملف الناتج:
        // PNG  → يبقى PNG  (للحفاظ على الشفافية)
        // WebP → يبقى WebP (تنسيق حديث وخفيف، لا حاجة للتحويل)
        // JPEG/HEIC/غيرها → JPEG
        const outputType =
          file.type === 'image/png'  ? 'image/png'  :
          file.type === 'image/webp' ? 'image/webp' :
          'image/jpeg';
        const ext =
          outputType === 'image/png'  ? 'png'  :
          outputType === 'image/webp' ? 'webp' :
          'jpg';

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('فشل ضغط الصورة')); return; }
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, `.${ext}`),
              { type: outputType, lastModified: Date.now() }
            );
            console.log(
              `[ImageCompressor] ${(file.size/1024).toFixed(0)}KB → ` +
              `${(compressed.size/1024).toFixed(0)}KB ` +
              `(${Math.round((1 - compressed.size/file.size)*100)}% تقليص)`
            );
            resolve(compressed);
          },
          outputType,
          quality
        );
      };

      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة')); };
      img.src = url;
    });
  },

  // ضغط مخصص للصور المصغرة (thumbnails)
  async thumbnail(file) {
    return this.compress(file, { maxWidth: 400, maxHeight: 400, quality: 0.75, maxSizeKB: 150 });
  },

  // ضغط للمعرض
  async gallery(file) {
    return this.compress(file, { maxWidth: 1400, maxHeight: 1000, quality: 0.85, maxSizeKB: 600 });
  },

  // ضغط للشكاوى
  async complaint(file) {
    return this.compress(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.80, maxSizeKB: 400 });
  },

  // ضغط للأخبار
  async news(file) {
    return this.compress(file, { maxWidth: 1200, maxHeight: 800, quality: 0.85, maxSizeKB: 500 });
  }
};


// ── FORM VALIDATORS ──────────────────────────────────
const Validator = {
  rules: {
    required:  (v)    => v.trim().length > 0         || 'هذا الحقل مطلوب',
    minLen:    (n)    => (v) => v.length >= n         || `الحد الأدنى ${n} أحرف`,
    phone:     (v)    => /^0[0-9]{8,11}$/.test(v.trim()) || 'رقم الهاتف غير صحيح',
    email:     (v)    => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'البريد الإلكتروني غير صحيح',
    password:  (v)    => v.length >= 6               || 'كلمة المرور 6 أحرف على الأقل',
    match:     (other)=> (v) => v === other           || 'كلمتا المرور غير متطابقتان',
    noXss:     (v)    => !/<[^>]*>/.test(v)           || 'النص يحتوي على رموز غير مسموح بها',
  },

  // ربط حقل بقاعدة التحقق مع عرض لحظي
  bind(inputEl, rules = [], options = {}) {
    const {
      errorClass = 'finp-err',
      okClass    = 'finp-ok',
      feedbackId = null,
    } = options;

    const validate = () => {
      const val = inputEl.value;
      for (const rule of rules) {
        const result = typeof rule === 'function' ? rule(val) : this.rules[rule]?.(val);
        if (result !== true) {
          inputEl.classList.remove(okClass);
          inputEl.classList.add(errorClass);
          if (feedbackId) {
            const fb = document.getElementById(feedbackId);
            if (fb) { fb.textContent = result; fb.style.display = 'block'; }
          }
          return false;
        }
      }
      inputEl.classList.remove(errorClass);
      inputEl.classList.add(okClass);
      if (feedbackId) {
        const fb = document.getElementById(feedbackId);
        if (fb) fb.style.display = 'none';
      }
      return true;
    };

    inputEl.addEventListener('input', validate);
    inputEl.addEventListener('blur',  validate);
    return validate; // أرجع دالة التحقق للاستخدام اليدوي
  },

  // تحقق من تطابق كلمتي المرور بشكل لحظي
  bindPasswordMatch(passEl, confirmEl, feedbackId) {
    const check = () => {
      const fb = document.getElementById(feedbackId);
      if (!confirmEl.value) { // لم يبدأ الكتابة بعد
        confirmEl.classList.remove('finp-ok', 'finp-err');
        if (fb) fb.style.display = 'none';
        return;
      }
      const match = passEl.value === confirmEl.value;
      confirmEl.classList.toggle('finp-ok',  match);
      confirmEl.classList.toggle('finp-err', !match);
      if (fb) {
        fb.textContent    = match ? '' : 'كلمتا المرور غير متطابقتان';
        fb.style.display  = match ? 'none' : 'block';
        fb.style.color    = '#fca5a5';
      }
    };
    passEl.addEventListener('input',   check);
    confirmEl.addEventListener('input', check);
    return check;
  },

  // قوة كلمة المرور
  bindPasswordStrength(passEl, strengthBarId) {
    const bar = document.getElementById(strengthBarId);
    if (!bar) return;

    passEl.addEventListener('input', () => {
      const v = passEl.value;
      let score = 0;
      if (v.length >= 6)  score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;

      const levels = [
        { label: '', color: 'transparent', width: '0%' },
        { label: 'ضعيفة جداً', color: '#ef4444', width: '20%' },
        { label: 'ضعيفة',      color: '#f59e0b', width: '40%' },
        { label: 'متوسطة',     color: '#fbbf24', width: '60%' },
        { label: 'جيدة',       color: '#34d399', width: '80%' },
        { label: 'قوية',       color: '#00d4d8', width: '100%' },
      ];

      const lvl = levels[Math.min(score, 5)];
      const fill = bar.querySelector('.ps-fill');
      const lbl  = bar.querySelector('.ps-label');
      if (fill) { fill.style.width = v ? lvl.width : '0%'; fill.style.background = lvl.color; }
      if (lbl)  lbl.textContent = v ? lvl.label : '';
    });
  }
};


// ── TOAST ────────────────────────────────────────────
function showToast(msg, ok = true) {
  const existing = document.querySelector('.toast');
  if (!existing) return;
  existing.textContent = msg;
  existing.className   = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
  existing.classList.add('show');
  clearTimeout(existing._timer);
  existing._timer = setTimeout(() => existing.classList.remove('show'), 3500);
}


// ── DATE FORMATTER ───────────────────────────────────
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
}


// ── STATUS MAP ────────────────────────────────────────
const statusMap = {
  pending:     { label: 'قيد الانتظار',  cls: 'b-pending'   },
  approved:    { label: 'مقبول',          cls: 'b-approved'  },
  delivered:   { label: 'تم التسليم',    cls: 'b-delivered' },
  rejected:    { label: 'مرفوض',          cls: 'b-rejected'  },
  open:        { label: 'مفتوحة',         cls: 'b-pending'   },
  in_progress: { label: 'قيد المعالجة',  cls: 'b-approved'  },
  resolved:    { label: 'محلولة',         cls: 'b-delivered' },
  closed:      { label: 'مغلقة',          cls: 'b-rejected'  },
};


// ── FILE SIZE FORMATTER ──────────────────────────────
function formatFileSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
