<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$email = 'ITsupporthopealiveradio@gmail.com';
$passwordHash = password_hash('Hope@2020', PASSWORD_DEFAULT);
$userId = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
$employeeId = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
$pdo = db();
$pdo->beginTransaction();
try {
    $find = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $existing = $find->fetchColumn();
    if ($existing) {
        $pdo->prepare('UPDATE users SET password_hash = ?, first_name = ?, last_name = ?, role = "admin", status = "active" WHERE id = ?')->execute([$passwordHash, 'IT Support', 'Hope Alive Radio', $existing]);
        $userId = (string)$existing;
    } else {
        $pdo->prepare('INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified_at) VALUES (?, ?, ?, ?, ?, "admin", "active", NOW())')->execute([$userId, $email, $passwordHash, 'IT Support', 'Hope Alive Radio']);
    }
    $employee = $pdo->prepare('SELECT id FROM employees WHERE user_id = ? LIMIT 1');
    $employee->execute([$userId]);
    if (!$employee->fetchColumn()) {
        $pdo->prepare('INSERT INTO employees (id, user_id, email, employee_number, id_number, department, job_title, onboarding_status) VALUES (?, ?, ?, ?, ?, ?, ?, "active")')->execute([$employeeId, $userId, $email, 'IT-ADMIN-001', 'IT-ADMIN-001', 'IT Support', 'System Administrator']);
    }
    $pdo->commit();
    echo "Admin account provisioned in WAMP MariaDB.\n";
} catch (Throwable $error) {
    $pdo->rollBack();
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
