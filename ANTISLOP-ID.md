# Anti AI Slop: Design & Copy Rules

> Panduan ini wajib diikuti ketika menghasilkan atau membuat tampilan desain website, web app, atau antarmuka apapun.
> Tujuannya: desain terasa **dirancang oleh desainer**, bukan di-generate oleh AI.

---

## Apa Ini (dan Bukan Apa Ini)

`ANTISLOP.md` adalah **filter**, bukan style guide. Ia menghentikan AI coding agent untuk menghasilkan UI "AI slop" yang generik dan mudah dikenali, tanpa jatuh ke kegagalan kebalikannya: default yang steril dan tidak hidup.

- Dokumen ini **tidak** memaksakan aesthetic: tidak ada warna, font, layout, atau "house style" yang ditetapkan.
- Dokumen ini **tidak** melarang teknik visual (gradient, glassmorphism, badge, card grid). Itu semua alat. Yang ditolaknya adalah **teknik tanpa tujuan**.
- Dokumen ini hanya melakukan dua hal:
  1. Menahan setiap keputusan visual pada **uji tujuan**: teknik ini melayani apa? Tuliskan alasannya.
  2. Menahan hasil pada **standar hidup**: output harus hidup dan spesifik, bukan sekadar "bersih". Lihat Bagian 3.

`ANTISLOP.md` adalah satu dari tiga file, dan ia adalah **filter, bukan sumber arah**:

- `DESIGN.md` (atau arah brand/style kamu) memberikan desain **jiwa**: identitas, personality, palette, typography, mood. Inilah yang membuat hasil terasa hidup dan spesifik. Cara mengisinya urusan kamu: tulis sendiri, atau bangun dari referensi visual yang kamu suka.
- `AGENTS.md` (atau `CLAUDE.md`, `GEMINI.md`, dsb.) menjadi router: "untuk pekerjaan UI, baca `DESIGN.md` untuk arah, lalu `ANTISLOP.md` sebagai filter."
- `ANTISLOP.md` menolak slop dan menuntut liveliness. Ia tidak menciptakan arah; Pembacaan Desain (Bagian 3) mengubah brief menjadi dial.

Menghapus slop tidak memperlihatkan desain yang bagus; ia menyisakan kekosongan. Liveliness harus **ditambahkan**, bukan diasumsikan. Hasil yang steril berarti arahnya hilang atau liveliness tidak ditambahkan, dan keduanya adalah kegagalan yang harus diperbaiki. Perbaikannya bukan "tambah larangan"; melainkan "nyatakan tujuan dan naikkan standar hidup".

## Prinsip Utama

Filter menolak teknik tanpa tujuan, bukan teknik itu sendiri. Sebelum memakai teknik visual apa pun, jawab: **ini melayani apa?** Jika satu-satunya jawaban adalah "terlihat seperti AI" atau "terlihat aman", teknik tersebut harus dibuang atau dirombak. Jika jawabannya menyebut tujuan hierarchy, identitas, atau keterbacaan, teknik itu tetap dipakai, dan alasannya dituliskan.

Pertanyaan yang harus selalu dijawab sebelum menyatakan selesai:

> Jika logo dan nama produk diganti, apakah desain ini masih terasa unik dan memiliki karakter?

Jika jawabannya **tidak**, berarti desain terlalu generik. Ulangi.

Suatu desain **selesai** hanya ketika ketiganya benar:
1. Setiap teknik lolos uji tujuan (lihat grup Purpose-Gate di Bagian 2).
2. Memiliki identitas dan karakter sendiri (lihat Bagian 3: Liveliness Toolkit).
3. Benar-benar berfungsi (lihat Standar Craftsmanship).

## Standar Craftsmanship

"Bukan slop" adalah batas bawah, bukan tujuan. Sebuah desain lulus ketika memenuhi lima kriteria yang netral terhadap selera. Gunakan ini sebagai pertanyaan, bukan resep.

### C-1 — Intentionalitas

Setiap keputusan visual dan copy punya alasan yang bisa kamu jelaskan. Jika satu-satunya alasan adalah "itu default AI", itu red flag: tinjau ulang keputusan tersebut.

### C-2 — Kelengkapan Fungsional

Setiap elemen interaktif berfungsi, atau tidak ada. Tombol yang tidak bisa melakukan apa pun adalah cacat, bukan dekorasi.

### C-3 — Komposisi Berbasis Konten

Setiap section ada karena konten produk membutuhkannya, bukan karena semua landing page AI memilikinya. Hapus section yang hanya mengisi template.

### C-4 — Ketahanan

UI tetap kokoh di setiap state (kosong, memuat, error), setiap tema yang kamu kirim, setiap breakpoint, dan penggunaan hanya dengan keyboard.

### C-5 — Bukti di Atas Klaim

Apa pun yang disajikan sebagai fakta (testimonial, statistik, klaim keamanan) harus nyata dan bisa diverifikasi, atau tidak ditampilkan sama sekali.

---

## Bagian 1: Ciri-Ciri AI Slop (Tanda Peringatan)

Ini adalah pola-pola yang paling sering ditemukan pada desain hasil AI. Gunakan tabel ini untuk **mengaudit** output kamu: pindai kemunculan berkelompok, lalu tanya setiap pola "ini melayani apa?" Satu pola dari daftar ini tidak masalah jika ia melayani tujuan, kecuali pola yang dilarang rule **Hard Gate** di Bagian 2 (R-02, R-17, R-18, R-23 s.d. R-28, R-32 s.d. R-38). Yang membuat desain menjadi slop adalah banyaknya pola ini muncul bersamaan tanpa alasan. Ini adalah **pemindaian diagnostik, bukan daftar larangan**: Bagian 1 sendiri tidak melarang apa pun, tetapi rule Hard Gate di Bagian 2 bersifat mutlak, dan semua pola lain harus melewati uji tujuan (Bagian 2, grup Purpose-Gate).

### Visual & Warna

