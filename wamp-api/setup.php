<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Method not allowed'], 405);
$data = input();
$email = strtolower(trim((string)($data['email'] ?? '')));
$employeeNumber = trim((string)($data['employeeNumber'] ?? ''));
$password = (string)($data['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $employeeNumber === '' || strlen($password) < 4) respond(['error' => 'Email, employee number, and a 4-digit PIN are required'], 422);

$stmt = db()->prepare('SELECT u.id FROM users u JOIN employees e ON e.user_id = u.id WHERE LOWER(u.email) = ? AND e.employee_number = ? AND u.status = "active" AND e.onboarding_status IN ("invited", "pending", "active") LIMIT 1');
$stmt->execute([$email, $employeeNumber]);
$userId = $stmt->fetchColumn();
if (!$userId) respond(['error' => 'This email and employee number are not authorized. Ask an administrator to add you first.'], 403);

$hash = password_hash($password, PASSWORD_DEFAULT);
db()->prepare('UPDATE users SET password_hash = ?, first_login_at = COALESCE(first_login_at, NOW()) WHERE id = ?')->execute([$hash, $userId]);
respond(['ok' => true]);
