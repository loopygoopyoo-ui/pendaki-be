# API Pendataan Pendaki

REST API untuk mengelola data pendaki, gunung, dan pendakian. Dibuat dengan Node.js, Express, dan PostgreSQL (Neon/Supabase), di-deploy di Vercel.

- **URL Deployment:** https://NAMA-PROJECT.vercel.app  *(ganti dengan URL Vercel asli)*
- **Repository:** https://github.com/USERNAME/NAMA-REPO  *(ganti)*
- **ERD:** `db/erd.png`

## Struktur Database (9 tabel)

| Relasi | Tabel |
| --- | --- |
| 1:N | gunung → jalur → pos; jalur → registrasi |
| 1:1 | pendaki ↔ kesehatan_pendaki; registrasi ↔ pembayaran |
| N:N | pendaki ↔ registrasi (`anggota_registrasi`); registrasi ↔ pos (`log_pos`) |

Pada API, **pendakian** = tabel `registrasi`. Pendaki yang mendaftar otomatis tercatat sebagai ketua rombongan di `anggota_registrasi`.

## Cara Menjalankan di Lokal

1. `npm install`
2. Salin `.env.example` menjadi `.env`, isi `DATABASE_URL` dengan connection string Neon/Supabase.
3. Jalankan isi `db/schema.sql` di SQL Editor Neon/Supabase.
4. `npm run dev` → API berjalan di http://localhost:3000

## Aturan Umum

- Format request dan response: JSON. Untuk POST/PUT/PATCH gunakan header `Content-Type: application/json`.
- Status code: `200` sukses, `201` data dibuat, `400` input salah, `404` tidak ditemukan, `409` data duplikat / masih dipakai data lain, `500` error server.
- Bentuk error: `{ "error": "pesan" }`.
- Tanggal memakai format `YYYY-MM-DD`.
- `PUT` dan `PATCH` sama-sama mengubah field yang dikirim saja.

## Daftar Endpoint (15 function)

| No | Function | Method | URL |
| --- | --- | --- | --- |
| 1 | tambahDataPendaki | POST | /pendaki |
| 2 | getDataPendaki | GET | /pendaki |
| 3 | getDataPendakiById | GET | /pendaki/:id |
| 4 | ubahDataPendaki | PUT / PATCH | /pendaki/:id |
| 5 | hapusDataPendaki | DELETE | /pendaki/:id |
| 6 | cariDataPendaki | GET | /pendaki/cari?q= |
| 7 | tambahDataGunung | POST | /gunung |
| 8 | getDataGunung | GET | /gunung |
| 9 | cariDataGunung | GET | /gunung/cari?nama= |
| 10 | tambahDataPendakian | POST | /pendakian |
| 11 | getDataPendakian | GET | /pendakian |
| 12 | getDataPendakianByGunung | GET | /gunung/:id/pendakian |
| 13 | ubahDataPendakian | PUT / PATCH | /pendakian/:id |
| 14 | hapusDataPendakian | DELETE | /pendakian/:id |
| 15 | getRiwayatPendakian | GET | /pendaki/:id/riwayat |

---

## Dokumentasi Detail