| Pola | Ciri Khas |
|------|-----------|
| **Gradient Biru-Ungu Generik** | Biru ke Ungu, Biru ke Cyan, Ungu ke Pink, background penuh glow berwarna |
| **Glassmorphism Berlebihan** | Blur di navbar, card, modal, sidebar semuanya |
| **Border Radius Berlebihan** | Semua elemen berbentuk pil: button, input, card, badge, modal |
| **Shadow Terlalu Lembut** | Semua komponen punya shadow besar, seluruh halaman terasa melayang |
| **Glow Dimana-Mana** | Glow pada card, tombol, icon, badge, background, border secara bersamaan |
| **Background Grid** | Kotak-kotak, blueprint, graph paper, garis tipis horizontal-vertikal |
| **Terlalu Banyak Dekorasi / Menumpuk Tren** | Blob, mesh gradient, glow, noise, pattern, grid tanpa fungsi, apalagi jika beberapa tren dipakai sekaligus (mis. Glassmorphism + Mesh Gradient + Glow + Monospace + Grid + Rounded UI) |
| **Dark Mode Default Tanpa Alasan** | Seluruh halaman gelap hanya karena terlihat "tech", tanpa pertimbangan branding |
| **Terlalu Banyak Warna dalam Palette** | Memakai 5-7 warna berbeda dalam satu halaman tanpa design system yang jelas |
| **Warna Aksen Berlebihan** | Satu warna aksen di tombol, icon, badge, link, garis, background, glow |
| **Sterile Default** | Putih/near-white polos, border abu tipis, radius kecil, tanpa tekstur, font generik, tanpa identitas. "Hasil aman" dari over-filter tanpa arah |
| **Skeleton Preview sebagai Screenshot Produk** | Bar placeholder abu-abu / blok skeleton dipakai sebagai "screenshot produk" di hero atau area fitur |

### Layout & Komponen

| Pola | Ciri Khas |
|------|-----------|
| **Layout Monoton** | Hero, Subtitle, 2 CTA, Screenshot, Grid Fitur, Testimonial, FAQ, CTA, Footer |
| **Feature Card Copy-Paste** | Ukuran, tinggi, icon, layout, padding semua sama persis |
| **Spacing Seragam** | Padding, margin, jarak antar elemen identik di semua section |
| **Mobile Berantakan** | Overflow horizontal, card keluar layar, navbar rusak, teks bertabrakan |
| **Animasi Template** | Semua elemen pakai Fade Up, Fade In, Floating, Scale, Bounce |
| **"How It Works" 3 Langkah** | Icon bulat + angka 1, 2, 3 + teks pendek, selalu tiga langkah, selalu sama |
| **"Trusted By" Logo Bar** | Deretan logo perusahaan generik langsung di bawah hero |
| **Pricing Card "Most Popular"** | Tier tengah selalu di-highlight dengan badge kapsul |
| **Footer 4 Kolom Template** | Kolom Product / Company / Resources / Legal tanpa variasi |
| **Irama Section Seragam** | Setiap section memakai komposisi yang sama: judul center + subtitle + grid kartu identik, tanpa variasi antar section |
| **Variasi Cuma Ganti Background** | Satu-satunya variasi antar section cuma flip warna background tiap section bergantian |

### Copywriting & Konten

| Pola | Ciri Khas |
|------|-----------|
| **Em Dash (—)** | "Fast, secure — and built for developers." |
| **CTA Generik** | Get Started, Learn More, Try Now, Explore, Discover |
| **Buzzword Marketing AI** | AI Powered, Revolutionary, Next Generation, Seamless, Cutting Edge |
| **Statistik Palsu** | 10K+ Users, 99.9% Uptime, 500M Requests, 120+ Countries |
| **Testimonial Palsu** | Avatar AI, nama acak, jabatan acak, review fiktif |
| **Klaim Kepercayaan Karangan** | "SOC 2 compliant", "ISO 27001", "Enterprise-grade security", "300% faster" untuk produk yang tidak punya bukti apa pun |

### Elemen Dekoratif

| Pola | Ciri Khas |
|------|-----------|
| **Ikon AI Generik** | Sparkle, Star, Magic, Lightning, Diamond, Cube, Robot, Orb AI |
| **Arrow Kecil (→ / ↗)** | Dipasang di hampir semua tombol sebagai dekorasi |
| **Badge Kapsul AI** | Bentuk pil, border tipis, glow, titik kecil, uppercase, berisi: "AI Powered", "Beta", "New" |
| **Typography AI Generik** | Heading monospace besar, label HOW IT WORKS uppercase tracking lebar |
| **Typeface Dipilih Tanpa Alasan** | Memilih font karena default AI, bukan karena sesuai karakter brand. Font populer seperti Inter tetap valid jika ada alasannya |
| **Ilustrasi Generik** | Ilustrasi Undraw, Storyset, atau karakter blob 3D tanpa hubungan nyata dengan produk |

### Fungsionalitas & Konten

| Pola | Ciri Khas |
|------|-----------|
| **Elemen Interaktif Tidak Berfungsi** | Tombol tidak melakukan apa pun, dropdown tidak terbuka, form tidak bisa disubmit. AI bikin tampilan tapi lupa bikin fungsinya |
| **Desain Hanya untuk Happy Path** | Tidak ada empty state, loading state, atau error state. UI terlihat sempurna di screenshot tapi tidak siap dipakai nyata |
| **FAQ Tidak Relevan** | Pertanyaan FAQ berisi template generik ("Is my data secure?", "Can I cancel anytime?") tanpa relevansi nyata dengan produk |
| **Logo & Foto Profil Asal Bikin** | Membuat logo aplikasi, avatar, atau foto profil tanpa instruksi eksplisit, asal generate berdasarkan asumsi |
| **Navbar Link Tanpa Konten** | Navbar berisi link ke halaman (Features, Contact, About, dll.) yang tidak ada section atau halamannya sama sekali |
| **Patching File/CSS via Script** | Fitur (mis. dark mode) ditambahkan oleh script eksternal yang menulis ulang source atau CSS dengan string replacement. Tanda: helper `.py`/`.js` yang melakukan `str.replace` pada file `.css`, script "patch" yang tertinggal di repo |

