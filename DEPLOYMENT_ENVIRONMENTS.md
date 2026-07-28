# Demo ve Canli Ortam Plani (Hostinger + GitHub)

Bu proje iki ortamla calisacak sekilde tasarlandi:

- `main` -> Canli (production)
- `develop` -> Demo (staging)

## Hedef domain yapisi

Canli:

- Frontend: `https://nest-sc.com`
- API: `https://api.nest-sc.com`
- Upload: `https://upload.nest-sc.com/upload.php`

Demo:

- Frontend: `https://demo.nest-sc.com`
- API: `https://api-demo.nest-sc.com`
- Upload: `https://upload-demo.nest-sc.com/upload.php`

## Git akis kurali

1. Tum feature degisiklikleri `develop` branch'ine merge edilir.
2. Demo ortaminda test tamamlanir.
3. `develop -> main` PR acilir.
4. PR merge edilince sadece canli ortama cikar.

## Hostinger tarafi (otomatik deploy)

Bu projede su an aktif kullanim sekli "tek backend deployment" modelidir.
Yani `demo.nest-sc.com` da `api-demo.nest-sc.com` da ayni `my-social-1/backend`
deployment'inden servis alabilir. Bu modelde kritik nokta:

- Her deploy sirasinda frontend build alinip `backend/public` guncellenmelidir.
- Aksi halde deploy commit'i yeni olsa bile UI eski gorunebilir.

Her ortam icin ayri Node.js deployment tanimla:

1. `api.nest-sc.com` deployment'i:
   - Branch: `main`
   - Root directory: `my-social-1/backend`
   - Entry file: `src/server.js`
   - Build command: `npm run hostinger:build`
2. `api-demo.nest-sc.com` deployment'i:
   - Branch: `develop`
   - Root directory: `my-social-1/backend`
   - Entry file: `src/server.js`
   - Build command: `npm run hostinger:build`

Eger `demo.nest-sc.com` icin de ayni backend deployment kullaniliyorsa:

- Branch: `develop`
- Root directory: `my-social-1/backend`
- Entry file: `src/server.js`
- Build command: `npm run hostinger:build`

Frontend icin iki ayri deployment kullan:

1. `nest-sc.com` deployment'i:
   - Branch: `main`
   - Root directory: `my-social-1/frontend`
2. `demo.nest-sc.com` deployment'i:
   - Branch: `develop`
   - Root directory: `my-social-1/frontend`

Not: Hostinger panelde buton ismi surume gore degisebilir (`Deploy`, `Settings and redeploy`, `Create deployment`).

## Env dosyalari

Backend:

- Canli icin: `backend/hostinger-live.env.example`
- Demo icin: `backend/render-demo.env.example` (Hostinger demo icin de kullanabilirsin)

Frontend:

- Canli icin: `frontend/hostinger-live.env.example`
- Demo icin: `frontend/hostinger-demo.env.example`

`VITE_APP_ENV` degeri:

- Canli: `live`
- Demo: `demo`

Demo ortaminda ust barda otomatik `Demo Ortami` etiketi gorunur.

## Veri ayrimi (kritik)

- Canli ve demo icin ayri MongoDB veritabani kullan.
- Canli ve demo icin ayri upload token kullan.
- Canli ve demo icin ayri upload subdomain kullan.
- `COOKIE_DOMAIN` tanimlama. API, oturum cerezlerini host-only olarak yazar;
  boylece `api.nest-sc.com` ile `api-demo.nest-sc.com` oturumlari birbirine
  karismaz ve tarayici gecersiz demo cerezini reddetmez.

## Hizli dogrulama listesi

Canli:

- `https://api.nest-sc.com/api/v1/health`
- `https://nest-sc.com`

Demo:

- `https://api-demo.nest-sc.com/api/v1/health`
- `https://demo.nest-sc.com`

## Onerilen ek guvenlik

- GitHub'da `main` branch protection ac.
- `main` branch'e direct push kapat, PR zorunlu yap.
- Demo ortamda `noindex` aktif olsun (frontend kodunda env ile otomatik acik).
