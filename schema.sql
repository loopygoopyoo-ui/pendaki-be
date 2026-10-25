-- =====================================================================
-- Project Akhir : Sistem Pendataan Pendaki
-- DBMS          : PostgreSQL
-- Jumlah tabel  : 9
-- Relasi        : 1:1, 1:N, dan N:N
--
-- Ringkasan relasi:
--   gunung       1:N  jalur              (satu gunung punya banyak jalur)
--   jalur        1:N  pos                (satu jalur punya banyak pos)
--   jalur        1:N  registrasi         (satu jalur dipakai banyak registrasi)
--   pendaki      1:1  kesehatan_pendaki  (satu pendaki punya satu data kesehatan)
--   registrasi   1:1  pembayaran         (satu registrasi punya satu pembayaran)
--   pendaki      N:N  registrasi         (lewat tabel anggota_registrasi)
--   registrasi   N:N  pos                (lewat tabel log_pos, pencatatan check-in)
-- =====================================================================

-- Reset (aman dijalankan ulang)
DROP TABLE IF EXISTS log_pos            CASCADE;
DROP TABLE IF EXISTS pembayaran         CASCADE;
DROP TABLE IF EXISTS anggota_registrasi CASCADE;
DROP TABLE IF EXISTS registrasi         CASCADE;
DROP TABLE IF EXISTS kesehatan_pendaki  CASCADE;
DROP TABLE IF EXISTS pendaki            CASCADE;
DROP TABLE IF EXISTS pos                CASCADE;
DROP TABLE IF EXISTS jalur              CASCADE;
DROP TABLE IF EXISTS gunung             CASCADE;

-- ---------------------------------------------------------------------
-- 1. gunung
-- ---------------------------------------------------------------------
CREATE TABLE gunung (
    id          SERIAL PRIMARY KEY,
    nama        VARCHAR(100) NOT NULL UNIQUE,
    lokasi      VARCHAR(150) NOT NULL,            -- kabupaten / provinsi
    ketinggian  INT          NOT NULL CHECK (ketinggian > 0),  -- mdpl
    kuota_harian INT         NOT NULL DEFAULT 100 CHECK (kuota_harian > 0),
    status      VARCHAR(10)  NOT NULL DEFAULT 'buka'
                CHECK (status IN ('buka', 'tutup'))
);

-- ---------------------------------------------------------------------
-- 2. jalur  (RELASI 1:N dengan gunung)
-- ---------------------------------------------------------------------
CREATE TABLE jalur (
    id          SERIAL PRIMARY KEY,
    gunung_id   INT          NOT NULL
                REFERENCES gunung(id) ON DELETE CASCADE,
    nama        VARCHAR(100) NOT NULL,
    panjang_km  NUMERIC(5,2) CHECK (panjang_km > 0),
    estimasi_jam NUMERIC(4,1) CHECK (estimasi_jam > 0),
    tingkat_kesulitan VARCHAR(10) NOT NULL DEFAULT 'sedang'
                CHECK (tingkat_kesulitan IN ('mudah', 'sedang', 'sulit')),
    UNIQUE (gunung_id, nama)
);

-- ---------------------------------------------------------------------
-- 3. pos  (RELASI 1:N dengan jalur)
--    urutan = urutan pos dari basecamp sampai puncak
-- ---------------------------------------------------------------------
CREATE TABLE pos (
    id          SERIAL PRIMARY KEY,
    jalur_id    INT          NOT NULL
                REFERENCES jalur(id) ON DELETE CASCADE,
    nama        VARCHAR(100) NOT NULL,
    urutan      INT          NOT NULL CHECK (urutan >= 0),
    ketinggian  INT          CHECK (ketinggian > 0),
    UNIQUE (jalur_id, urutan)
);

