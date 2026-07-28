# Hostinger Node.js Tasima Rehberi (Render -> Hostinger)

Bu rehber, projeyi Render'dan Hostinger'a tasimak icin hazirlandi.
Mimari:

- `api.nest-sc.com` -> Node.js backend (Hostinger Node App)
- `nest-sc.com` -> React frontend (statik dosya)
- `upload.nest-sc.com` -> mevcut upload.php koprusu (ayni kalir)

## 1) Bu repoda hazirlanan dosyalar

- Backend env sablonu: `backend/hostinger-live.env.example`
- Frontend env sablonu: `frontend/hostinger-live.env.example`
- Frontend SPA rewrite: `deploy/hostinger/frontend.htaccess`
- Frontend artifact script: `deploy/hostinger/build-frontend-hostinger.ps1`
- Backend artifact script: `deploy/hostinger/prepare-backend-package.ps1`

## 2) Yerelde artifact hazirla (senin bilgisayarin)

Proje kokunde terminal ac:

```powershell
Set-Location C:\Users\oomnn\Desktop\web-site-calisma\projects\my-social-1
powershell -ExecutionPolicy Bypass -File .\deploy\hostinger\prepare-backend-package.ps1
Set-Location .\frontend
$env:VITE_API_URL="https://api.nest-sc.com/api/v1"
npm.cmd run build
Set-Location ..
powershell -ExecutionPolicy Bypass -File .\deploy\hostinger\build-frontend-hostinger.ps1
```

Olusan dosyalar:

- `deploy/hostinger/artifacts/backend-hostinger.zip`
- `deploy/hostinger/artifacts/frontend-hostinger.zip`

## 3) Hostinger panel - Backend Node App

1. hPanel -> `Websites` -> solda `Node.js`
2. Yeni uygulama olustur:
   - Application URL: `api.nest-sc.com`
   - Application root: ornek `api.nest-sc.com` (panel ne verirse onu kullan)
   - Startup file: `src/server.js`
   - Node version: en yeni LTS (20+)
3. `backend-hostinger.zip` dosyasini Application root'a yukle ve ac.
4. Root icinde `npm install` calistir.
5. `.env` dosyasi olustur (asagidaki 4. adimdaki env'lerle).
6. App'i `Restart` et.

## 4) Backend .env (Hostinger)

`backend/hostinger-live.env.example` dosyasini temel al.
Canli icin minimum kritik alanlar:

- `NODE_ENV=production`
- `PORT=3000` (panel farkli port istiyorsa ona gore)
- `CLIENT_URL=https://nest-sc.com`
- `CORS_ORIGINS=https://nest-sc.com,https://www.nest-sc.com`
- `MONGODB_URI=<atlas connection string>`
- `STORAGE_PROVIDER=hostinger`
- `HOSTINGER_UPLOAD_URL=https://upload.nest-sc.com/upload.php`
- `HOSTINGER_UPLOAD_TOKEN=<senin upload token>`
- `HOSTINGER_PUBLIC_BASE_URL=https://upload.nest-sc.com`
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=<re_...>`
- `JWT_ACCESS_SECRET/JWT_REFRESH_SECRET/JWT_PASSWORD_RESET_SECRET`
- `COOKIE_DOMAIN` tanimlamayin. Oturum cerezleri API alan adina ozel kalmalidir.

Not:

- Atlas tarafinda Hostinger cikis IP'si whitelist'te olmali.
- `CLIENT_URL` tek URL olmali, virgullu olamaz.

## 5) Hostinger panel - Frontend (nest-sc.com)

1. Domain `nest-sc.com` icin `public_html` klasorunu ac.
2. Icindeki eski dosyalari yedekle.
3. `frontend-hostinger.zip` dosyasini yukle ve `public_html` icine ac.
4. `frontend.htaccess` dosyasi `dist` icinde otomatik eklendigi icin route refresh 404 vermez.

## 6) DNS / Domain dogrulama

- `api.nest-sc.com` Hostinger Node App'e bagli olmali.
- `nest-sc.com` ve `www.nest-sc.com` frontend dosyalarini gostermeli.
- `upload.nest-sc.com` mevcut upload endpoint'e gitmeli.

Demo icin:

- `demo.nest-sc.com` -> demo frontend app
- `api-demo.nest-sc.com` -> demo Node API app
- `upload-demo.nest-sc.com` -> demo upload.php endpoint

Not: `demo` A kaydi yoksa demo acilmaz; sadece `api-demo` ve `upload-demo` yeterli degildir.

## 7) Canli test checklist

1. `https://api.nest-sc.com/api/v1/health` -> JSON donecek
2. `https://nest-sc.com` -> uygulama acilacak
3. Login -> basarili
4. Feed -> dolu
5. Medya upload -> basarili
6. Mesajlasma socket -> baglaniyor

## 8) Gecis bittikten sonra

- Render backend/frontend servislerini hemen silme.
- 24 saat izleme yap, hata yoksa Render'i kapat.
