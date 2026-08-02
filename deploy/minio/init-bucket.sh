#!/usr/bin/env bash
set -euo pipefail

# Run from VPS after MinIO is up and Caddy is serving storage.nest-sc.com.
docker run --rm --network host minio/mc alias set local https://storage.nest-sc.com minioadmin MinioRootPass2026!
docker run --rm --network host minio/mc mb --ignore-existing local/nest-sc-media
docker run --rm --network host minio/mc anonymous set download local/nest-sc-media
echo "MinIO bucket is ready: nest-sc-media"