-- ---------------------------------------------------------------------
-- 4. pendaki
-- ---------------------------------------------------------------------
CREATE TABLE pendaki (
    id            SERIAL PRIMARY KEY,
    nik           VARCHAR(16)  NOT NULL UNIQUE,
    nama_lengkap  VARCHAR(100) NOT NULL,
    jenis_kelamin CHAR(1)      NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
    tanggal_lahir DATE         NOT NULL,
    no_hp         VARCHAR(20)  NOT NULL,
    alamat        TEXT,
    kontak_darurat_nama VARCHAR(100) NOT NULL,
    kontak_darurat_hp   VARCHAR(20)  NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. kesehatan_pendaki  (RELASI 1:1 dengan pendaki)
--    pendaki_id bersifat UNIQUE sehingga satu pendaki hanya punya
--    satu data kesehatan.
-- ---------------------------------------------------------------------
CREATE TABLE kesehatan_pendaki (
    id            SERIAL PRIMARY KEY,
    pendaki_id    INT          NOT NULL UNIQUE
                  REFERENCES pendaki(id) ON DELETE CASCADE,
    golongan_darah VARCHAR(3)  CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
    riwayat_penyakit TEXT,
    alergi        TEXT,
    surat_sehat   BOOLEAN      NOT NULL DEFAULT FALSE,
    tanggal_cek   DATE
);

-- ---------------------------------------------------------------------
-- 6. registrasi  (RELASI 1:N dengan jalur)
--    Satu registrasi = satu rombongan pendakian.
--    ketua_id menunjuk pendaki yang bertanggung jawab atas rombongan.
-- ---------------------------------------------------------------------
CREATE TABLE registrasi (
    id             SERIAL PRIMARY KEY,
    kode_booking   VARCHAR(20) NOT NULL UNIQUE,
    jalur_id       INT         NOT NULL
                   REFERENCES jalur(id) ON DELETE RESTRICT,
    ketua_id       INT         NOT NULL
                   REFERENCES pendaki(id) ON DELETE RESTRICT,
    tanggal_naik   DATE        NOT NULL,
    tanggal_turun  DATE        NOT NULL,
    status         VARCHAR(12) NOT NULL DEFAULT 'menunggu'
                   CHECK (status IN ('menunggu', 'disetujui', 'mendaki', 'selesai', 'dibatalkan')),
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (tanggal_turun >= tanggal_naik)
);

-- ---------------------------------------------------------------------
-- 7. anggota_registrasi  (RELASI N:N antara pendaki dan registrasi)
--    Satu registrasi berisi banyak pendaki; satu pendaki bisa ikut
--    banyak registrasi (pendakian di waktu berbeda).
-- ---------------------------------------------------------------------
CREATE TABLE anggota_registrasi (
    registrasi_id INT NOT NULL
                  REFERENCES registrasi(id) ON DELETE CASCADE,
    pendaki_id    INT NOT NULL
                  REFERENCES pendaki(id) ON DELETE RESTRICT,
    peran         VARCHAR(10) NOT NULL DEFAULT 'anggota'
                  CHECK (peran IN ('ketua', 'anggota')),
    waktu_turun   TIMESTAMP,          -- NULL = belum turun
    PRIMARY KEY (registrasi_id, pendaki_id)
);

-- ---------------------------------------------------------------------
-- 8. pembayaran  (RELASI 1:1 dengan registrasi)
-- ---------------------------------------------------------------------
CREATE TABLE pembayaran (
    id            SERIAL PRIMARY KEY,
    registrasi_id INT           NOT NULL UNIQUE
                  REFERENCES registrasi(id) ON DELETE CASCADE,
    jumlah        NUMERIC(12,2) NOT NULL CHECK (jumlah >= 0),
    metode        VARCHAR(15)   NOT NULL
                  CHECK (metode IN ('tunai', 'transfer', 'qris')),
    status        VARCHAR(10)   NOT NULL DEFAULT 'belum'
                  CHECK (status IN ('belum', 'lunas', 'batal')),
    dibayar_pada  TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 9. log_pos  (RELASI N:N antara registrasi dan pos)
--    Mencatat rombongan yang melewati pos tertentu. Berguna untuk
--    memantau posisi pendaki dan evakuasi jika terjadi insiden.
-- ---------------------------------------------------------------------
CREATE TABLE log_pos (
    id            SERIAL PRIMARY KEY,
    registrasi_id INT       NOT NULL
                  REFERENCES registrasi(id) ON DELETE CASCADE,
    pos_id        INT       NOT NULL
                  REFERENCES pos(id) ON DELETE RESTRICT,
    waktu_lewat   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    jumlah_orang  INT       NOT NULL CHECK (jumlah_orang > 0),
    catatan       TEXT
);

-- ---------------------------------------------------------------------
-- Index tambahan untuk mempercepat query pada foreign key
-- ---------------------------------------------------------------------
CREATE INDEX idx_jalur_gunung        ON jalur(gunung_id);
CREATE INDEX idx_pos_jalur           ON pos(jalur_id);
CREATE INDEX idx_registrasi_jalur    ON registrasi(jalur_id);
CREATE INDEX idx_registrasi_tanggal  ON registrasi(tanggal_naik);
CREATE INDEX idx_anggota_pendaki     ON anggota_registrasi(pendaki_id);
CREATE INDEX idx_logpos_registrasi   ON log_pos(registrasi_id);

-- ---------------------------------------------------------------------
-- Data contoh (opsional, untuk menguji relasi)
-- ---------------------------------------------------------------------
INSERT INTO gunung (nama, lokasi, ketinggian, kuota_harian) VALUES
    ('Gunung Ungaran', 'Kab. Semarang, Jawa Tengah', 2050, 150),
    ('Gunung Merbabu', 'Jawa Tengah', 3145, 200);

INSERT INTO jalur (gunung_id, nama, panjang_km, estimasi_jam, tingkat_kesulitan) VALUES
    (1, 'Mawar',  6.50, 5.0, 'sedang'),
    (1, 'Promasan', 5.00, 4.0, 'mudah');

INSERT INTO pos (jalur_id, nama, urutan, ketinggian) VALUES
    (1, 'Basecamp Mawar', 0, 1100),
    (1, 'Pos 1',          1, 1350),
    (1, 'Pos 2',          2, 1600),
    (1, 'Puncak',         3, 2050);

INSERT INTO pendaki (nik, nama_lengkap, jenis_kelamin, tanggal_lahir, no_hp,
                     alamat, kontak_darurat_nama, kontak_darurat_hp) VALUES
    ('3322010101000001', 'Budi Santoso', 'L', '2000-01-01', '081234567890',
     'Ungaran', 'Slamet Santoso', '081200000001'),
    ('3322010202000002', 'Siti Aminah',  'P', '2001-02-02', '081298765432',
     'Semarang', 'Aminah Sr.', '081200000002');

INSERT INTO kesehatan_pendaki (pendaki_id, golongan_darah, riwayat_penyakit, alergi, surat_sehat, tanggal_cek) VALUES
    (1, 'O', NULL, NULL, TRUE, '2026-09-28'),
    (2, 'A', 'Asma ringan', 'Debu', TRUE, '2026-09-28');

INSERT INTO registrasi (kode_booking, jalur_id, ketua_id, tanggal_naik, tanggal_turun, status) VALUES
    ('REG-20261010-001', 1, 1, '2026-10-10', '2026-10-11', 'disetujui');

INSERT INTO anggota_registrasi (registrasi_id, pendaki_id, peran) VALUES
    (1, 1, 'ketua'),
    (1, 2, 'anggota');

INSERT INTO pembayaran (registrasi_id, jumlah, metode, status, dibayar_pada) VALUES
    (1, 50000, 'qris', 'lunas', CURRENT_TIMESTAMP);

INSERT INTO log_pos (registrasi_id, pos_id, jumlah_orang, catatan) VALUES
    (1, 1, 2, 'Check-in basecamp'),
    (1, 2, 2, 'Lewat Pos 1');
