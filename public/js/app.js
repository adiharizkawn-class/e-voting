let kandidatData = [];
let selectedKandidat = null;
let voterNama = "";
let voterKelas = "";

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  try {
    const settingsRes = await fetch("/api/settings");
    const settingsJson = await settingsRes.json();

    if (settingsJson.success) {
      document.getElementById("judulVoting").textContent =
        settingsJson.data.judul_voting || "Pemungutan Suara";
      if (settingsJson.data.voting_open !== "true") {
        hideLoading();
        showScreen("closedScreen");
        return;
      }
    }

    const kandidatRes = await fetch("/api/kandidat");
    const kandidatJson = await kandidatRes.json();
    if (kandidatJson.success) kandidatData = kandidatJson.data;

    hideLoading();
    showScreen("mainScreen");
  } catch (err) {
    hideLoading();
    showToast("Gagal memuat data. Coba refresh halaman.");
  }
}

function hideLoading() {
  document.getElementById("loadingScreen").style.display = "none";
}

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.style.display = "none"));
  document.getElementById(id).style.display = "block";
}

async function lanjutPilih() {
  const nama = document.getElementById("inputNama").value.trim();
  const kelas = document.getElementById("inputKelas").value.trim();

  if (!nama) {
    showToast("Masukkan nama lengkap Anda");
    return;
  }
  if (!kelas) {
    showToast("Masukkan kelas Anda");
    return;
  }

  try {
    const res = await fetch("/api/check-voter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, kelas }),
    });
    const json = await res.json();
    if (json.sudah_vote) {
      showScreen("sudahVoteScreen");
      return;
    }
  } catch (err) {
    showToast("Gagal mengecek data. Coba lagi.");
    return;
  }

  voterNama = nama;
  voterKelas = kelas;

  document.getElementById("voterForm").style.display = "none";
  document.getElementById("kandidatSection").style.display = "block";
  document.getElementById("voterInfoBar").innerHTML =
    `👤 <strong>${nama}</strong> &nbsp;|&nbsp; 🎓 Kelas ${kelas}`;

  renderKandidat();
}

function renderKandidat() {
  const container = document.getElementById("kandidatList");
  container.innerHTML = "";

  kandidatData.forEach((k) => {
    const card = document.createElement("div");
    card.className = "kandidat-card";
    card.id = `card-${k.id}`;
    card.onclick = () => selectKandidat(k.id);

    card.innerHTML = `
      <div class="kandidat-header">
        <div class="kandidat-nomor">${k.nomor_urut}</div>
        <img class="kandidat-foto" src="images/${k.foto}" alt="${k.nama}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22>${k.nomor_urut}</text></svg>'">
        <div class="kandidat-info">
          <div class="kandidat-nama">${k.nama}</div>
          <div class="kandidat-desk">${k.deskripsi}</div>
        </div>
      </div>
      <div class="kandidat-action">
        <button class="btn btn-vote" onclick="event.stopPropagation(); pilihKandidat(${k.id})">
          ✓ Pilih ${k.nama}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function selectKandidat(id) {
  document
    .querySelectorAll(".kandidat-card")
    .forEach((c) => c.classList.remove("selected"));
  document.getElementById(`card-${id}`).classList.add("selected");
  selectedKandidat = id;
}

function pilihKandidat(id) {
  selectedKandidat = id;
  const kandidat = kandidatData.find((k) => k.id === id);
  if (!kandidat) return;

  document.getElementById("konfirmasiDetail").innerHTML = `
    <div class="nama-kandidat">${kandidat.nama}</div>
    <div class="nomor-kandidat">Kandidat No. Urut ${kandidat.nomor_urut}</div>
  `;
  document.getElementById("modalKonfirmasi").style.display = "flex";
}

function tutupModal() {
  document.getElementById("modalKonfirmasi").style.display = "none";
}

async function konfirmasiVote() {
  tutupModal();
  if (!selectedKandidat) return;

  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama: voterNama,
        kelas: voterKelas,
        kandidat_id: selectedKandidat,
      }),
    });

    const json = await res.json();

    if (json.success) {
      const kandidat = kandidatData.find((k) => k.id === selectedKandidat);
      document.getElementById("suksesMessage").textContent =
        `Terima kasih ${voterNama}, suara Anda telah tercatat.`;
      document.getElementById("suksesDetail").innerHTML = `
        <div class="detail-row"><span class="detail-label">Pemilih</span><span class="detail-value">${voterNama}</span></div>
        <div class="detail-row"><span class="detail-label">Kelas</span><span class="detail-value">${voterKelas}</span></div>
        <div class="detail-row"><span class="detail-label">Kandidat Dipilih</span><span class="detail-value">${kandidat.nama} (No. ${kandidat.nomor_urut})</span></div>
        <div class="detail-row"><span class="detail-label">Waktu</span><span class="detail-value">${new Date().toLocaleString("id-ID")}</span></div>
      `;
      showScreen("suksesScreen");
    } else {
      showToast(json.message || "Gagal menyimpan suara");
    }
  } catch (err) {
    showToast("Terjadi kesalahan. Coba lagi.");
  }
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