### Identitas & Orisinalitas

| Pola | Ciri Khas |
|------|-----------|
| **Tanpa Identitas Visual** | Ganti logo, desain tetap terasa sama, bisa dipakai produk apa pun |
| **Clone Produk Populer** | Tampilan yang secara keseluruhan meniru Linear, Vercel, Stripe, Notion, atau produk populer lain tanpa diminta |

### Aksesibilitas

| Pola | Ciri Khas |
|------|-----------|
| **Color Contrast Buruk** | Teks abu-abu di background abu-abu, teks putih di gradient yang terang di sebagian area. Terlihat oke secara visual tapi gagal WCAG |
| **Tidak Bisa Dinavigasi Keyboard** | UI hanya bisa dipakai dengan mouse. Elemen interaktif tidak bisa dijangkau dengan Tab, tidak ada focus state yang terlihat |

---

## Bagian 2: Rules Wajib (R-01 s.d. R-38, dikelompokkan)

Semua 38 rules tetap berlaku. Rules dikelompokkan ke dalam tiga tingkat agar mekanismenya eksplisit: rules **Hard Gate** bersifat mutlak, rules **Purpose-Gate** mengizinkan teknik tetapi menuntut alasan tertulis, dan **Quality Locks** adalah persyaratan konsistensi.

### Group 1: Hard Gate (mutlak, tanpa pengecualian)

Rules ini melindungi kejujuran, fungsi, dan aksesibilitas. Melanggar salah satu dari mereka adalah FAIL apa pun tujuannya.

#### R-02 — Copywriting

- **DILARANG**: karakter em dash (`—`) dalam teks apapun
- Gunakan koma (`,`), titik (`.`), titik dua (`:`), atau tanda kurung `()` sebagai gantinya
- Teks harus terasa natural dan manusiawi

#### R-03 — Responsivitas Mobile

- **WAJIB**: tampilan mobile harus sempurna, bukan afterthought
- Tidak ada overflow horizontal
- Teks tidak keluar container
- Card tidak bertabrakan atau keluar layar
- Navbar tetap nyaman digunakan
- Ukuran tombol memenuhi minimum tap target (44px)
- Spacing tetap konsisten di semua breakpoint
- **Responsive adalah bagian dari desain, bukan tambahan.**

#### R-17 — Data & Angka

- **DILARANG**: angka dan statistik yang tidak memiliki sumber nyata
- Jika data asli tidak tersedia, jangan tampilkan angka apapun
- Lebih baik kosong daripada menipu

#### R-18 — Testimonial

- **DILARANG**: avatar AI, nama acak, jabatan acak, review fiktif
- Jika tidak memiliki testimonial asli, jangan buat section testimonial
- Gunakan social proof yang bisa diverifikasi

#### R-23 — Klarifikasi & Aset Visual

- **WAJIB**: sebelum membuat aset yang tidak ada instruksinya, tanya atau gunakan placeholder yang jelas
- Jika ada kesempatan bertanya, konfirmasi dulu hal-hal berikut:
  - Logo atau ikon aplikasi (bentuk, warna, konsep)
  - Avatar, foto profil, atau gambar representasi orang/tim
  - Statistik dan angka yang akan ditampilkan
  - Nama, jabatan, atau identitas dalam testimonial
  - Navigasi dan struktur halaman yang diinginkan
- Jika tidak bisa bertanya (prototyping cepat, konteks terbatas): gunakan placeholder yang jelas dan jangan samarkan sebagai final
  - Logo: teks nama produk dalam typeface sesuai, atau tanda `[LOGO]`
  - Foto profil: initial-based avatar atau placeholder geometris sederhana
  - Statistik: tidak ditampilkan, atau ditandai `[REAL DATA]`
- **Jangan pernah generate aset seolah-olah itu adalah versi final tanpa konfirmasi**
- Jika sudah ada instruksi yang jelas, langsung generate tanpa tanya ulang

#### R-24 — Navigasi

- **DILARANG**: menaruh link di navbar untuk halaman atau section yang tidak ada dalam desain
- Setiap item navigasi harus memiliki destination yang nyata dan bisa diakses
- Jika ada fitur yang belum dibuat, jangan masukkan ke navbar, atau beri keterangan jelas bahwa itu coming soon
- Navbar harus mencerminkan struktur konten yang benar-benar ada

#### R-25 — Color Contrast

- **WAJIB**: semua teks harus memenuhi standar kontras minimum WCAG AA
  - Teks normal: rasio kontras minimal 4.5:1
  - Teks besar (18px+): rasio kontras minimal 3:1
- **DILARANG**: teks abu-abu muda di background abu-abu
- **DILARANG**: teks putih di area gradient yang sebagian bagiannya terang
- Selalu uji kontras di seluruh area yang dilewati teks, bukan hanya di satu titik

#### R-26 — Elemen Interaktif

Setiap elemen interaktif harus memiliki perilaku nyata, atau dihapus:

- Link atau tombol yang scroll ke section yang benar-benar ada (real `href="#..."`)
- Modal atau dialog yang terbuka dan tertutup (bisa ditutup dengan Escape)
- State toggle (menu mobile, tema, accordion, tabs)
- Aksi eksternal (`mailto:`, URL produk yang nyata)
- Form yang submit dan menampilkan feedback

**DILARANG**: tombol dan link yang tidak melakukan apa pun
**DILARANG**: item nav yang mengarah ke section yang tidak ada (lihat R-24)

Jika sebuah elemen benar-benar belum punya destination, hapus elemen tersebut daripada mengirim kontrol mati. Placeholder hanya diperbolehkan dengan komentar `// TODO` yang jelas di kode DAN label yang terlihat oleh user (mis. "Coming soon"). Lihat "Pola Fungsional" di bawah.

