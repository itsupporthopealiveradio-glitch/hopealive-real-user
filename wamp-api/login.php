<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed'], 405);
$data = input();
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');
$admin = (bool)($data['admin'] ?? false);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    respond(['error' => 'Email and password are required'], 422);
}

$stmt = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || $user['status'] !== 'active' || !password_verify($password, (string)$user['password_hash'])) {
    $audit = db()->prepare('INSERT INTO audit_logs (actor_user_id, action, entity_type, details, ip_address) VALUES (?, ?, ?, ?, ?)');
    $audit->execute([$user['id'] ?? null, 'login_failed', 'user', json_encode(['admin' => $admin]), $_SERVER['REMOTE_ADDR'] ?? null]);
    respond(['error' => 'Invalid credentials'], 401);
}

if ($admin && $user['role'] !== 'admin') respond(['error' => 'Administrator access required'], 403);
if (!$admin && !in_array($user['role'], ['user', 'security', 'manager', 'admin'], true)) respond(['error' => 'Access denied'], 403);

$token = bin2hex(random_bytes(32));
$session = db()->prepare('INSERT INTO user_sessions (id, user_id, token_hash, expires_at, ip_address, user_agent) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR), ?, ?)');
$session->execute([
    sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6))),
    $user['id'], hash('sha256', $token), $_SERVER['REMOTE_ADDR'] ?? null, $_SERVER['HTTP_USER_AGENT'] ?? null
]);

db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$user['id']]);

db()->prepare('INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)')->execute([$user['id'], $admin ? 'admin_login' : 'login', 'user', $user['id'], json_encode(['result' => 'success', 'device_info' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown device']), $_SERVER['REMOTE_ADDR'] ?? null]);

respond(['token' => $token, 'user' => [
    'id' => $user['id'],
    'email' => $user['email'],
    'firstName' => $user['first_name'],
    'lastName' => $user['last_name'],
    'role' => $user['role'],
    'employeeId' => $user['employee_id'] ?? null,
]]);
