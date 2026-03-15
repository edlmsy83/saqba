/* ═══════════════════════════════════════════════════════
   بوابة سقبا — firebase-config.js
   Firebase Modular SDK v10 (Tree-shakeable)

   الفرق الجوهري عن نسخة compat:
   ✅ يُحمَّل فقط ما نستخدمه (Tree-shaking) — أقل حجماً
   ✅ الصياغة الرسمية الحديثة لـ Firebase 9/10
   ✅ getCountFromServer لعد الوثائق دون تحميل بياناتها
   ═══════════════════════════════════════════════════════ */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc,
  addDoc, setDoc, getDoc, getDocs,
  updateDoc, deleteDoc,
  query, where, orderBy, limit,
  serverTimestamp, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getStorage, ref as sRef,
  uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

/* ─── استبدل هذه القيم بإعداداتك من Firebase Console ─── */
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

/* ─── Auth State ─────────────────────────────────────── */
onAuthStateChanged(auth, (user) => {
  window.currentUser = user ?? null;
  document.dispatchEvent(
    new CustomEvent(user ? 'userLoggedIn' : 'userLoggedOut', { detail: user })
  );
});

/* ─── رفع صورة مساعدة ───────────────────────────────── */
async function uploadImage(file, path) {
  const compressed = typeof ImageCompressor !== 'undefined'
    ? await ImageCompressor.compress(file) : file;
  const r = sRef(storage, `${path}/${Date.now()}_${compressed.name}`);
  await uploadBytes(r, compressed);
  return getDownloadURL(r);
}

/* ═══════════════════════════════════════════════════════
   FirestoreService
   ═══════════════════════════════════════════════════════ */
const FirestoreService = {

  /* ── Users ── */
  async createUser(uid, data) {
    return setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() });
  },
  async getUser(uid) {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  },

  /* ── Gas Requests ── */
  async createGasRequest(data) {
    const qSnap = await getDocs(
      query(collection(db, 'gas_requests'), where('district', '==', data.district))
    );
    const queueNumber = qSnap.size + 1;
    const ref = await addDoc(collection(db, 'gas_requests'), {
      ...data, queueNumber, status: 'pending', createdAt: serverTimestamp()
    });
    // نُرجع queueNumber مباشرةً لتجنب استدعاء getDoc إضافي
    return { id: ref.id, queueNumber };
  },
  async getUserGasRequests(userId) {
    const s = await getDocs(
      query(collection(db,'gas_requests'), where('userId','==',userId), orderBy('createdAt','desc'))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAllGasRequests(status = null) {
    const c = [orderBy('createdAt','desc')];
    if (status) c.unshift(where('status','==',status));
    const s = await getDocs(query(collection(db,'gas_requests'), ...c));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async updateGasRequestStatus(id, status) {
    return updateDoc(doc(db,'gas_requests',id), { status });
  },

  /* ── Complaints ── */
  async createComplaint(data, imageFile) {
    const image = imageFile
      ? await uploadImage(imageFile, 'complaints') : null;
    return addDoc(collection(db,'complaints'), {
      ...data, image, status: 'open', createdAt: serverTimestamp()
    });
  },
  async getUserComplaints(userId) {
    const s = await getDocs(
      query(collection(db,'complaints'), where('userId','==',userId), orderBy('createdAt','desc'))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAllComplaints() {
    const s = await getDocs(
      query(collection(db,'complaints'), orderBy('createdAt','desc'))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async updateComplaintStatus(id, status) {
    return updateDoc(doc(db,'complaints',id), { status });
  },

  /* ── News ── */
  async getNews(n = 10) {
    const s = await getDocs(
      query(collection(db,'news'), orderBy('createdAt','desc'), limit(n))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async createNews(data, imageFile) {
    const image = imageFile
      ? await uploadImage(imageFile, 'news') : null;
    return addDoc(collection(db,'news'), {
      ...data, image, createdAt: serverTimestamp()
    });
  },
  async deleteNews(id) {
    return deleteDoc(doc(db,'news',id));
  },

  /* ── Gallery ── */
  async getGallery() {
    const s = await getDocs(
      query(collection(db,'gallery'), orderBy('createdAt','desc'))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addGalleryImage(data, imageFile) {
    const image = await uploadImage(imageFile, 'gallery');
    return addDoc(collection(db,'gallery'), {
      ...data, image, createdAt: serverTimestamp()
    });
  },
  async deleteGalleryImage(id) {
    return deleteDoc(doc(db,'gallery',id));
  },

  /* ── Dashboard Stats (getCountFromServer = فعّال جداً) ── */
  async getDashboardStats() {
    const [u, ga, gp, ca, co, n] = await Promise.all([
      getCountFromServer(collection(db,'users')),
      getCountFromServer(collection(db,'gas_requests')),
      getCountFromServer(query(collection(db,'gas_requests'), where('status','==','pending'))),
      getCountFromServer(collection(db,'complaints')),
      getCountFromServer(query(collection(db,'complaints'), where('status','==','open'))),
      getCountFromServer(collection(db,'news')),
    ]);
    return {
      totalUsers:         u.data().count,
      totalGasRequests:   ga.data().count,
      pendingGasRequests: gp.data().count,
      totalComplaints:    ca.data().count,
      openComplaints:     co.data().count,
      totalNews:          n.data().count,
    };
  },

  /* ── Users list (for admin) ── */
  async getAllUsers() {
    const s = await getDocs(
      query(collection(db,'users'), orderBy('createdAt','desc'))
    );
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
};

/* ═══════════════════════════════════════════════════════
   AuthService
   ═══════════════════════════════════════════════════════ */
const AuthService = {
  async register(email, password, userData) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await FirestoreService.createUser(cred.user.uid, { ...userData, email, role: 'citizen' });
    return cred.user;
  },
  async login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  async logout() {
    return signOut(auth);
  },
  async isAdmin(uid) {
    const user = await FirestoreService.getUser(uid);
    return user?.role === 'admin';
  },
};

/* ─── تصدير عالمي ────────────────────────────────────── */
window.FirestoreService = FirestoreService;
window.AuthService      = AuthService;
