# Loop video worker

Loop videolari HTTP istegi icinde degil, MongoDB kuyrugundan worker modulu tarafindan islenir.

## Gereksinimler

- API ve worker ayni `MONGODB_URI` degerini kullanmalidir.
- `STORAGE_PROVIDER=local` ise API ve worker ayni `UPLOADS_DIR` diskini gormelidir.
- S3 veya Hostinger kullanilirsa islenmis ciktilar uzak medya alanina aktarilir; kaynak dosya isleme boyunca worker ile ayni diskte kalmalidir.
- FFmpeg npm paketiyle birlikte gelir. Gerekirse `FFMPEG_PATH` ile sistem binary'si tercih edilebilir.

## Calistirma

Hostinger shared hosting'de ek bir uzun omurlu proses acmadan baslatmak icin:

```bash
npm start
```

`LOOP_WORKER_MODE=embedded` kuyruk dongusunu API prosesi icinde tutar. FFmpeg
donusumu yine ayri bir isletim sistemi prosesi olarak calisir; HTTP istegini
bloklamaz. MongoDB partial-unique kilidi, birden fazla API instance'i olsa bile
ayni anda yalnizca bir videonun islenmesini saglar.

VPS veya ayri worker servisi olan bir ortamda:

```bash
LOOP_WORKER_MODE=external npm start
npm run worker:loop
```

`npm run start:all` bu iki prosesi tek yonetici altinda baslatan alternatiftir.
Worker'i tamamen kapatmak icin `LOOP_WORKER_MODE=disabled` kullanilabilir.

Worker sayisini baslangicta bir tutun. Her worker ayni anda bir FFmpeg isi alir; ikinci worker eklemek esit zamanli CPU tuketimini iki katina cikarir.

## Ortam degiskenleri

- `LOOP_ASYNC_PROCESSING_ENABLED=true`
- `LOOP_WORKER_MODE=embedded`
- `LOOP_MAX_DURATION_SECONDS=90`
- `LOOP_WORKER_POLL_MS=2000`
- `LOOP_WORKER_LEASE_MS=1200000`
- `LOOP_WORKER_JOB_TIMEOUT_MS=900000`
- `LOOP_WORKER_MAX_ATTEMPTS=3`
- `LOOP_RAW_BACKFILL_LIMIT=0`
- `LOOP_BACKFILL_DOWNLOAD_TIMEOUT_MS=120000`
- `LOOP_BACKFILL_MAX_SOURCE_BYTES=104857600`

Worker 360p, 540p ve 720p varyantlarini, WebP posterini, 720p'ye kadar MP4 fallback dosyasini ve adaptif HLS master playlistini uretir. Kaynak cozunurlukten daha buyuk piksel boyutu uretilmez.

## Eski raw Loop videolari

Yeni yuklemeler dogrudan MongoDB kuyruguna girer. Daha once yuklenmis ve
`processing=raw`, `hlsUrl` bos durumda kalan uzak MP4 kayitlari icin
`LOOP_RAW_BACKFILL_LIMIT` sifirdan buyuk ayarlanabilir. Worker her baslangicta
en yeni uygun kayitlardan en fazla bu limit kadarini kuyruga alir. Kaynak URL
yalnizca yapilandirilmis Hostinger yukleme origininden ve `/media/` yolundan
kabul edilir; boyut ve indirme suresi ayrica sinirlanir.

Paylasimli hosting icin once `LOOP_RAW_BACKFILL_LIMIT=1` kullanin. Runtime
logunda `loop_backfill` ve ardindan basarili `loop_worker` kaydi gorulmeden
limiti artirmayin. Varsayilan `0` degeri otomatik backfill'i kapali tutar.
