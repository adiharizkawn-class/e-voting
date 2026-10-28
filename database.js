const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Fungsi Pembersih String
function clean(val) {
  if (!val) return "";
  let res = String(val).trim();
  if (
    (res.startsWith('"') && res.endsWith('"')) ||
    (res.startsWith("'") && res.endsWith("'"))
  ) {
    res = res.slice(1, -1);
  }
  return res;
}

// Fungsi Ambil Kunci (Otomatis deteksi Laptop vs Vercel)
function getCredentials() {
  const jsonPath = path.join(__dirname, "serviceAccount.json");

  // 1. Jika di laptop ada file serviceAccount.json, pakai file itu
  if (fs.existsSync(jsonPath)) {
    return cert(JSON.parse(fs.readFileSync(jsonPath, "utf8")));
  }

  // 2. Jika di Vercel, pakai Environment Variables
  const projectId = clean(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(
    /\\n/g,
    "\n",
  );

  return cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

// Inisialisasi Firebase Anti-Crash
if (getApps().length === 0) {
  try {
    initializeApp({
      credential: getCredentials(),
    });
  } catch (err) {
    console.log("⚠️ Firebase Warning:", err.message);
  }
}

const firestore = getFirestore();

// Seed data awal jika database masih kosong
async function initDatabase() {
  try {
    const kandidatRef = firestore.collection("kandidat");
    const snapshot = await kandidatRef.get();
    if (snapshot.empty) {
      const defaultKandidat = [
        {
          id: 1,
          nama: "Ahmad Fauzi",
          foto: "kandidat1.jpg",
          deskripsi: "Visi: Transparan dan inovatif",
          nomor_urut: 1,
        },
        {
          id: 2,
          nama: "Siti Nurhaliza",
          foto: "kandidat2.jpg",
          deskripsi: "Visi: Mengutamakan kebersamaan",
          nomor_urut: 2,
        },
        {
          id: 3,
          nama: "Budi Santoso",
          foto: "kandidat3.jpg",
          deskripsi: "Visi: Kreativitas dan kolaborasi",
          nomor_urut: 3,
        },
      ];
      for (const k of defaultKandidat) {
        await kandidatRef.doc(k.id.toString()).set(k);
      }
      await firestore.collection("settings").doc("config").set({
        voting_open: "true",
        judul_voting: "Pemilihan Ketua",
      });
      console.log("✅ Default Data Firebase Berhasil Dibuat!");
    }
  } catch (err) {
    console.log("Info Firebase:", err.message);
  }
}
initDatabase().catch(console.error);

const db = {
  async getKandidat() {
    const kandidatSnap = await firestore.collection("kandidat").get();
    const suaraSnap = await firestore.collection("suara").get();
    const suaras = suaraSnap.docs.map((doc) => doc.data());

    return kandidatSnap.docs
      .map((doc) => {
        const k = doc.data();
        return {
          ...k,
          jumlah_suara: suaras.filter((s) => s.kandidat_id === k.id).length,
        };
      })
      .sort((a, b) => a.nomor_urut - b.nomor_urut);
  },

  async getKandidatById(id) {
    const doc = await firestore.collection("kandidat").doc(id.toString()).get();
    return doc.exists ? doc.data() : null;
  },

  async getSettings() {
    const doc = await firestore.collection("settings").doc("config").get();
    return doc.exists
      ? doc.data()
      : { voting_open: "true", judul_voting: "Pemilihan Ketua" };
  },

  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  },

  async setSetting(key, value) {
    await firestore
      .collection("settings")
      .doc("config")
      .set({ [key]: value }, { merge: true });
  },

  async getSuaraByNamaKelas(nama, kelas) {
    const snapshot = await firestore
      .collection("suara")
      .where("voter_nama_clean", "==", nama.toLowerCase().trim())
      .where("voter_kelas_clean", "==", kelas.toLowerCase().trim())
      .get();

    return snapshot.empty ? null : snapshot.docs[0].data();
  },

  async addSuara(vote) {
    const voteData = {
      ...vote,
      voter_nama_clean: vote.voter_nama.toLowerCase().trim(),
      voter_kelas_clean: vote.voter_kelas.toLowerCase().trim(),
    };
    await firestore.collection("suara").doc(vote.voter_id).set(voteData);
    return voteData;
  },

  async getTotalSuara() {
    const snapshot = await firestore.collection("suara").get();
    return snapshot.size;
  },

  async getAllSuara() {
    const suaraSnap = await firestore.collection("suara").get();
    const kandidatSnap = await firestore.collection("kandidat").get();

    const kandidats = kandidatSnap.docs.map((doc) => doc.data());
    const suaras = suaraSnap.docs.map((doc) => doc.data());

    return suaras
      .map((s) => {
        const kandidat = kandidats.find((k) => k.id === s.kandidat_id);
        return {
          ...s,
          kandidat_nama: kandidat ? kandidat.nama : "-",
          nomor_urut: kandidat ? kandidat.nomor_urut : 0,
        };
      })
      .sort((a, b) => new Date(b.waktu_vote) - new Date(a.waktu_vote));
  },

  async getSuaraTerakhir(limit = 20) {
    const all = await this.getAllSuara();
    return all.slice(0, limit);
  },

  async getStatsPerKandidat() {
    return await this.getKandidat();
  },

  async resetSuara() {
    const snapshot = await firestore.collection("suara").get();
    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  },

  async toggleVoting() {
    const current = await this.getSetting("voting_open");
    const nextState = current === "true" ? "false" : "true";
    await this.setSetting("voting_open", nextState);
    return nextState === "true";
  },
};

module.exports = db;
