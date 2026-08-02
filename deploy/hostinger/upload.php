<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Upload-Token, X-Upload-Ticket, Upload-Offset');
header('Access-Control-Expose-Headers: Upload-Offset');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Keep these secrets different. LOOP_DIRECT_UPLOAD_SECRET must match the Node API env value.
$UPLOAD_TOKEN = 'replace-with-a-long-random-upload-token';
$LOOP_DIRECT_UPLOAD_SECRET = 'replace-with-a-separate-32-character-minimum-secret';
$PUBLIC_BASE_URL = '';
$UPLOAD_ROOT = __DIR__ . '/media';
$SESSION_ROOT = dirname(__DIR__) . '/.nest-upload-sessions';
$DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024;
$LOOP_VIDEO_MAX_FILE_SIZE = 100 * 1024 * 1024;
$MAX_CHUNK_SIZE = 16 * 1024 * 1024;

function respond(int $status, array $payload, array $headers = []): void
{
    http_response_code($status);
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
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
    if ($configuredBaseUrl !== '') return $configuredBaseUrl;

    $forwardedProto = strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
    $httpsFlag = strtolower(trim((string)($_SERVER['HTTPS'] ?? '')));
    $scheme = ($forwardedProto === 'https' || $httpsFlag === 'on' || $httpsFlag === '1') ? 'https' : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    return $host !== '' ? $scheme . '://' . $host : '';
}

function base64url_decode_strict(string $value): string|false
{
    if ($value === '' || preg_match('/[^A-Za-z0-9_-]/', $value)) return false;
    $padding = (4 - strlen($value) % 4) % 4;
    return base64_decode(strtr($value, '-_', '+/') . str_repeat('=', $padding), true);
}

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function read_upload_ticket(string $secret): array
{
    $ticket = trim((string)($_SERVER['HTTP_X_UPLOAD_TICKET'] ?? ''));
    $parts = explode('.', $ticket);
    if ($secret === '' || count($parts) !== 2) respond(401, ['message' => 'Invalid upload ticket.']);

    [$encodedPayload, $providedSignature] = $parts;
    $expectedSignature = base64url_encode(hash_hmac('sha256', $encodedPayload, $secret, true));
    if (!hash_equals($expectedSignature, $providedSignature)) {
        respond(401, ['message' => 'Invalid upload ticket.']);
    }

    $decodedPayload = base64url_decode_strict($encodedPayload);
    $payload = $decodedPayload !== false ? json_decode($decodedPayload, true) : null;
    $extension = strtolower((string)($payload['extension'] ?? ''));
    $validExtensions = ['.mp4', '.m4v', '.mov', '.webm'];
    if (
        !is_array($payload) ||
        (int)($payload['version'] ?? 0) !== 1 ||
        !preg_match('/^[0-9a-f-]{36}$/i', (string)($payload['uploadId'] ?? '')) ||
        (string)($payload['folder'] ?? '') !== 'ingest' ||
        !in_array($extension, $validExtensions, true) ||
        !str_starts_with(strtolower((string)($payload['mimeType'] ?? '')), 'video/') ||
        (int)($payload['bytes'] ?? 0) <= 0 ||
        (int)($payload['bytes'] ?? 0) > 100 * 1024 * 1024 ||
        (int)($payload['expiresAt'] ?? 0) < time()
    ) {
        respond(401, ['message' => 'Upload ticket is expired or invalid.']);
    }
    return $payload;
}

function ensure_directory(string $directory): void
{
    if (!is_dir($directory) && !mkdir($directory, 0755, true) && !is_dir($directory)) {
        respond(500, ['message' => 'Failed to create upload directory.']);
    }
}

function session_paths(string $sessionRoot, array $payload): array
{
    $id = (string)$payload['uploadId'];
    return [
        'metadata' => $sessionRoot . DIRECTORY_SEPARATOR . $id . '.json',
        'part' => $sessionRoot . DIRECTORY_SEPARATOR . $id . '.part',
    ];
}

