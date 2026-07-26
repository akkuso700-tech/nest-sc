# MinIO + CDN-benzeri medya altyapisi (Cloudflare olmadan)

Bu klasor, `nest-sc.com` projesi icin object storage kurulum dosyalarini icerir.

## 1) DNS kayitlari (Hostinger)

Domain yonetiminde su kayitlari eklenmeli:

- `A` kaydi: `storage` -> VPS IPv4
- `A` kaydi: `minio-panel` -> VPS IPv4

## 2) VPS'e dosyalari kopyala

Bu klasoru VPS'e kopyalayin (ornek hedef):

- `/opt/minio-setup`

Ornek:

```bash
mkdir -p /opt/minio-setup
```

Sonra bu klasordeki dosyalari buraya yukleyin.

## 3) Docker ve Caddy

Ubuntu VPS icin:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin caddy
sudo systemctl enable docker
sudo systemctl start docker
```

## 4) MinIO baslat

```bash
cd /opt/minio-setup
cp minio.env.example minio.env
sudo docker compose up -d
```

## 5) Caddy ayarla (SSL otomatik)

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy
```

## 6) Bucket olustur ve public read ac

```bash
cd /opt/minio-setup
chmod +x init-bucket.sh
./init-bucket.sh
```

## 7) Render backend ENV

Render backend ortam degiskenleri:

```env
STORAGE_PROVIDER=s3
S3_BUCKET=nest-sc-media
S3_REGION=us-east-1
S3_ENDPOINT=https://storage.nest-sc.com
S3_PUBLIC_BASE_URL=https://storage.nest-sc.com/nest-sc-media
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=MinioRootPass2026!
S3_PREFIX=nest-social
S3_OBJECT_ACL=
S3_FORCE_PATH_STYLE=true
```

Not:

- `S3_OBJECT_ACL` MinIO icin bos kalabilir.
- Env kaydettikten sonra backend redeploy yapin.

