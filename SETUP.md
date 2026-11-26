# Panduan Supabase dan Vercel

## 1. Buat proyek Supabase

1. Buat proyek baru di [supabase.com](https://supabase.com/).
2. Buka **SQL Editor**, pilih **New query**, lalu salin seluruh isi `supabase/schema.sql`.
3. Jalankan query tersebut. Ini membuat tabel produk, admin, pesanan beserta alamat pengiriman, aturan akses, fungsi checkout, dan bucket foto produk.

## 2. Buat akun admin

1. Di Supabase, buka **Authentication → Users → Add user**.
2. Buat akun menggunakan email admin dan kata sandi yang kuat serta hanya dipakai admin. Jangan gunakan kata sandi yang dibagikan ke publik.
3. Salin UUID akun tersebut.
4. Di **SQL Editor**, jalankan query berikut setelah mengganti UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('GANTI-DENGAN-UUID-AKUN-ADMIN');
   ```

Admin masuk melalui `/admin.html`. Pendaftaran admin tidak dibuka dari situs; akun harus dibuat di Supabase dan UUID-nya didaftarkan di `admin_users`. Ini mencegah pengunjung toko membuat akun admin sendiri.

## 3. Jalankan lokal dengan API Vercel

Situs biasa yang dijalankan dengan `npm start` hanya menyajikan file statis. Untuk menguji endpoint konfigurasi Supabase secara lokal:

1. Pasang Vercel CLI jika belum ada:

   ```powershell
   npm install --global vercel
   ```
2. Dari folder proyek, jalankan `vercel login`, kemudian `vercel link`.
3. Dari **Project Settings → API** di Supabase, ambil **Project URL** dan **publishable key** (atau `anon` key lama). Di pengaturan proyek Vercel atau file `.env.local`, isi:

   ```text
   SUPABASE_URL=https://PROJECT-REF.supabase.co
   SUPABASE_ANON_KEY=KUNCI-PUBLISHABLE-ATAU-ANON
   WHATSAPP_NUMBER=6281386544921
   ```

   Nomor WhatsApp bersifat opsional karena aplikasi memiliki nomor toko bawaan. Jika mengubahnya, gunakan format internasional (`628...`) atau nomor lokal yang diawali `0`; format akan dinormalisasi otomatis.
4. Jalankan `vercel dev`, lalu buka URL lokal yang ditampilkan CLI.

`SUPABASE_ANON_KEY` adalah kunci publik untuk browser. Jangan pernah menaruh `service_role` atau secret key di situs maupun di variabel yang diawali `NEXT_PUBLIC_`.

Untuk reset kata sandi admin saat pengembangan lokal, buka **Authentication → URL Configuration → Redirect URLs** di Supabase dan tambahkan `http://127.0.0.1:3001/**`. Untuk produksi, tambahkan pola domain situs yang sebenarnya, misalnya `https://DOMAIN-ANDA/**`. Dari halaman admin, gunakan **Lupa kata sandi?** agar tautan kembali ke panel admin, bukan ke halaman toko.

## 4. Deploy ke Vercel

1. Di **Project Settings → Environment Variables**, isi variabel yang sama untuk Production (dan Preview jika diperlukan).
2. Deploy dengan salah satu cara:
   - **Vercel CLI:** dari folder proyek, jalankan `vercel` untuk deploy preview dan `vercel --prod` untuk production.
   - **GitHub:** push proyek ke repository, lalu impor repository itu melalui **Add New → Project** di Vercel.
3. Biarkan konfigurasi memakai `vercel.json` di proyek ini. Setelah environment variables diubah, lakukan redeploy agar nilai terbaru aktif.

## 5. Hubungkan domain

1. Di proyek Vercel, buka **Settings → Domains**, masukkan domain Anda, lalu pilih **Add**.
2. Ikuti nilai DNS yang ditampilkan Vercel pada pengelola domain (registrar) Anda. Jangan menyalin nilai DNS dari panduan lain karena nilainya dapat berbeda.
3. Tunggu verifikasi DNS dan status domain aktif di Vercel.

Jika belum memiliki domain sendiri, situs tetap dapat diakses melalui domain bawaan `.vercel.app`.

## 6. Tambahkan produk

1. Buka `https://DOMAIN-ANDA/admin.html` dan masuk dengan akun admin.
2. Isi nama, kategori, harga, deskripsi, foto, dan status produk.
3. Produk aktif otomatis tampil di halaman depan. Foto diunggah ke bucket `product-images`.
4. Pesanan yang dikirim dari keranjang tersimpan di Supabase dan dapat dilihat dari panel admin.
5. Ringkasan dashboard menampilkan jumlah pesanan, pesanan yang menunggu konfirmasi, dan produk aktif. Gunakan pencarian/filter untuk menemukan produk atau pesanan, ubah status pesanan dari daftar, dan tekan tombol muat ulang untuk mengambil data terbaru.

Kategori produk saat ini adalah **Satin**, **Money**, dan **Artificial Flowers**. Untuk proyek Supabase yang sudah ada, jalankan `supabase/migrations/20261126140800_add_payment_and_pickup.sql` melalui **SQL Editor** sebelum menerima pesanan baru. Migrasi ini juga memperbarui constraint kategori; produk lama tetap tersimpan. Buka Edit pada produk berkategori lama, pilih kategori baru, lalu simpan. Produk lama tetap terlihat di Semua buket sampai kategorinya diperbarui.

Checkout mendukung pengiriman atau ambil sendiri di **Jl. Melati, Desa Tembok Banjaran, RT 19/03, Kecamatan Adiwerna, Kabupaten Tegal, 52194**. Pembayaran QRIS menampilkan `Public/assets/images/qris.png` setelah pesanan disimpan; pelanggan mengisi nominal sesuai total lalu mengonfirmasi melalui WhatsApp. Tunai hanya tersedia untuk pesanan ambil sendiri. Konfirmasi pembayaran tetap dilakukan manual oleh admin.

Nomor `WHATSAPP_NUMBER` dipakai untuk tombol pesan cepat di kartu produk dan tautan tindak lanjut setelah pesanan tersimpan. Jika tidak diisi, aplikasi menggunakan nomor WhatsApp toko `6281386544921`. Nomor lokal yang diawali `0` otomatis diubah ke format internasional.
