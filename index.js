// =====================================================================
// API PENDATAAN PENDAKI  -  semua kode ada di file ini
// 15 function sesuai Project Function List (Phase 1 & 2):
//   Pendaki  : tambah, get, getById, ubah, hapus, cari
//   Gunung   : tambah, get, cari
//   Pendakian: tambah, get, getByGunung, ubah, hapus, getRiwayat
// Catatan: "pendakian" disimpan di tabel `registrasi` pada database.
// =====================================================================
require('dotenv').config();
const express = require('express');
const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v); // kolom DATE tampil apa adanya: "2026-10-10"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 3,
});

const app = express();
app.use(express.json());

// ---------- helper kecil ----------
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const idValid = (v) => /^\d+$/.test(String(v));
const salahId = (res) => res.status(400).json({ error: 'ID harus berupa angka' });
const wajibKosong = (body, fields) =>
  fields.find((f) => body[f] === undefined || body[f] === null || body[f] === '');

// Query dasar pendakian (join ke pendaki, jalur, gunung)
const SELECT_PENDAKIAN = `
  SELECT r.id, r.kode_booking, r.status, r.tanggal_naik, r.tanggal_turun,
         r.ketua_id AS pendaki_id, p.nama_lengkap AS nama_pendaki,
         g.id AS gunung_id, g.nama AS nama_gunung,
         j.id AS jalur_id, j.nama AS nama_jalur
  FROM registrasi r
  JOIN pendaki p ON p.id = r.ketua_id
  JOIN jalur   j ON j.id = r.jalur_id
  JOIN gunung  g ON g.id = j.gunung_id`;

// Update sebagian field (dipakai ubahDataPendaki & ubahDataPendakian)
async function ubahData(table, label, allowed, req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const d = {};
  for (const f of allowed) if (req.body[f] !== undefined) d[f] = req.body[f];
  const keys = Object.keys(d);
  if (!keys.length) return res.status(400).json({ error: 'Minimal satu field harus dikirim' });
  const { rows } = await pool.query(
    `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
     WHERE id = $${keys.length + 1} RETURNING *`,
    [...Object.values(d), req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: `${label} tidak ditemukan` });
  res.json({ message: `${label} berhasil diperbarui`, data: rows[0] });
}

// =====================================================================
// PENDAKI
// =====================================================================
const FIELD_PENDAKI = ['nik', 'nama_lengkap', 'jenis_kelamin', 'tanggal_lahir', 'no_hp',
                       'alamat', 'kontak_darurat_nama', 'kontak_darurat_hp'];
const WAJIB_PENDAKI = ['nik', 'nama_lengkap', 'jenis_kelamin', 'tanggal_lahir', 'no_hp',
                       'kontak_darurat_nama', 'kontak_darurat_hp'];

