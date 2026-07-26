# Hostinger upload koprusu (canli + demo)

Bu klasor, API Node.js uygulamasi ayri calisirken medya dosyalarini Hostinger diskine kaydetmek icindir.

## Yuklenecek dosyalar

- `upload.php`
- `media.htaccess`

Canli:
- Domain: `upload.nest-sc.com`
- Hedef klasor: bu domaine bagli `public_html`

Demo:
- Domain: `upload-demo.nest-sc.com`
- Hedef klasor: bu domaine bagli `public_html`

Her iki upload domaininde de:
- `upload.php` dosyasi kokte olmali
- `media/.htaccess` dosyasi olmali
- `media` klasoru yazilabilir olmali

## upload.php ayari

- `$UPLOAD_TOKEN` zorunlu: API env'deki `HOSTINGER_UPLOAD_TOKEN` ile birebir ayni olmali.
- `$PUBLIC_BASE_URL` bos birakilabilir. Bos ise script otomatik olarak cagrilan hostu baz alir.
  - Ornek: `upload.nest-sc.com` cagrildiysa URL `https://upload.nest-sc.com/media/...` doner.

## Backend env (canli)

```env
STORAGE_PROVIDER=hostinger
HOSTINGER_UPLOAD_URL=https://upload.nest-sc.com/upload.php
HOSTINGER_UPLOAD_TOKEN=replace-with-live-upload-token
HOSTINGER_PUBLIC_BASE_URL=https://upload.nest-sc.com
HOSTINGER_UPLOAD_TIMEOUT_MS=15000
```

## Backend env (demo)

```env
STORAGE_PROVIDER=hostinger
HOSTINGER_UPLOAD_URL=https://upload-demo.nest-sc.com/upload.php
HOSTINGER_UPLOAD_TOKEN=replace-with-demo-upload-token
HOSTINGER_PUBLIC_BASE_URL=https://upload-demo.nest-sc.com
HOSTINGER_UPLOAD_TIMEOUT_MS=15000
```

## Hızlı test

Tarayicidan:
- `https://upload.nest-sc.com/upload.php`
- `https://upload-demo.nest-sc.com/upload.php`

Beklenen cevap:
- `{"message":"Method not allowed."}`

Bu cevap geliyorsa endpoint ayakta demektir.

## Canlidan demo medyaya senkron (otomatik)

Canlidaki medya dosyalari demo upload diskinde eksikse, asagidaki script ile eksikleri kopyalayabilirsin:

- `sync-live-media-to-demo.mjs`

### 1) Once dry-run ile kontrol et

PowerShell:

```powershell
cd C:\Users\oomnn\Desktop\web-site-calisma\projects\my-social-1
node deploy/hostinger/sync-live-media-to-demo.mjs --dry-run
```

Dry-run yukleme yapmaz; sadece hangi dosyalarin demo tarafinda eksik oldugunu gosterir.

### 2) Gercek senkronu calistir

PowerShell:

```powershell
cd C:\Users\oomnn\Desktop\web-site-calisma\projects\my-social-1
$env:DEMO_UPLOAD_TOKEN="demo-upload-token-buraya"
node deploy/hostinger/sync-live-media-to-demo.mjs
```

Onemli:
- `upload.php` dosyan guncel olmalidir (bu repodaki son surum).
- Guncel surum `preserve_name=1` ve `target_name` parametrelerini destekler.
- Bu sayede demo URL'leri canli URL dosya adlari ile birebir eslenir.

### 3) Istegine gore kapsam arttirma

```powershell
node deploy/hostinger/sync-live-media-to-demo.mjs --max-pages=50 --limit=24
```

### Notlar

- Script canli API feed'inden medya URL'lerini toplar (post medyalari + author avatar).
- Demo tarafinda mevcut dosyalari atlar, sadece eksikleri yukler.
- Demo upload token yanlis ise 401 hatasi alirsin.
