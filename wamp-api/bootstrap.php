<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
if (preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/', $_SERVER['HTTP_ORIGIN'] ?? '')) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function input(): array {
    $raw = file_get_contents('php://input') ?: '{}';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(array $payload, int $status = 200): never {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function bearerToken(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) return trim($matches[1]);
    return null;
}

function requireSession(bool $admin = false): array {
    $token = bearerToken();
    if (!$token) respond(['error' => 'Authentication required'], 401);

    $hash = hash('sha256', $token);
    $stmt = db()->prepare(
        'SELECT s.user_id, u.email, u.first_name, u.last_name, u.role, u.status, e.id employee_id
         FROM user_sessions s JOIN users u ON u.id = s.user_id
         LEFT JOIN employees e ON e.user_id = u.id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW()
           AND u.status = "active" LIMIT 1'
    );
    $stmt->execute([$hash]);
    $user = $stmt->fetch();
    if (!$user || ($admin && $user['role'] !== 'admin')) respond(['error' => 'Access denied'], 403);
    return $user;
}
