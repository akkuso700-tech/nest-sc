<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

// Update these two values before uploading to Hostinger:
$UPLOAD_TOKEN = 'replace-with-a-long-random-upload-token';
// Optional: keep empty to auto-detect current host (upload.nest-sc.com / upload-demo.nest-sc.com).
$PUBLIC_BASE_URL = '';
$UPLOAD_ROOT = __DIR__ . '/media';
$DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
$LOOP_VIDEO_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function sanitize_segment(string $value, string $fallback = 'uploads'): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9_-]+/', '-', $value) ?? '';
    $value = preg_replace('/-+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? $value : $fallback;
}

function sanitize_file_name(string $value, string $fallback = 'file.bin'): string
{
    $value = trim($value);
    $value = preg_replace('/[^a-zA-Z0-9._-]+/', '-', $value) ?? '';
    $value = preg_replace('/-+/', '-', $value) ?? '';
    $value = trim($value, '-.');
    return $value !== '' ? $value : $fallback;
}

function resolve_public_base_url(string $configuredBaseUrl): string
{
    $configuredBaseUrl = rtrim(trim($configuredBaseUrl), '/');
    if ($configuredBaseUrl !== '') {
        return $configuredBaseUrl;
    }

    $forwardedProto = strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
    $httpsFlag = strtolower(trim((string)($_SERVER['HTTPS'] ?? '')));
    $scheme = ($forwardedProto === 'https' || $httpsFlag === 'on' || $httpsFlag === '1') ? 'https' : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));

    if ($host === '') {
        return '';
    }

    return $scheme . '://' . $host;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['message' => 'Method not allowed.']);
}

$incomingToken = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
if ($UPLOAD_TOKEN === '' || !hash_equals($UPLOAD_TOKEN, $incomingToken)) {
    respond(401, ['message' => 'Unauthorized upload request.']);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    respond(400, ['message' => 'Missing file payload.']);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    respond(400, ['message' => 'Invalid uploaded file.']);
}

$tmpName = (string)($file['tmp_name'] ?? '');
$fileSize = (int)($file['size'] ?? 0);
$originalName = (string)($file['name'] ?? 'upload.bin');

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = $finfo ? (finfo_file($finfo, $tmpName) ?: '') : '';
if ($finfo) {
    finfo_close($finfo);
}

$isAllowed = str_starts_with($mimeType, 'image/') || str_starts_with($mimeType, 'video/');
if (!$isAllowed) {
    respond(400, ['message' => 'Only image and video files are allowed.']);
}

$uploadClass = strtolower(trim((string)($_POST['upload_class'] ?? '')));
$isLoopVideo = $uploadClass === 'loop-video' && str_starts_with($mimeType, 'video/');
$maxFileSize = $isLoopVideo ? $LOOP_VIDEO_MAX_FILE_SIZE : $DEFAULT_MAX_FILE_SIZE;

if ($fileSize <= 0 || $fileSize > $maxFileSize) {
    respond(400, ['message' => 'File size is invalid.']);
}

$folder = sanitize_segment((string)($_POST['folder'] ?? 'uploads'), 'uploads');
$targetDir = rtrim($UPLOAD_ROOT, '/\\') . DIRECTORY_SEPARATOR . $folder;

if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
    respond(500, ['message' => 'Failed to create target directory.']);
}

$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$safeExt = preg_replace('/[^a-z0-9]+/', '', $extension) ?: 'bin';
$fileBase = sanitize_segment(pathinfo($originalName, PATHINFO_FILENAME), 'file');
$requestedTargetName = sanitize_file_name((string)($_POST['target_name'] ?? ''), '');
$preserveName = ((string)($_POST['preserve_name'] ?? '') === '1');

if ($preserveName && $requestedTargetName !== '') {
    $newName = $requestedTargetName;
} else {
    $newName = time() . '-' . bin2hex(random_bytes(4)) . '-' . $fileBase . '.' . $safeExt;
}

$targetPath = $targetDir . DIRECTORY_SEPARATOR . $newName;

if (!move_uploaded_file($tmpName, $targetPath)) {
    respond(500, ['message' => 'Failed to move uploaded file.']);
}

$relativeUrl = '/media/' . rawurlencode($folder) . '/' . rawurlencode($newName);
$publicBaseUrl = resolve_public_base_url($PUBLIC_BASE_URL);
$publicUrl = ($publicBaseUrl !== '' ? $publicBaseUrl : '') . $relativeUrl;

respond(200, [
    'url' => $publicUrl,
    'path' => $relativeUrl,
    'bytes' => $fileSize,
    'mimeType' => $mimeType,
]);