#### R-27 — UI States

- **WAJIB**: setiap UI yang menampilkan data harus memiliki setidaknya tiga state:
  - **Empty state**: tampilan ketika belum ada data
  - **Loading state**: indikator saat data sedang dimuat
  - **Error state**: tampilan ketika terjadi kesalahan
- UI yang hanya didesain untuk kondisi ideal tidak siap dipakai nyata
- State ini bukan bonus, ini bagian dari desain yang lengkap

#### R-28 — FAQ

- **DILARANG**: FAQ berisi pertanyaan template yang tidak spesifik terhadap produk
- Setiap pertanyaan dalam FAQ harus menjawab kekhawatiran nyata pengguna produk tersebut
- Jika tidak tahu pertanyaan nyata yang sering diajukan, jangan buat section FAQ
- FAQ yang generik lebih merusak kepercayaan daripada tidak ada FAQ sama sekali

#### R-32 — Aksesibilitas Keyboard

- **WAJIB**: semua elemen interaktif harus bisa dijangkau dan dioperasikan dengan keyboard
  - Navigasi dengan `Tab` dan `Shift+Tab` harus bekerja secara logis mengikuti urutan visual
  - Tombol dan link harus bisa diaktifkan dengan `Enter` atau `Space`
  - Dialog dan modal harus bisa ditutup dengan `Escape`
- **WAJIB**: setiap elemen yang sedang difokus harus memiliki focus indicator yang terlihat jelas
- **DILARANG**: menghilangkan outline focus dengan `outline: none` atau `outline: 0` tanpa menggantinya dengan indikator fokus custom yang lebih baik
- UI yang hanya bisa dipakai dengan mouse adalah UI yang belum selesai

#### R-33 — Dilarang Patching File/CSS via Script

- **DILARANG**: mengimplementasikan atau mengubah fitur UI dengan menjalankan script eksternal yang menulis ulang source file atau CSS dengan string replacement
- Bangun fitur langsung di source code tempatnya berada
- Fitur yang ditambahkan oleh patch script (mis. script Python yang mengedit file `.css`) rusak sejak awal dan harus ditulis ulang di source

#### R-34 — Setiap Tema yang Dikirim Harus Berfungsi

- Jika kamu mengirim theme toggle, KEDUA mode harus berfungsi penuh
- Kontras, warna, dan setiap komponen harus diverifikasi di masing-masing mode
- **DILARANG**: mengirim mode di mana base styles, font, atau layout rusak

#### R-35 — Verifikasi Sebelum Menyerahkan

- Jalankan atau build app sebelum menyatakan tugas selesai
- Cek console untuk error
- Uji setiap elemen interaktif
- Cek setiap tema dan breakpoint mobile
- Desain yang tidak pernah dijalankan adalah desain yang belum selesai

#### R-36 — Dilarang Klaim Karangan

- **DILARANG**: mengarang klaim keamanan, kepatuhan, atau performa ("SOC 2 compliant", "ISO 27001", "300% faster") tanpa bukti nyata
- **DILARANG**: testimonial palsu, statistik palsu, nama palsu (lihat R-17, R-18)
- Jika tidak ada data nyata, jangan tampilkan klaim apa pun

#### R-37 — Arah Desain Wajib Ada

- Sebelum membangun UI, muat arah style: `DESIGN.md` atau arahan brand eksplisit dari user
- Jika tidak ada arah, tanya user, atau nyatakan jelas bahwa desain dibuat **tanpa arah** dan hasilnya adalah **draf**, bukan deliverable
- Jika tidak ada arah DAN user tidak bisa ditanya, output WAJIB diberi label *"draf tanpa arah"* DAN memakai dial default yang jujur **ENERGI 1 / RITME 1 / GERAK 1** (lihat Bagian 3). Jangan pernah diam-diam jatuh ke default yang netral dan steril
- **DILARANG**: mendesain tanpa arah lalu diam-diam jatuh ke default yang netral dan steril
- Arah style adalah identitas milik pemilik produk, bukan pola slop; filter ini hanya bekerja di atasnya
- Desain yang dibangun tanpa arah adalah draf, bukan hasil yang layak dikirim

#### R-38 — Konten Nyata atau Placeholder Jujur

- Setiap klaim, fitur, testimoni, statistik, item nav, atau elemen visual harus berasal dari informasi nyata ATAU placeholder yang diberi label eksplisit
- **DILARANG**: mengarang konten yang terlihat realistis (testimoni palsu, fitur karangan, statistik palsu, link hantu, orang/tim fiktif)
- Placeholder ditulis sebagai apa adanya: `[REAL DATA]`, "Coming soon", tidak pernah disamarkan sebagai final (lihat R-23)
- Section kosong lebih baik daripada section yang dikarang

### Group 2: Purpose-Gate (teknik boleh, tujuan wajib)

Setiap teknik di bawah ini diperbolehkan. Ia FAIL hanya ketika muncul sebagai default tanpa tujuan yang dinyatakan, atau ketika alasannya tidak dituliskan. Setiap rule punya bentuk yang sama: DILARANG sebagai default tanpa tujuan; DIPERBOLEHKAN ketika ia melayani hierarchy/identitas dan alasannya ditulis; batas dosis untuk kasus yang berlebihan.

#### R-01 — Warna & Gradien

- **DILARANG sebagai default tanpa tujuan**: gradient biru ke ungu, biru ke cyan, ungu ke pink sebagai warna utama, background glow berwarna, tombol biru neon
- **DIPERBOLEHKAN** ketika warna/gradient adalah bagian dari identitas brand yang sudah mapan ATAU melayani tujuan hierarchy yang dinyatakan, dengan alasannya ditulis
- Gradient yang memisahkan satu level hierarchy dari level lain adalah craft; gradient yang sama menutupi seluruh halaman adalah slop. Tekniknya bukan masalah, tujuannya yang menentukan

