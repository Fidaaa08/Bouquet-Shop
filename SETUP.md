# Panduan Supabase dan Vercel

## 1. Buat proyek Supabase

1. Buat proyek baru di [supabase.com](https://supabase.com/).
2. Buka **SQL Editor**, pilih **New query**, lalu salin seluruh isi `supabase/schema.sql`.
3. Jalankan query tersebut. Ini membuat tabel produk, admin, pesanan beserta alamat pengiriman, aturan akses, fungsi checkout, dan bucket foto produk.

## 2. Buat akun admin

1. Di Supabase, buka **Authentication → Users → Add user**.
2. Buat akun menggunakan email dan kata sandi yang hanya dipakai admin.
3. Salin UUID akun tersebut.
4. Di **SQL Editor**, jalankan query berikut setelah mengganti UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('GANTI-DENGAN-UUID-AKUN-ADMIN');
   ```

Admin masuk melalui `/admin.html`. Pendaftaran admin tidak dibuka dari situs.

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
   WHATSAPP_NUMBER=6281234567890
   ```

   Nomor WhatsApp bersifat opsional; gunakan format kode negara tanpa tanda `+`, spasi, atau tanda hubung.
4. Jalankan `vercel dev`, lalu buka URL lokal yang ditampilkan CLI.

`SUPABASE_ANON_KEY` adalah kunci publik untuk browser. Jangan pernah menaruh `service_role` atau secret key di situs maupun di variabel yang diawali `NEXT_PUBLIC_`.

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

Nomor `WHATSAPP_NUMBER` dipakai untuk tautan tindak lanjut setelah pesanan tersimpan. Pembayaran online belum termasuk.
