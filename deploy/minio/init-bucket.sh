#!/usr/bin/env bash
set -euo pipefail

# Run from VPS after MinIO is up and Caddy is serving storage.nest-sc.com.
docker run --rm --network host minio/mc alias set local https://storage.nest-sc.com minioadmin MinioRootPass2026!
docker run --rm --network host minio/mc mb --ignore-existing local/nest-sc-media
docker run --rm --network host minio/mc mb --ignore-existing local/nest-sc-sources
docker run --rm --network host minio/mc mb --ignore-existing local/nest-sc-sources-demo
docker run --rm --network host minio/mc anonymous set download local/nest-sc-media
docker run --rm --network host -v "$(pwd)/direct-upload-cors.xml:/cors.xml:ro" minio/mc cors set local/nest-sc-sources /cors.xml
docker run --rm --network host -v "$(pwd)/direct-upload-cors.xml:/cors.xml:ro" minio/mc cors set local/nest-sc-sources-demo /cors.xml
docker run --rm --network host minio/mc ilm rule add --abort-incomplete-multipart-upload 1d local/nest-sc-sources
docker run --rm --network host minio/mc ilm rule add --abort-incomplete-multipart-upload 1d local/nest-sc-sources-demo
echo "MinIO bucket is ready: nest-sc-media"