#### R-04 — Ikon

- **DILARANG sebagai default tanpa tujuan**: Sparkle, Star, Magic, Lightning, Diamond, Orb, Robot sebagai ikon fitur
- Ikon harus **benar-benar relevan** dengan isi konten yang diwakilinya, dan relevansinya ditulis ketika ikon tersebut adalah glyph generik
- Jika tidak ada ikon yang tepat, lebih baik tidak pakai ikon

#### R-06 — Typography

- **DILARANG sebagai default tanpa tujuan**: font monospace besar hanya untuk estetika "terminal", label uppercase dengan letter-spacing ekstrem (`HOW IT WORKS`, `FEATURES`)
- Pilih typeface berdasarkan karakter brand, bukan karena merupakan pilihan default model AI, dan tulis alasannya
- Typography harus **meningkatkan keterbacaan** dan mencerminkan karakter produk

#### R-07 — Background

- **DILARANG sebagai default tanpa tujuan**: grid kotak-kotak, blueprint, graph paper sebagai background
- Gunakan texture atau pola hanya jika memang mendukung identitas visual produk secara spesifik, dengan alasannya ditulis

#### R-08 — Arrow pada Tombol

- Arrow (`→`, `↗`) bukan identitas default semua tombol
- Jika dipakai, pastikan ukurannya proporsional dan memiliki fungsi visual yang jelas, dan tulis tujuan tersebut
- Tidak semua CTA perlu arrow

#### R-09 — Badge

- **DILARANG sebagai default tanpa tujuan**: badge kapsul berisi "AI Powered", "Beta", "New", "Secure", "Fast" tanpa konteks
- Badge hanya boleh dipakai jika **dibutuhkan secara fungsional** (status nyata atau label nyata), dengan kebutuhan tersebut ditulis
- Hindari kombinasi: kapsul + border tipis + glow + titik kecil + uppercase sekaligus

#### R-10 — Glassmorphism

- Glassmorphism hanya sebagai **aksen**, bukan karakter seluruh UI
- **Batas dosis**: blur/backdrop-filter pada maksimal 1-2 elemen; **DILARANG** di navbar, card, modal, dan sidebar secara bersamaan

#### R-12 — Shadow

- Shadow harus membantu **hierarchy visual**, bukan membuat semua elemen melayang
- Gunakan shadow secara selektif sebagai penanda elevation, bukan sebagai default semua komponen, dan tulis alasan elevation tersebut

#### R-13 — Glow

- Glow hanya boleh digunakan sebagai **aksen fokus** pada maksimal 1-2 elemen penting
- **Batas dosis**: **DILARANG** pada card + button + badge + icon + background + border secara bersamaan

#### R-14 — Feature Card

- **DILARANG sebagai default tanpa tujuan**: semua card dengan ukuran, ikon, padding, dan layout yang identik
- Buat variasi visual yang mencerminkan hierarchy konten, dan tulis alasan hierarchy tersebut
- Tidak semua fitur perlu dipresentasikan dengan card

#### R-19 — Animasi

- Animasi harus memiliki **tujuan UX yang jelas**, dan tujuan tersebut ditulis
- **DILARANG sebagai default tanpa tujuan**: semua elemen menggunakan Fade Up + Floating + Scale + Bounce sekaligus
- Gerakan harus cocok dengan dial GERAK yang dinyatakan (Bagian 3): halaman yang diklaim "cinematic" harus benar-benar bergerak; halaman yang diklaim "statis" tidak boleh
- Gunakan animasi untuk memandu perhatian, bukan sekadar mengisi halaman

#### R-22 — Ilustrasi

- **DILARANG sebagai default tanpa tujuan**: ilustrasi Undraw, Storyset, atau karakter blob 3D generik
- Ilustrasi harus memiliki hubungan langsung dengan produk atau konten yang disajikan, dengan hubungan tersebut ditulis
- Jika tidak ada ilustrasi yang tepat dan original, gunakan screenshot nyata atau tidak pakai ilustrasi sama sekali

### Group 3: Quality Locks (konsistensi)

Ini adalah persyaratan konsistensi. Rules ini tetap seperti semula, dengan dua penyesuaian: R-05 kini mengacu pada dial RITME, dan R-31 dinaikkan menjadi rule kunci (keystone).

#### R-05 — Layout & Struktur Halaman

- **DILARANG**: layout template AI (Hero + 3 card, Hero + 6 feature, Hero + statistik palsu, dst.)
- **DILARANG**: "How It Works" selalu 3 langkah dengan icon bulat dan angka
- **DILARANG**: "Trusted By" logo bar generik langsung di bawah hero
- **DILARANG**: footer 4 kolom template Product / Company / Resources / Legal tanpa variasi
- **DILARANG**: setiap section memakai pola layout internal yang sama (judul center + subtitle + grid kartu identik); lihat "Irama Section Seragam". Variasi komposisi datang dari `DESIGN.md`, bukan dari template
- Setiap halaman harus memiliki struktur yang dibuat berdasarkan **kebutuhan konten nyata**
- Urutan section harus mengikuti alur narasi produk, bukan urutan default AI (lihat Standar Craftsmanship C-3)
- Komposisi section harus cocok dengan dial RITME yang dinyatakan (Bagian 3): jika RITME 3 (bervariasi), section harus terlihat bervariasi; jika RITME 1 (seragam), keseragaman adalah pilihan yang disengaja, bukan kecelakaan

#### R-11 — Border Radius

- Gunakan border radius yang **konsisten sesuai design system yang ditentukan**
- **DILARANG**: semua elemen dibuat pil (tombol pil, card pil, input pil, badge pil)
- Variasi radius adalah alat hierarchy visual, gunakan dengan sengaja

#### R-15 — CTA (Call to Action)

