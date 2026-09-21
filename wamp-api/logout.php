<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
$token = bearerToken();
if ($token) db()->prepare('UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = ?')->execute([hash('sha256', $token)]);
respond(['ok' => true]);