function public_upload_result(array $payload, string $publicBaseUrl): array
{
    $fileName = (string)$payload['uploadId'] . (string)$payload['extension'];
    $relativeUrl = '/media/ingest/' . rawurlencode($fileName);
    return [
        'url' => ($publicBaseUrl !== '' ? $publicBaseUrl : '') . $relativeUrl,
        'path' => $relativeUrl,
        'bytes' => (int)$payload['bytes'],
        'mimeType' => (string)$payload['mimeType'],
        'uploadId' => (string)$payload['uploadId'],
    ];
}

function handle_direct_upload(
    string $action,
    string $secret,
    string $sessionRoot,
    string $uploadRoot,
    string $publicBaseUrl,
    int $maxChunkSize
): void {
    $payload = read_upload_ticket($secret);
    ensure_directory($sessionRoot);
    $paths = session_paths($sessionRoot, $payload);
    $targetDirectory = rtrim($uploadRoot, '/\\') . DIRECTORY_SEPARATOR . 'ingest';
    $targetPath = $targetDirectory . DIRECTORY_SEPARATOR . $payload['uploadId'] . $payload['extension'];

    if ($action === 'init' || $action === 'status') {
        if (is_file($targetPath)) {
            respond(200, ['complete' => true, 'offset' => (int)$payload['bytes']] + public_upload_result($payload, $publicBaseUrl), [
                'Upload-Offset' => (string)$payload['bytes'],
            ]);
        }
        if (!is_file($paths['metadata'])) {
            file_put_contents($paths['metadata'], json_encode($payload, JSON_UNESCAPED_SLASHES), LOCK_EX);
        }
        $offset = is_file($paths['part']) ? (int)filesize($paths['part']) : 0;
        respond(200, ['complete' => false, 'offset' => $offset, 'uploadId' => $payload['uploadId']], [
            'Upload-Offset' => (string)$offset,
        ]);
    }

    if ($action === 'chunk') {
        if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') respond(405, ['message' => 'Chunk uploads require PATCH.']);
        if (!is_file($paths['metadata'])) respond(409, ['message' => 'Upload session is not initialized.']);
        $requestedOffset = filter_var($_SERVER['HTTP_UPLOAD_OFFSET'] ?? null, FILTER_VALIDATE_INT);
        if ($requestedOffset === false || $requestedOffset < 0) respond(400, ['message' => 'Invalid upload offset.']);

        $input = fopen('php://input', 'rb');
        $output = fopen($paths['part'], 'c+b');
        if (!$input || !$output || !flock($output, LOCK_EX)) respond(500, ['message' => 'Failed to open upload stream.']);

        fseek($output, 0, SEEK_END);
        $currentOffset = ftell($output);
        if ($currentOffset !== $requestedOffset) {
            flock($output, LOCK_UN);
            fclose($output);
            fclose($input);
            respond(409, ['message' => 'Upload offset does not match.', 'offset' => $currentOffset], [
                'Upload-Offset' => (string)$currentOffset,
            ]);
        }

        $remaining = (int)$payload['bytes'] - $currentOffset;
        $allowedBytes = min($remaining, $maxChunkSize);
        $written = stream_copy_to_stream($input, $output, $allowedBytes + 1);
        if ($written !== false && $written > $allowedBytes) {
            ftruncate($output, $currentOffset);
        }
        fflush($output);
        flock($output, LOCK_UN);
        fclose($output);
        fclose($input);
        if ($written === false || $written <= 0 || $written > $allowedBytes) {
            respond(400, ['message' => 'Chunk is empty or too large.']);
        }

        $nextOffset = $currentOffset + $written;
        respond(200, ['offset' => $nextOffset, 'complete' => $nextOffset === (int)$payload['bytes']], [
            'Upload-Offset' => (string)$nextOffset,
        ]);
    }

    if ($action === 'complete') {
        if (is_file($targetPath)) respond(200, public_upload_result($payload, $publicBaseUrl));
        if (!is_file($paths['part']) || (int)filesize($paths['part']) !== (int)$payload['bytes']) {
            respond(409, ['message' => 'Upload is incomplete.']);
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = $finfo ? (finfo_file($finfo, $paths['part']) ?: '') : '';
        if ($finfo) finfo_close($finfo);
        if (!str_starts_with($mimeType, 'video/')) {
            unlink($paths['part']);
            unlink($paths['metadata']);
            respond(400, ['message' => 'Uploaded content is not a video.']);
        }
        ensure_directory($targetDirectory);
        if (!rename($paths['part'], $targetPath)) respond(500, ['message' => 'Failed to publish uploaded video.']);
        if (is_file($paths['metadata'])) unlink($paths['metadata']);
        respond(200, public_upload_result($payload, $publicBaseUrl));
    }

    respond(400, ['message' => 'Unknown upload action.']);
}

$action = strtolower(trim((string)($_GET['action'] ?? '')));
$publicBaseUrl = resolve_public_base_url($PUBLIC_BASE_URL);
if (in_array($action, ['init', 'status', 'chunk', 'complete'], true)) {
    handle_direct_upload(
        $action,
        $LOOP_DIRECT_UPLOAD_SECRET,
        $SESSION_ROOT,
        $UPLOAD_ROOT,
        $publicBaseUrl,
        $MAX_CHUNK_SIZE
    );
}

// Backward-compatible server-to-server multipart bridge.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['message' => 'Method not allowed.']);
$incomingToken = $_SERVER['HTTP_X_UPLOAD_TOKEN'] ?? '';
if ($UPLOAD_TOKEN === '' || !hash_equals($UPLOAD_TOKEN, $incomingToken)) {
    respond(401, ['message' => 'Unauthorized upload request.']);
}
if (!isset($_FILES['file']) || !is_array($_FILES['file'])) respond(400, ['message' => 'Missing file payload.']);

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) respond(400, ['message' => 'Invalid uploaded file.']);
$tmpName = (string)($file['tmp_name'] ?? '');
$fileSize = (int)($file['size'] ?? 0);
$originalName = (string)($file['name'] ?? 'upload.bin');
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = $finfo ? (finfo_file($finfo, $tmpName) ?: '') : '';
if ($finfo) finfo_close($finfo);