- **DILARANG**: "Get Started", "Learn More", "Try Now", "Explore", "Discover" sebagai CTA default
- CTA harus **spesifik sesuai konteks produk dan aksi yang diinginkan**
- Contoh yang lebih baik: "Coba 14 Hari Gratis", "Lihat Demo Langsung", "Buat Akun Gratis"

#### R-16 — Copywriting & Buzzword

- **DILARANG**: "AI Powered", "Next Generation", "Revolutionary", "Seamless", "Cutting Edge", "Intelligent", "Ultimate", "Powerful", "Effortless"
- Gunakan bahasa **spesifik** yang menjelaskan manfaat nyata
- Tunjukkan bukti, bukan klaim

#### R-20 — Identitas Visual

- Desain harus memiliki identitas yang kuat: palette spesifik, typeface yang dipilih dengan alasan, komposisi yang unik
- Setiap section harus memiliki hierarchy yang jelas
- Layout dibuat berdasarkan kebutuhan konten produk
- Identitas berasal dari pilihan yang disengaja dan dijelaskan, bukan dari menambah dekorasi (lihat Standar Craftsmanship C-1)

#### R-21 — Dark Mode

- Pilih tema berdasarkan identitas brand, jenis produk, dan target pengguna
- Developer tools, terminal, dan creative tools punya alasan kuat dan sah untuk dark default. Gunakan alasan itu, bukan "dark terlihat tech"
- Jika produk tidak punya alasan kuat untuk tema tetap, **bangun toggle light/dark yang berfungsi**. "Beri user pilihan" berarti bangun toggle-nya, bukan menunda pekerjaan
- **DILARANG**: menggunakan rule ini (atau rule apapun) sebagai alasan untuk melewati atau menunda pekerjaan yang diminta. Jika produk seharusnya mendukung dark mode, implementasikan sekarang
- Theme toggle yang kamu kirim harus bekerja benar di KEDUA mode. Dark mode yang merusak light mode adalah cacat (lihat R-34)

#### R-29 — Palette Warna

- **WAJIB**: batasi palette aktif maksimal 2-3 warna inti + 1 warna aksen
- **DILARANG**: menggunakan 5+ warna berbeda dalam satu halaman tanpa design system yang jelas
- Warna netral (white, black, grey) tidak dihitung sebagai bagian dari palette inti
- Konsistensi palette adalah fondasi identitas visual yang kuat

#### R-30 — Jangan Meniru Produk Populer

- **DILARANG**: membuat tampilan yang secara keseluruhan meniru produk lain tanpa diminta
  - "Buat tampilan seperti Linear" (kecuali user memang memintanya)
  - "Buat tampilan seperti Vercel" (kecuali user memang memintanya)
  - "Buat tampilan seperti Stripe / Notion / Apple" (kecuali user memang memintanya)
- AI cenderung default ke clone produk populer karena pola tersebut mendominasi data training
- Referensi visual boleh dipakai sebagai inspirasi, bukan sebagai template yang disalin
- Produk harus memiliki identitas visualnya sendiri, bukan identitas produk lain

#### R-31 — Setiap Keputusan Harus Memiliki Alasan (Tuliskan)

Sebelum menyelesaikan desain, tulis **alasan satu baris** untuk setiap keputusan utama:
- Mengapa warna ini?
- Mengapa layout ini?
- Mengapa typography ini?
- Mengapa spacing ini?
- Mengapa menggunakan card?
- Mengapa memakai ilustrasi atau ikon ini?

Jika alasan tidak bisa ditulis dalam satu baris, keputusan tersebut tidak valid dan harus ditinjau ulang. Rule ini adalah kunci (keystone) dari dokumen ini: sebuah teknik hanya diperbolehkan ketika tujuannya bisa diartikulasikan. Menuliskan alasan memaksa niat, dan itulah yang dicek oleh grup Purpose-Gate (Group 2).

---

## Bagian 3: Liveliness Toolkit

Filter bisa menghapus slop, tetapi tidak bisa menambah energi. Menghapus slop menyisakan kekosongan, dan model mengisi kekosongan itu dengan output paling generiknya. Liveliness harus **ditambahkan** dengan sengaja. Bagian ini adalah mekanismenya: persyaratan positif, bukan larangan.

### Tiga Dial (wajib)

Setiap desain harus menetapkan tiga dial secara eksplisit, diturunkan dari `DESIGN.md` atau Pembacaan Desain, dan mempertahankannya dari section pertama sampai terakhir:

| Dial | 1 (Tenang) | 2 (Seimbang) | 3 (Berani) | Yang dijawabnya |
|---|---|---|---|---|
| **ENERGI** | Linear, GOV.UK | Stripe, Vercel | Awwwards, portfolio agency | Seberapa keras desain ini menyapa? |
| **RITME** | Grid seragam, bisa diprediksi | Konsisten dengan sedikit jeda | Asimetris, komposisi campuran | Seberapa besar section berbeda satu sama lain? |
| **GERAK** | Hanya hover state | Scroll-reveal, transisi | Parallax, pin, koreografi | Seberapa banyak gerakan, dan mengapa? |

Anchor (Linear, GOV.UK, Stripe, Vercel, Awwwards) adalah referensi selera untuk menilai suatu nilai, bukan hal untuk ditiru.

Mengapa tiga level dan bukan sepuluh: model dan reviewer bisa dengan andal membedakan "apakah section ini seragam atau bervariasi?" (biner, bisa dicek). Mereka tidak bisa dengan andal menilai "apakah ini 6 atau 7?" (kontinu, tidak bisa dicek). Tiga level membuat liveliness bisa ditegakkan.

Contoh set: portfolio desainer menetapkan ENERGI 3, RITME 3, GERAK 2. Situs layanan publik menetapkan ENERGI 1, RITME 1, GERAK 1.

### Tuas (bagaimana dial menjadi keputusan visual)

Ini adalah alat untuk mencapai nilai dial, bukan larangan:

