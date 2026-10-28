let adminPassword = "";
let dashboardData = null;
let votingOpen = true;
let autoRefreshInterval = null;
let voteChartInstance = null; // Variabel untuk menyimpan grafik

async function loginAdmin() {
  const password = document.getElementById("inputPassword").value;
  if (!password) {
    showToast("Masukkan password");
    return;
  }

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();

    if (json.success) {
      adminPassword = password;
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("dashboardScreen").style.display = "block";
      loadDashboard();
      autoRefreshInterval = setInterval(loadDashboard, 10000); // Auto refresh 10 detik
    } else {
      showToast("Password salah!");
    }
  } catch (err) {
    showToast("Gagal login. Coba lagi.");
  }
}

function logoutAdmin() {
  adminPassword = "";
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("dashboardScreen").style.display = "none";
  document.getElementById("inputPassword").value = "";
}

async function loadDashboard() {
  try {
    const res = await fetch("/api/admin/stats", {
      headers: { "x-admin-password": adminPassword },
    });
    const json = await res.json();
    if (!json.success) {
      showToast(json.message);
      return;
    }

    dashboardData = json.data;
    votingOpen = dashboardData.settings.voting_open === "true";
    renderStats();
    renderChart();
    renderRecentVotes();
    renderControls();
    document.getElementById("lastUpdate").textContent =
      `Terakhir diperbarui: ${new Date().toLocaleString("id-ID")}`;
  } catch (err) {
    console.error(err);
  }
}

function renderStats() {
  const data = dashboardData;
  const grid = document.getElementById("statsGrid");
  let maxVotes = 0,
    winner = null;
  data.per_kandidat.forEach((k) => {
    if (k.jumlah_suara > maxVotes) {
      maxVotes = k.jumlah_suara;
      winner = k;
    }
  });

  let html = `<div class="stat-card highlight"><div class="stat-number">${data.total_suara}</div><div class="stat-label">Total Suara Masuk</div></div>`;
  data.per_kandidat.forEach((k) => {
    const isWinner = winner && k.id === winner.id && maxVotes > 0;
    html += `<div class="stat-card"><div class="stat-number">${k.jumlah_suara}</div><div class="stat-label">${k.nama} ${isWinner ? '<span class="winner-badge">👑 Leading</span>' : ""}</div></div>`;
  });
  grid.innerHTML = html;
}

// FUNGSI UNTUK MERENDER DIAGRAM DONUT
function renderChart() {
  const container = document.getElementById("chartContainer");
  const data = dashboardData;

  // Hapus grafik lama kalau ada (untuk mencegah penumpukan grafik saat refresh)
  if (voteChartInstance) {
    voteChartInstance.destroy();
  }

  // Kalau belum ada suara masuk
  if (data.total_suara === 0) {
    container.innerHTML = '<div class="empty-text">Belum ada suara masuk</div>';
    return;
  }

  // Buat canvas baru
  container.innerHTML = '<canvas id="voteChart"></canvas>';
  const ctx = document.getElementById("voteChart").getContext("2d");

  // Siapkan data nama kandidat & jumlah suaranya
  const labels = data.per_kandidat.map(
    (k) => `No. ${k.nomor_urut} - ${k.nama}`,
  );
  const votes = data.per_kandidat.map((k) => k.jumlah_suara);

  // Buat grafik donut
  voteChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: votes,
          backgroundColor: [
            "#00d2ff", // Warna Kandidat 1
            "#f093fb", // Warna Kandidat 2
            "#25D366", // Warna Kandidat 3
          ],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#fff", padding: 20, font: { size: 13 } },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.label || "";
              if (label) label += ": ";
              label += context.raw + " suara";
              return label;
            },
          },
        },
      },
      cutout: "65%", // Ketebalan donut
    },
  });
}

function renderRecentVotes() {
  const container = document.getElementById("recentVotes");
  const votes = dashboardData.suara_terakhir;
  if (votes.length === 0) {
    container.innerHTML = '<div class="empty-text">Belum ada suara masuk</div>';
    return;
  }

  let html = "";
  votes.forEach((v) => {
    const waktu = new Date(v.waktu_vote).toLocaleString("id-ID");
    html += `
      <div class="vote-item">
        <div class="vote-item-left">
          <div class="vote-item-name">${v.voter_nama}</div>
          <div class="vote-item-phone">Kelas ${v.voter_kelas || "-"}</div>
        </div>
        <div class="vote-item-right">
          <div class="vote-item-kandidat">→ ${v.kandidat_nama}</div>
          <div class="vote-item-time">${waktu}</div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderControls() {
  const btn = document.getElementById("btnToggleVoting");
  if (votingOpen) {
    btn.textContent = "🔓 Voting DIBUKA — Klik untuk Tutup";
    btn.className = "btn btn-success btn-full";
  } else {
    btn.textContent = "🔒 Voting DITUTUP — Klik untuk Buka";
    btn.className = "btn btn-warning btn-full";
  }
  document.getElementById("inputTitle").value =
    dashboardData.settings.judul_voting || "";
}

async function toggleVoting() {
  const res = await fetch("/api/admin/toggle-voting", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
    },
  });
  const json = await res.json();
  if (json.success) {
    showToast(json.message, "success");
    loadDashboard();
  } else showToast(json.message);
}

async function updateTitle() {
  const title = document.getElementById("inputTitle").value.trim();
  if (!title) {
    showToast("Judul tidak boleh kosong");
    return;
  }
  const res = await fetch("/api/admin/update-title", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
    },
    body: JSON.stringify({ title }),
  });
  const json = await res.json();
  if (json.success) showToast("Judul berhasil diupdate", "success");
}

async function resetVoting() {
  if (!confirm("⚠️ Semua data suara akan dihapus permanen. Lanjutkan?")) return;
  if (!confirm("Apakah Anda benar-benar yakin? Data tidak bisa dikembalikan!"))
    return;
  const res = await fetch("/api/admin/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
    },
  });
  const json = await res.json();
  if (json.success) {
    showToast("Semua suara berhasil direset", "success");
    loadDashboard();
  }
}

async function loadAllVoters() {
  const res = await fetch("/api/admin/voters", {
    headers: { "x-admin-password": adminPassword },
  });
  const json = await res.json();
  if (!json.success) return;

  const container = document.getElementById("allVoters");
  if (json.data.length === 0) {
    container.innerHTML =
      '<div class="empty-text">Belum ada data pemilih</div>';
    return;
  }

  let html = "";
  json.data.forEach((v, i) => {
    const waktu = new Date(v.waktu_vote).toLocaleString("id-ID");
    html += `
      <div class="vote-item">
        <div class="vote-item-left">
          <div class="vote-item-name">${i + 1}. ${v.voter_nama}</div>
          <div class="vote-item-phone">Kelas ${v.voter_kelas || "-"}</div>
        </div>
        <div class="vote-item-right">
          <div class="vote-item-kandidat">→ ${v.kandidat_nama}</div>
          <div class="vote-item-time">${waktu}</div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function showToast(message, type = "error") {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