$uploadClass = strtolower(trim((string)($_POST['upload_class'] ?? '')));
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$isLoopAsset = $uploadClass === 'loop-video' && in_array($extension, ['m3u8', 'm4s', 'ts'], true);
$isAllowed = str_starts_with($mimeType, 'image/') || str_starts_with($mimeType, 'video/') || $isLoopAsset;
if (!$isAllowed) respond(400, ['message' => 'Only image and video files are allowed.']);
$isLoopUpload = $uploadClass === 'loop-video' && (str_starts_with($mimeType, 'video/') || $isLoopAsset);
$maxFileSize = $isLoopUpload ? $LOOP_VIDEO_MAX_FILE_SIZE : $DEFAULT_MAX_FILE_SIZE;
if ($fileSize <= 0 || $fileSize > $maxFileSize) respond(400, ['message' => 'File size is invalid.']);

$folder = sanitize_segment((string)($_POST['folder'] ?? 'uploads'), 'uploads');
$targetDir = rtrim($UPLOAD_ROOT, '/\\') . DIRECTORY_SEPARATOR . $folder;
ensure_directory($targetDir);
$safeExt = preg_replace('/[^a-z0-9]+/', '', $extension) ?: 'bin';
$fileBase = sanitize_segment(pathinfo($originalName, PATHINFO_FILENAME), 'file');
$requestedTargetName = sanitize_file_name((string)($_POST['target_name'] ?? ''), '');
$preserveName = ((string)($_POST['preserve_name'] ?? '') === '1');
$newName = $preserveName && $requestedTargetName !== ''
    ? $requestedTargetName
    : time() . '-' . bin2hex(random_bytes(4)) . '-' . $fileBase . '.' . $safeExt;
$targetPath = $targetDir . DIRECTORY_SEPARATOR . $newName;
if (!move_uploaded_file($tmpName, $targetPath)) respond(500, ['message' => 'Failed to move uploaded file.']);

$relativeUrl = '/media/' . rawurlencode($folder) . '/' . rawurlencode($newName);
respond(200, [
    'url' => ($publicBaseUrl !== '' ? $publicBaseUrl : '') . $relativeUrl,
    'path' => $relativeUrl,
    'bytes' => $fileSize,
    'mimeType' => $mimeType,
]);
