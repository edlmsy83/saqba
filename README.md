# 🕌 بوابة سقبا الرقمية

## 📁 الملفات المطلوبة للرفع على GitHub

```
saqba/
├── index.html      ← الصفحة الرئيسية
├── citizen.html    ← بوابة المواطن
└── admin.html      ← لوحة الإدارة
```

**هذا كل شيء — 3 ملفات فقط، لا مجلدات.**

كل ملف يحتوي على CSS + JS + Firebase بداخله.

---

## ⚙️ إضافة Firebase Config

في كل ملف من الثلاثة، ابحث عن هذا في نهاية الملف:

```javascript
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
```

واستبدله بإعداداتك من:
**Firebase Console → Project Settings → Your apps → SDK setup**

---

## 🌐 إعداد GitHub Pages

1. ارفع الملفات الثلاثة على repo
2. Settings → Pages → Branch: main → Save
3. أضف الدومين لـ Firebase:
   `Authentication → Settings → Authorized domains → Add: yourusername.github.io`

---

## 👤 إنشاء حساب المشرف

في Firebase Console → Firestore → أضف document:

```
Collection: users
Document ID: [uid من Authentication]

{
  name: "مشرف سقبا",
  email: "admin@saqba.sy",
  role: "admin",
  createdAt: timestamp
}
```

---

## 🔒 Firebase Security Rules

**Firestore:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid || isAdmin();
      allow create: if request.auth != null;
    }
    match /gas_requests/{id} {
      allow create: if request.auth != null;
      allow read: if resource.data.userId == request.auth.uid || isAdmin();
      allow update: if isAdmin();
    }
    match /complaints/{id} {
      allow create: if request.auth != null;
      allow read: if resource.data.userId == request.auth.uid || isAdmin();
      allow update: if isAdmin();
    }
    match /news/{id}    { allow read: if true; allow write: if isAdmin(); }
    match /gallery/{id} { allow read: if true; allow write: if isAdmin(); }
  }
}
```

**Storage:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```