- **Satu titik fokus per layar**: tepat satu elemen yang jelas paling penting di setiap layar; sisanya tunduk padanya
- **Kontras hierarkis**: ukuran, ketebalan, dan warna dibedakan dengan sengaja, bukan acak
- **Whitespace sebagai struktur**: ruang kosong memisahkan dan membangun ritme, bukan ruang sisa
- **Satu aksen yang disengaja**: satu warna atau gerakan yang dipakai hemat di momen kunci. Nol aksen itu steril; aksen di mana-mana itu slop
- **Motif identitas**: satu pola, gerakan, atau suara tipografis yang spesifik dan diulang, membuat desain "menjadi milik" produk

### Pembacaan Desain (bagaimana dial ditetapkan)

Sebelum generate, nyatakan satu baris:

> Membaca ini sebagai: `<jenis halaman>` untuk `<audiens>`, dengan gaya `<bahasa visual>`, dial `<ENERGI/RITME/GERAK>`.

Contoh: *"Membaca ini sebagai: landing B2B SaaS untuk pembeli teknis, dengan bahasa minimalis bergaya Linear, dial ENERGI 1 / RITME 2 / GERAK 1."*

1. **Arah ada** (`DESIGN.md` atau brief yang mengekspresikan energi dan mood): simpulkan dial dari situ dan lanjutkan. `DESIGN.md` boleh memuat baris seperti `Dial: ENERGI 2 / RITME 3 / GERAK 1`; jika ada, gunakan langsung.
2. **Arah ambigu**: tanyakan tepat SATU pertanyaan yang menentukan, jangan pernah menumpuk pertanyaan. Contoh: *"Haruskah ini terasa lebih dekat ke Linear-clean atau Awwwards-experimental?"* Gunakan jawabannya untuk menetapkan dial.
3. **Tidak ada arah dan user tidak bisa ditanya**: beri label output *"draf tanpa arah"*, pakai dial default yang jujur **ENERGI 1 / RITME 1 / GERAK 1** (lihat R-37), dan jangan menyajikannya sebagai deliverable.

## Pola Fungsional

"Apa yang dimaksud berfungsi" berarti salah satu dari ini, tergantung konteks:

- **Anchor ke section yang nyata**: `href="#pricing"` di mana `#pricing` benar-benar ada
- **Scroll ke konten yang relevan** untuk link gaya "Learn more"
- **Buka modal atau dialog** untuk aksi cepat (bisa ditutup dengan Escape)
- **Toggle state**: menu mobile, tema, accordion, tabs
- **Aksi eksternal**: `mailto:`, URL produk yang nyata
- **Submit form** dengan feedback yang terlihat

Jika tidak ada satu pun yang berlaku untuk sebuah elemen, elemen itu seharusnya tidak ada.

---

## Delivery Gate (Wajib)

Jalankan gate ini SEBELUM menyerahkan. Sertakan statusnya bersama hasil kirimanmu sebagai **laporan PASS/FAIL**: satu baris per item, dan setiap `PASS` didukung bukti konkret (mis. "R-26 PASS: semua tombol punya `href`/`onClick` nyata; tidak ada kontrol mati").
Jika ada item **FAIL** (atau jawaban **ya**), jangan serahkan: perbaiki dulu, lalu jalankan ulang. Laporan yang mengandung FAIL tidak boleh dikirim.

Gate memiliki empat blok: Hard Gate (mutlak), Purpose-Gate (teknik + alasan tertulis), Liveliness (dial + tuas), Craftsmanship & Quality Locks (C-1..C-5 plus lock konsistensi R-05, R-11, R-15, R-16, R-20, R-21, R-29, R-30, R-31).

### Blok 1: Hard Gate

Sebelum menyatakan desain selesai, jawab semua pertanyaan di bawah ini. Semua jawaban harus **tidak**:

- [ ] Apakah ada em dash (`—`) di mana pun dalam teks, di luar contoh R-02 yang diizinkan? *(R-02)*
- [ ] Apakah ada overflow horizontal, teks keluar container, atau layout rusak di mobile? *(R-03)*
- [ ] Apakah ada statistik tanpa sumber nyata (10K+ Users, 99.9% Uptime, dll.)? *(R-17)*
- [ ] Apakah ada testimonial fiktif (avatar AI, nama atau jabatan acak)? *(R-18)*
- [ ] Apakah ada aset visual (logo, avatar/foto profil, statistik, testimonial, atau struktur navigasi) yang dibuat tanpa instruksi eksplisit atau konfirmasi, atau tanpa placeholder yang jujur? *(R-23)*
- [ ] Apakah ada navbar link yang mengarah ke section atau halaman yang tidak ada? *(R-24)*
- [ ] Apakah ada teks dengan kontras di bawah standar WCAG AA (4.5:1 untuk teks normal, 3:1 untuk teks besar)? *(R-25)*
- [ ] Apakah ada tombol, dropdown, atau form yang tidak melakukan apa pun, tanpa perilaku nyata dan tanpa `// TODO` + label yang terlihat? *(R-26)*
- [ ] Apakah UI tidak punya empty state, loading state, atau error state? *(R-27)*
- [ ] Apakah FAQ berisi pertanyaan generik yang tidak relevan dengan produk? *(R-28)*
- [ ] Apakah UI tidak bisa dinavigasi dengan keyboard (Tab, Enter, Escape) atau tidak ada focus state yang terlihat? *(R-32)*
- [ ] Apakah ada fitur yang ditambahkan dengan patching source/CSS via script eksternal, bukan ditulis langsung di source? *(R-33)*
- [ ] Jika ada theme toggle, apakah salah satu mode (light atau dark) merusak styles, font, atau layout? *(R-34)*
- [ ] Apakah app dijalankan/di-build dan setiap elemen interaktif diuji sebelum diserahkan? *(R-35)*
- [ ] Apakah ada klaim keamanan, kepatuhan, performa, atau pelanggan yang dikarang? *(R-36)*
- [ ] Apakah desain dibangun tanpa arah style, atau dibangun tanpa arah DAN tidak diberi label *"draf tanpa arah"* dengan dial default yang jujur ENERGI 1 / RITME 1 / GERAK 1? *(R-37)*
- [ ] Apakah ada konten bergaya realistis yang dikarang (testimoni, fitur, statistik, link hantu, tim fiktif) tanpa sumber nyata? *(R-38)*