// 1. tambahDataPendaki : POST /pendaki
async function tambahDataPendaki(req, res) {
  const b = req.body || {};
  const kosong = wajibKosong(b, WAJIB_PENDAKI);
  if (kosong) return res.status(400).json({ error: `Field ${kosong} wajib diisi` });
  const k = FIELD_PENDAKI.filter((f) => b[f] !== undefined);
  const { rows } = await pool.query(
    `INSERT INTO pendaki (${k.join(', ')}) VALUES (${k.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    k.map((f) => b[f])
  );
  res.status(201).json({ message: 'Data pendaki berhasil ditambahkan', data: rows[0] });
}

// 2. getDataPendaki : GET /pendaki
async function getDataPendaki(req, res) {
  const { rows } = await pool.query('SELECT * FROM pendaki ORDER BY id');
  res.json({ data: rows });
}

// 3. getDataPendakiById : GET /pendaki/:id
async function getDataPendakiById(req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const { rows } = await pool.query('SELECT * FROM pendaki WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Pendaki tidak ditemukan' });
  res.json({ data: rows[0] });
}

// 4. ubahDataPendaki : PUT atau PATCH /pendaki/:id
async function ubahDataPendaki(req, res) {
  return ubahData('pendaki', 'Data pendaki', FIELD_PENDAKI, req, res);
}

// 5. hapusDataPendaki : DELETE /pendaki/:id
async function hapusDataPendaki(req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const { rowCount } = await pool.query('DELETE FROM pendaki WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Pendaki tidak ditemukan' });
  res.json({ message: 'Data pendaki berhasil dihapus' });
}

// 6. cariDataPendaki : GET /pendaki/cari?q=nama atau id
async function cariDataPendaki(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Parameter q wajib diisi (nama atau ID)' });
  const { rows } = await pool.query(
    'SELECT * FROM pendaki WHERE nama_lengkap ILIKE $1 OR id::text = $2 ORDER BY id',
    [`%${q}%`, q]
  );
  res.json({ data: rows });
}

// 15. getRiwayatPendakian : GET /pendaki/:id/riwayat
async function getRiwayatPendakian(req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const cek = await pool.query('SELECT id, nama_lengkap FROM pendaki WHERE id = $1', [req.params.id]);
  if (!cek.rows.length) return res.status(404).json({ error: 'Pendaki tidak ditemukan' });
  const { rows } = await pool.query(
    `SELECT r.id AS pendakian_id, r.kode_booking, r.status, r.tanggal_naik, r.tanggal_turun,
            a.peran, a.waktu_turun, g.nama AS nama_gunung, j.nama AS nama_jalur
     FROM anggota_registrasi a
     JOIN registrasi r ON r.id = a.registrasi_id
     JOIN jalur  j ON j.id = r.jalur_id
     JOIN gunung g ON g.id = j.gunung_id
     WHERE a.pendaki_id = $1 ORDER BY r.tanggal_naik DESC`,
    [req.params.id]
  );
  res.json({ pendaki: cek.rows[0], data: rows });
}

// =====================================================================
// GUNUNG
// =====================================================================
// 7. tambahDataGunung : POST /gunung
async function tambahDataGunung(req, res) {
  const b = req.body || {};
  const kosong = wajibKosong(b, ['nama', 'lokasi', 'ketinggian']);
  if (kosong) return res.status(400).json({ error: `Field ${kosong} wajib diisi` });
  const k = ['nama', 'lokasi', 'ketinggian', 'kuota_harian', 'status'].filter((f) => b[f] !== undefined);
  const { rows } = await pool.query(
    `INSERT INTO gunung (${k.join(', ')}) VALUES (${k.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    k.map((f) => b[f])
  );
  res.status(201).json({ message: 'Data gunung berhasil ditambahkan', data: rows[0] });
}

// 8. getDataGunung : GET /gunung
async function getDataGunung(req, res) {
  const { rows } = await pool.query('SELECT * FROM gunung ORDER BY id');
  res.json({ data: rows });
}

// 9. cariDataGunung : GET /gunung/cari?nama=
async function cariDataGunung(req, res) {
  const nama = (req.query.nama || '').trim();
  if (!nama) return res.status(400).json({ error: 'Parameter nama wajib diisi' });
  const { rows } = await pool.query('SELECT * FROM gunung WHERE nama ILIKE $1 ORDER BY id', [`%${nama}%`]);
  res.json({ data: rows });
}

// =====================================================================
// PENDAKIAN  (tabel registrasi)
// =====================================================================
// pendaki_id boleh dipakai sebagai nama lain dari ketua_id
const samakanKetua = (b = {}) => {
  if (b.pendaki_id !== undefined && b.ketua_id === undefined) b.ketua_id = b.pendaki_id;
  return b;
};

// 10. tambahDataPendakian : POST /pendakian
async function tambahDataPendakian(req, res) {
  const b = samakanKetua(req.body || {});
  const kosong = wajibKosong(b, ['ketua_id', 'jalur_id', 'tanggal_naik', 'tanggal_turun']);
  if (kosong) return res.status(400).json({ error: `Field ${kosong === 'ketua_id' ? 'pendaki_id' : kosong} wajib diisi` });
  const kode = b.kode_booking ||
    `REG-${String(b.tanggal_naik).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows } = await c.query(
      `INSERT INTO registrasi (kode_booking, jalur_id, ketua_id, tanggal_naik, tanggal_turun, status)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'menunggu')) RETURNING id`,
      [kode, b.jalur_id, b.ketua_id, b.tanggal_naik, b.tanggal_turun, b.status]
    );
    // pendaki yang mendaftar otomatis tercatat sebagai ketua rombongan
    await c.query(
      `INSERT INTO anggota_registrasi (registrasi_id, pendaki_id, peran) VALUES ($1, $2, 'ketua')`,
      [rows[0].id, b.ketua_id]
    );
    await c.query('COMMIT');
    const hasil = await pool.query(`${SELECT_PENDAKIAN} WHERE r.id = $1`, [rows[0].id]);
    res.status(201).json({ message: 'Data pendakian berhasil ditambahkan', data: hasil.rows[0] });
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

// 11. getDataPendakian : GET /pendakian
async function getDataPendakian(req, res) {
  const { rows } = await pool.query(`${SELECT_PENDAKIAN} ORDER BY r.tanggal_naik DESC, r.id DESC`);
  res.json({ data: rows });
}

// 12. getDataPendakianByGunung : GET /gunung/:id/pendakian
async function getDataPendakianByGunung(req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const cek = await pool.query('SELECT id FROM gunung WHERE id = $1', [req.params.id]);
  if (!cek.rows.length) return res.status(404).json({ error: 'Gunung tidak ditemukan' });
  const { rows } = await pool.query(
    `${SELECT_PENDAKIAN} WHERE g.id = $1 ORDER BY r.tanggal_naik DESC, r.id DESC`, [req.params.id]);
  res.json({ data: rows });
}

// 13. ubahDataPendakian : PUT atau PATCH /pendakian/:id
async function ubahDataPendakian(req, res) {
  samakanKetua(req.body);
  return ubahData('registrasi', 'Data pendakian',
    ['jalur_id', 'ketua_id', 'tanggal_naik', 'tanggal_turun', 'status'], req, res);
}

// 14. hapusDataPendakian : DELETE /pendakian/:id
async function hapusDataPendakian(req, res) {
  if (!idValid(req.params.id)) return salahId(res);
  const { rowCount } = await pool.query('DELETE FROM registrasi WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Data pendakian tidak ditemukan' });
  res.json({ message: 'Data pendakian berhasil dihapus' });
}

// =====================================================================
// DAFTAR ROUTE  (urutan penting: /cari harus sebelum /:id)
// =====================================================================
app.get('/', (req, res) => res.json({ message: 'API Pendataan Pendaki berjalan' }));

app.post('/pendaki', wrap(tambahDataPendaki));
app.get('/pendaki', wrap(getDataPendaki));
app.get('/pendaki/cari', wrap(cariDataPendaki));
app.get('/pendaki/:id/riwayat', wrap(getRiwayatPendakian));
app.get('/pendaki/:id', wrap(getDataPendakiById));
app.put('/pendaki/:id', wrap(ubahDataPendaki));
app.patch('/pendaki/:id', wrap(ubahDataPendaki));
app.delete('/pendaki/:id', wrap(hapusDataPendaki));

app.post('/gunung', wrap(tambahDataGunung));
app.get('/gunung', wrap(getDataGunung));
app.get('/gunung/cari', wrap(cariDataGunung));
app.get('/gunung/:id/pendakian', wrap(getDataPendakianByGunung));

app.post('/pendakian', wrap(tambahDataPendakian));
app.get('/pendakian', wrap(getDataPendakian));
app.put('/pendakian/:id', wrap(ubahDataPendakian));
app.patch('/pendakian/:id', wrap(ubahDataPendakian));
app.delete('/pendakian/:id', wrap(hapusDataPendakian));

// ---------- endpoint tidak ada & error ----------
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

const ERR = {
  '23505': [409, 'Data duplikat: ada nilai unik (misalnya NIK) yang sudah dipakai'],
  '23503': [409, 'Data terkait tidak ditemukan, atau data masih dipakai data lain'],
  '23514': [400, 'Nilai tidak memenuhi aturan validasi'],
  '23502': [400, 'Ada field wajib yang kosong'],
  '22P02': [400, 'Format data tidak valid'],
  '22007': [400, 'Format tanggal tidak valid (gunakan YYYY-MM-DD)'],
};
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body JSON tidak valid' });
  if (ERR[err.code]) return res.status(ERR[err.code][0]).json({ error: ERR[err.code][1], detail: err.detail });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

// Di Vercel: app diekspor. Di laptop: node api/index.js
module.exports = app;
if (require.main === module) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('GANTI')) {
    console.error('\nDATABASE_URL belum diisi. Buka file .env lalu tempel connection string dari Neon.\n');
    process.exit(1);
  }
  app.listen(process.env.PORT || 3000, () => console.log('API jalan di http://localhost:3000'));
}