### 1. tambahDataPendaki
- **Method:** POST
- **URL:** `/pendaki`
- **Deskripsi:** Menambahkan data pendaki baru
- **Header:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "nik": "3322010303000003", "nama_lengkap": "Andi Pratama", "jenis_kelamin": "L",
    "tanggal_lahir": "2002-03-03", "no_hp": "081211112222", "alamat": "Tegal",
    "kontak_darurat_nama": "Ibu Andi", "kontak_darurat_hp": "081233334444"
  }
  ```
  Wajib: nik, nama_lengkap, jenis_kelamin (`L`/`P`), tanggal_lahir, no_hp, kontak_darurat_nama, kontak_darurat_hp. Opsional: alamat.
- **Response sukses (201):**
  ```json
  { "message": "Data pendaki berhasil ditambahkan", "data": { "id": 3, "nik": "3322010303000003", "nama_lengkap": "Andi Pratama" } }
  ```
- **Response error:** 400 `{ "error": "Field nik wajib diisi" }` · 409 `{ "error": "Data duplikat: ada nilai unik (misalnya NIK) yang sudah dipakai" }`

### 2. getDataPendaki
- **Method:** GET
- **URL:** `/pendaki`
- **Deskripsi:** Menampilkan seluruh data pendaki
- **Header:** -
- **Body:** -
- **Response sukses (200):**
  ```json
  { "data": [ { "id": 1, "nik": "3322010101000001", "nama_lengkap": "Budi Santoso" } ] }
  ```
- **Response error:** 500 `{ "error": "Terjadi kesalahan pada server" }`

### 3. getDataPendakiById
- **Method:** GET
- **URL:** `/pendaki/:id` (contoh `/pendaki/1`)
- **Deskripsi:** Menampilkan satu pendaki berdasarkan ID
- **Header / Body:** -
- **Response sukses (200):** `{ "data": { "id": 1, "nama_lengkap": "Budi Santoso" } }`
- **Response error:** 404 `{ "error": "Pendaki tidak ditemukan" }` · 400 `{ "error": "ID harus berupa angka" }`

### 4. ubahDataPendaki
- **Method:** PUT atau PATCH
- **URL:** `/pendaki/:id`
- **Deskripsi:** Mengubah data pendaki (field yang dikirim saja)
- **Header:** `Content-Type: application/json`
- **Body:** `{ "no_hp": "081299990000" }`
- **Response sukses (200):** `{ "message": "Data pendaki berhasil diperbarui", "data": { "id": 1, "no_hp": "081299990000" } }`
- **Response error:** 400 `{ "error": "Minimal satu field harus dikirim" }` · 404 `{ "error": "Data pendaki tidak ditemukan" }`

### 5. hapusDataPendaki
- **Method:** DELETE
- **URL:** `/pendaki/:id`
- **Deskripsi:** Menghapus pendaki berdasarkan ID
- **Header / Body:** -
- **Response sukses (200):** `{ "message": "Data pendaki berhasil dihapus" }`
- **Response error:** 404 `{ "error": "Pendaki tidak ditemukan" }` · 409 `{ "error": "Data terkait tidak ditemukan, atau data masih dipakai data lain" }` (pendaki masih terdaftar di pendakian)

### 6. cariDataPendaki
- **Method:** GET
- **URL:** `/pendaki/cari?q=budi` (q boleh nama atau ID)
- **Deskripsi:** Mencari pendaki berdasarkan nama atau ID
- **Header / Body:** -
- **Response sukses (200):** `{ "data": [ { "id": 1, "nama_lengkap": "Budi Santoso" } ] }` (kosong jika tidak ada: `"data": []`)
- **Response error:** 400 `{ "error": "Parameter q wajib diisi (nama atau ID)" }`

### 7. tambahDataGunung
- **Method:** POST
- **URL:** `/gunung`
- **Deskripsi:** Menambahkan data gunung
- **Header:** `Content-Type: application/json`
- **Body:** `{ "nama": "Gunung Slamet", "lokasi": "Banyumas, Jawa Tengah", "ketinggian": 3428, "kuota_harian": 120 }`
  Wajib: nama, lokasi, ketinggian. Opsional: kuota_harian, status (`buka`/`tutup`).
- **Response sukses (201):** `{ "message": "Data gunung berhasil ditambahkan", "data": { "id": 3, "nama": "Gunung Slamet" } }`
- **Response error:** 400 `{ "error": "Field lokasi wajib diisi" }` · 409 (nama gunung sudah ada)

### 8. getDataGunung
- **Method:** GET
- **URL:** `/gunung`
- **Deskripsi:** Menampilkan daftar gunung
- **Header / Body:** -
- **Response sukses (200):** `{ "data": [ { "id": 1, "nama": "Gunung Ungaran", "ketinggian": 2050 } ] }`
- **Response error:** 500 `{ "error": "Terjadi kesalahan pada server" }`

### 9. cariDataGunung
- **Method:** GET
- **URL:** `/gunung/cari?nama=ungaran`
- **Deskripsi:** Mencari gunung berdasarkan nama
- **Header / Body:** -
- **Response sukses (200):** `{ "data": [ { "id": 1, "nama": "Gunung Ungaran" } ] }`
- **Response error:** 400 `{ "error": "Parameter nama wajib diisi" }`

### 10. tambahDataPendakian
- **Method:** POST
- **URL:** `/pendakian`
- **Deskripsi:** Menambahkan data pendakian baru (kode booking dibuat otomatis, pendaki menjadi ketua rombongan)
- **Header:** `Content-Type: application/json`
- **Body:**
  ```json
  { "pendaki_id": 2, "jalur_id": 1, "tanggal_naik": "2026-11-01", "tanggal_turun": "2026-11-02" }
  ```
  Wajib: pendaki_id, jalur_id, tanggal_naik, tanggal_turun. Opsional: status (`menunggu`/`disetujui`/`mendaki`/`selesai`/`dibatalkan`, default `menunggu`).
- **Response sukses (201):**
  ```json
  { "message": "Data pendakian berhasil ditambahkan",
    "data": { "id": 2, "kode_booking": "REG-20261101-4821", "status": "menunggu", "pendaki_id": 2,
              "nama_pendaki": "Siti Aminah", "nama_gunung": "Gunung Ungaran", "nama_jalur": "Mawar" } }
  ```
- **Response error:** 400 `{ "error": "Field pendaki_id wajib diisi" }` · 409 `{ "error": "Data terkait tidak ditemukan, atau data masih dipakai data lain" }` (pendaki/jalur tidak ada)

### 11. getDataPendakian
- **Method:** GET
- **URL:** `/pendakian`
- **Deskripsi:** Menampilkan seluruh data pendakian beserta nama pendaki, gunung, dan jalur
- **Header / Body:** -
- **Response sukses (200):**
  ```json
  { "data": [ { "id": 1, "kode_booking": "REG-20261010-001", "status": "disetujui", "tanggal_naik": "2026-10-10",
                "tanggal_turun": "2026-10-11", "nama_pendaki": "Budi Santoso", "nama_gunung": "Gunung Ungaran", "nama_jalur": "Mawar" } ] }
  ```
- **Response error:** 500 `{ "error": "Terjadi kesalahan pada server" }`

### 12. getDataPendakianByGunung
- **Method:** GET
- **URL:** `/gunung/:id/pendakian` (contoh `/gunung/1/pendakian`)
- **Deskripsi:** Menampilkan data pendakian pada gunung tertentu
- **Header / Body:** -
- **Response sukses (200):** `{ "data": [ { "id": 1, "kode_booking": "REG-20261010-001", "nama_gunung": "Gunung Ungaran" } ] }`
- **Response error:** 404 `{ "error": "Gunung tidak ditemukan" }`

### 13. ubahDataPendakian
- **Method:** PUT atau PATCH
- **URL:** `/pendakian/:id`
- **Deskripsi:** Mengubah data pendakian (mis. status atau tanggal)
- **Header:** `Content-Type: application/json`
- **Body:** `{ "status": "selesai" }`
  Field yang boleh diubah: jalur_id, pendaki_id, tanggal_naik, tanggal_turun, status.
- **Response sukses (200):** `{ "message": "Data pendakian berhasil diperbarui", "data": { "id": 1, "status": "selesai" } }`
- **Response error:** 404 `{ "error": "Data pendakian tidak ditemukan" }` · 400 `{ "error": "Nilai tidak memenuhi aturan validasi" }` (mis. status tidak valid atau tanggal turun lebih awal dari tanggal naik)

### 14. hapusDataPendakian
- **Method:** DELETE
- **URL:** `/pendakian/:id`
- **Deskripsi:** Menghapus data pendakian berdasarkan ID
- **Header / Body:** -
- **Response sukses (200):** `{ "message": "Data pendakian berhasil dihapus" }`
- **Response error:** 404 `{ "error": "Data pendakian tidak ditemukan" }`

### 15. getRiwayatPendakian
- **Method:** GET
- **URL:** `/pendaki/:id/riwayat` (contoh `/pendaki/1/riwayat`)
- **Deskripsi:** Menampilkan riwayat pendakian seorang pendaki
- **Header / Body:** -
- **Response sukses (200):**
  ```json
  { "pendaki": { "id": 1, "nama_lengkap": "Budi Santoso" },
    "data": [ { "pendakian_id": 1, "kode_booking": "REG-20261010-001", "status": "disetujui",
                "peran": "ketua", "nama_gunung": "Gunung Ungaran", "nama_jalur": "Mawar" } ] }
  ```
- **Response error:** 404 `{ "error": "Pendaki tidak ditemukan" }`

---

## Deploy ke Vercel

1. Upload proyek ke GitHub (file `.env` tidak ikut, sudah ada di `.gitignore`).
2. Di Vercel: **Add New → Project**, pilih repo tersebut.
3. Di **Environment Variables** tambahkan `DATABASE_URL` (isi connection string Neon) dan `DB_SSL` = `true`.
4. Klik **Deploy**.

## Pengujian

Collection Postman ada di `pengujian/postman_collection.json` (Import di Postman, lalu ubah variabel `baseUrl` ke URL Vercel). Screenshot hasil tiap endpoint disimpan di folder `pengujian/`.