### Blok 2: Purpose-Gate

Untuk setiap teknik, teknik itu sendiri diperbolehkan. FAIL jika ia muncul sebagai default tanpa tujuan, atau jika alasannya tidak ditulis:

- [ ] Apakah gradient/glow muncul sebagai default tanpa tujuan hierarchy atau brand yang dinyatakan? *(R-01)*
- [ ] Apakah ada ikon generik (sparkle, star, magic, lightning, diamond, robot, orb) atau ikon yang tidak relevan dengan kontennya, tanpa relevansi tertulis? *(R-04)*
- [ ] Apakah ada font monospace besar, label uppercase tracking lebar, atau typeface yang dipilih tanpa alasan karakter brand tertulis? *(R-06)*
- [ ] Apakah ada background grid, blueprint, atau graph paper tanpa tujuan identitas visual tertulis? *(R-07)*
- [ ] Apakah arrow (`→` / `↗`) dipasang di hampir semua tombol murni sebagai dekorasi, tanpa tujuan tertulis? *(R-08)*
- [ ] Apakah ada badge kapsul ("AI Powered", "Beta", "New", "Secure", "Fast") tanpa fungsi nyata, atau kombinasi lengkap kapsul + border tipis + glow + uppercase? *(R-09)*
- [ ] Apakah glassmorphism dipakai di lebih dari 1-2 elemen sekaligus (navbar + card + modal + sidebar)? *(R-10)*
- [ ] Apakah shadow besar dipakai di semua komponen, tanpa alasan elevation tertulis, sehingga halaman terasa melayang? *(R-12)*
- [ ] Apakah glow dipakai di card, button, badge, icon, background, dan border secara bersamaan? *(R-13)*
- [ ] Apakah semua feature card punya ukuran, ikon, padding, dan layout yang identik, tanpa alasan hierarchy tertulis? *(R-14)*
- [ ] Apakah semua elemen memakai animasi template yang sama sekaligus (Fade Up + Floating + Scale + Bounce) tanpa tujuan UX tertulis, atau gerakannya bertentangan dengan dial GERAK yang dinyatakan? *(R-19)*
- [ ] Apakah ada ilustrasi generik (Undraw, Storyset, blob 3D) tanpa hubungan produk tertulis? *(R-22)*

### Blok 3: Liveliness

Semua jawaban harus **ya**:

- [ ] Apakah dial ditetapkan dan eksplisit (ENERGI / RITME / GERAK dinyatakan)?
- [ ] Apakah output konsisten dengan dial yang diklaim? (RITME 3 tapi section seragam = FAIL)
- [ ] Apakah ada setidaknya satu titik fokus yang jelas per layar?
- [ ] Apakah whitespace bersifat struktural (dipakai untuk memisahkan dan membangun ritme), bukan ruang sisa?
- [ ] Apakah ada satu aksen yang disengaja (bukan nol, bukan di mana-mana)?
- [ ] Apakah ada motif identitas (satu pola, gerakan, atau suara tipografis yang spesifik dan diulang)?
- [ ] Apakah Pembacaan Desain dinyatakan sebelum generate?

### Blok 4: Craftsmanship & Quality Locks

Semua jawaban harus **tidak**:

- [ ] C-1: Apakah ada keputusan visual atau copy yang satu-satunya pembenarannya adalah "itu default AI"? *(Intentionalitas)*
- [ ] C-2: Apakah ada elemen interaktif yang tidak melakukan apa pun tanpa label yang jelas? *(Kelengkapan Fungsional)*
- [ ] C-3: Apakah ada section yang hanya ada untuk mengisi template AI, bukan melayani konten produk? *(Komposisi Berbasis Konten)*
- [ ] C-4: Apakah UI rusak di state, tema, breakpoint mana pun, atau tanpa mouse? *(Ketahanan)*
- [ ] C-5: Apakah ada testimonial, statistik, atau klaim yang dikarang? *(Bukti di Atas Klaim)*
- [ ] Apakah layout mengikuti template AI (Hero+card generik, "How It Works" selalu 3 langkah, "Trusted By" logo bar, footer 4 kolom tanpa variasi, irama section seragam), atau irama section bertentangan dengan dial RITME yang dinyatakan? *(R-05)*
- [ ] Apakah semua elemen (button, card, input, badge) dibuat berbentuk pil tanpa variasi radius? *(R-11)*
- [ ] Apakah CTA masih generik (Get Started, Learn More, Try Now, Explore, Discover)? *(R-15)*
- [ ] Apakah ada buzzword marketing AI (AI Powered, Seamless, Revolutionary, Cutting Edge, dll.)? *(R-16)*
- [ ] Apakah desain masih terasa generik meski logo dan nama produk diganti? *(R-20)*
- [ ] Apakah dark mode dipaksa sebagai default tanpa alasan branding/user, atau toggle light/dark yang dibutuhkan ditunda dengan alasan? *(R-21)*
- [ ] Apakah palette warna melebihi 2-3 warna inti + 1 aksen tanpa design system yang jelas? *(R-29)*
- [ ] Apakah desain secara keseluruhan terlihat seperti clone dari produk populer lain (Linear, Vercel, Stripe, Notion, dll.)? *(R-30)*
- [ ] Apakah ada keputusan visual utama (warna, layout, typography, spacing, card, ilustrasi) yang alasannya tidak bisa ditulis dalam satu baris? *(R-31)*

Jika satu saja jawaban **ya** (atau **tidak** di Blok 3), jangan serahkan. Perbaiki, jalankan ulang gate, dan baru kemudian kirim. Penyerahan tanpa gate yang bersih adalah kegagalan.
