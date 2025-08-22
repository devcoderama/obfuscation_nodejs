# obfus.js

## 🔒 JavaScript Obfuscator + Double AES Encryption + Multi-Encoder (No NATO) + Minify + Anti-Tamper

Script ini digunakan untuk **mengamankan file JavaScript** (`.js`) menjadi bentuk yang sangat sulit dibaca, di-decode, atau direverse-engineer. Hasilnya (_enc.js_) tetap bisa dijalankan (`node hasil_enc.js`) namun isi aslinya benar-benar tersembunyi dan ter-enkripsi kuat.

---

## ✨ Fitur Utama

- **Double AES-256 Encryption:** Dua lapis enkripsi AES-256-CBC (inner dan outer).
- **Multi-layer Encoding:** Payload, key, dan IV dibungkus dengan urutan acak _encoder_ (bin, hex, octal). Tidak memakai NATO.
- **Randomisasi Maksimal:** Urutan encoder, variabel, salt, IV, dan noise selalu diacak setiap build.
- **Minify & Obfuscate:** Loader hasil sangat sulit dibaca manusia.
- **Anti-Tamper Header:** Jika credit diubah, loader langsung berhenti.
- **Noise Komentar:** Banyak komentar acak di hasil _enc.js_ untuk mengacaukan reverse engineering.
- **Password Proteksi:** AES key hasil _derived_ dari password dan salt random.
- **CLI Friendly:** Mudah dijalankan lewat terminal.

---

## 🚀 Cara Menggunakan

### 1. Instalasi
Pastikan Node.js dan package `terser` sudah terinstall.

```sh
npm install terser
```

### 2. Build File Enkripsi

Misal kamu punya file `index.js`:

```sh
node obfus_no_nato.js index.js
```

- Hasil: `index_enc.js`
- Password default: `0x1bc6e7d2e025f57ff79917f5e72561327b751105`

Kamu juga bisa pakai password custom:
```sh
node obfus_no_nato.js index.js passwordRahasiaSaya
```

### 3. Jalankan Hasil Enkripsi

```sh
node index_enc.js
```

Output sama persis dengan script asli, tapi isinya sudah disembunyikan dan diamankan.

---

## ⚡ Penjelasan Mekanisme

1. **Payload** (isi asli) dienkripsi AES-256 dengan key hasil dari password+scrypt+salt random.
2. **Ciphertext, key, IV** dibungkus multi-encoder acak (bin, hex, octal) — urutan selalu berbeda setiap build.
3. Loader hasil juga di-encrypt ulang (AES-256) dan di-encode, lalu dimasukkan ke _enc.js_.
4. **Anti-tamper:** Jika credit diubah, loader tidak mau jalan.
5. Komentar/noise/whitespace diacak untuk anti-pattern analysis.
6. **Hasil build selalu berbeda-beda walau isi asli sama.**

---

## 🔒 Keamanan

- **Sulit di-reverse**: Tidak mudah di-decode tanpa password.
- **Password wajib kuat**: Jika password bocor, hasil bisa di-decode.
- **Salt, IV selalu random**: Tidak bisa brute-force.
- **Multi-encoder**: Menambah lapisan kebingungan bagi attacker.
- **Hasil build selalu unik!**

---

## 🛑 Catatan Penting

- **Hasil file _enc.js_ hanya bisa berubah-ubah SETIAP BUILD, bukan setiap dijalankan.** Payload tetap saat dijalankan.
- Jangan pernah bagikan password jika ingin hasil benar-benar aman.
- Untuk perlindungan maksimal, gunakan password berbeda di setiap build.

---

## 👨‍💻 Contoh

### 1. Build
```sh
node obfus_no_nato.js scriptku.js
# Output: scriptku_enc.js (isi sangat panjang dan tidak terbaca)
```

### 2. Run
```sh
node scriptku_enc.js
# Output sama persis seperti script aslinya
```

---

## 📑 License

MIT (atau sesuai kebutuhan Anda).

---

_Coded by @Zerobyte — Happy Obfuscating!_
