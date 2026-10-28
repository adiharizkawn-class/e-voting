require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/kandidat", async (req, res) => {
  try {
    const data = await db.getKandidat();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const data = await db.getSettings();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/vote", async (req, res) => {
  try {
    const { nama, kelas, kandidat_id } = req.body;

    if (!nama || !kelas || !kandidat_id) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Nama, kelas, dan pilihan kandidat wajib diisi",
        });
    }

    const isOpen = await db.getSetting("voting_open");
    if (isOpen !== "true") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Maaf, pemungutan suara sudah ditutup",
        });
    }

    const existing = await db.getSuaraByNamaKelas(nama, kelas);
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Nama dan kelas ini sudah pernah memberikan suara",
        });
    }

    const kandidat = await db.getKandidatById(kandidat_id);
    if (!kandidat) {
      return res
        .status(404)
        .json({ success: false, message: "Kandidat tidak ditemukan" });
    }

    const voter_id = uuidv4();
    await db.addSuara({
      voter_id,
      voter_nama: nama,
      voter_kelas: kelas,
      kandidat_id: parseInt(kandidat_id),
      waktu_vote: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Suara berhasil disimpan!",
      data: { voter_id, kandidat_dipilih: kandidat.nama },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/check-voter", async (req, res) => {
  try {
    const { nama, kelas } = req.body;
    if (!nama || !kelas)
      return res.json({ success: true, sudah_vote: false, data: null });

    const existing = await db.getSuaraByNamaKelas(nama, kelas);
    res.json({
      success: true,
      sudah_vote: !!existing,
      data: existing ? { kandidat_id: existing.kandidat_id } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function adminAuth(req, res, next) {
  if (req.headers["x-admin-password"] !== process.env.ADMIN_PASSWORD) {
    return res
      .status(401)
      .json({ success: false, message: "Password admin salah" });
  }
  next();
}

app.post("/api/admin/login", (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, message: "Login berhasil" });
  } else {
    res.status(401).json({ success: false, message: "Password salah" });
  }
});

app.get("/api/admin/stats", adminAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        total_suara: await db.getTotalSuara(),
        per_kandidat: await db.getStatsPerKandidat(),
        suara_terakhir: await db.getSuaraTerakhir(20),
        settings: await db.getSettings(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/voters", adminAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await db.getAllSuara() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/toggle-voting", adminAuth, async (req, res) => {
  try {
    const isOpen = await db.toggleVoting();
    res.json({
      success: true,
      message: isOpen ? "Voting dibuka" : "Voting ditutup",
      voting_open: isOpen,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/reset", adminAuth, async (req, res) => {
  try {
    await db.resetSuara();
    res.json({ success: true, message: "Semua suara berhasil direset" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/update-title", adminAuth, async (req, res) => {
  try {
    await db.setSetting("judul_voting", req.body.title);
    res.json({ success: true, message: "Judul berhasil diupdate" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html")),
);

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`\n🗳️ Server E-Voting berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
