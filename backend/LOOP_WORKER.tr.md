# Loop video worker

Loop videolari HTTP istegi icinde degil, MongoDB kuyrugundan ayri bir Node prosesi tarafindan islenir.

## Gereksinimler

- API ve worker ayni `MONGODB_URI` degerini kullanmalidir.
- `STORAGE_PROVIDER=local` ise API ve worker ayni `UPLOADS_DIR` diskini gormelidir.
- S3 veya Hostinger kullanilirsa islenmis ciktilar uzak medya alanina aktarilir; kaynak dosya isleme boyunca worker ile ayni diskte kalmalidir.
- FFmpeg npm paketiyle birlikte gelir. Gerekirse `FFMPEG_PATH` ile sistem binary'si tercih edilebilir.

## Calistirma

Tek sunucuda API ve ayri worker prosesini birlikte baslatmak icin:

```bash
npm run start:all
```

Proses yoneticisi iki ayri servis destekliyorsa:

```bash
npm start
npm run worker:loop
```

Worker sayisini baslangicta bir tutun. Her worker ayni anda bir FFmpeg isi alir; ikinci worker eklemek esit zamanli CPU tuketimini iki katina cikarir.

## Ortam degiskenleri

- `LOOP_ASYNC_PROCESSING_ENABLED=true`
- `LOOP_MAX_DURATION_SECONDS=90`
- `LOOP_WORKER_POLL_MS=2000`
- `LOOP_WORKER_LEASE_MS=1200000`
- `LOOP_WORKER_JOB_TIMEOUT_MS=900000`
- `LOOP_WORKER_MAX_ATTEMPTS=3`

Worker 360p, 540p ve 720p varyantlarini, WebP posterini, 720p'ye kadar MP4 fallback dosyasini ve adaptif HLS master playlistini uretir. Kaynak cozunurlukten daha buyuk piksel boyutu uretilmez.
