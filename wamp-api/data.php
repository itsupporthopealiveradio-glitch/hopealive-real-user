<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$user = requireSession();
$input = input();
$table = (string)($input['table'] ?? '');
$operation = (string)($input['operation'] ?? 'select');
$allowed = ['users', 'employees', 'attendance_records', 'audit_logs', 'guest_invites', 'guest_verifications', 'biometric_enrollments', 'security_events', 'qr_sessions'];
if (!in_array($table, $allowed, true)) respond(['error' => 'Table access denied'], 403);
if (in_array($table, ['users', 'employees', 'audit_logs', 'security_events'], true)) requireSession(true);

$pdo = db();
$filters = is_array($input['filters'] ?? null) ? $input['filters'] : [];
$params = [];
$where = [];
foreach ($filters as $filter) {
    $column = (string)($filter['column'] ?? '');
    $operator = (string)($filter['operator'] ?? '=');
    if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column) || !in_array($operator, ['=', '!=', '<', '>', '<=', '>=', 'IS', 'IS NOT'], true)) respond(['error' => 'Invalid filter'], 422);
    $qualified = $table === 'attendance_records' ? "attendance_records.`$column`" : "`$column`";
    if (($filter['value'] ?? null) === null && in_array($operator, ['IS', 'IS NOT'], true)) $where[] = "$qualified $operator NULL";
    else { $where[] = "$qualified $operator ?"; $params[] = $filter['value']; }
}
$whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';

if ($operation === 'select') {
    $columns = '*';
    if (!empty($input['columns']) && is_array($input['columns'])) {
        $safeColumns = array_filter($input['columns'], fn($column) => preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', (string)$column));
        if ($safeColumns) $columns = implode(', ', array_map(fn($column) => "`$column`", $safeColumns));
    }
    if ($table === 'attendance_records') $columns = 'attendance_records.*, employees.email employee_email, employees.first_name employee_first_name, employees.last_name employee_last_name, employees.department employee_department';
    $sql = "SELECT $columns FROM `$table`" . ($table === 'attendance_records' ? ' LEFT JOIN employees ON employees.id = attendance_records.employee_id' : '') . $whereSql;
    if (!empty($input['order'])) {
        $column = (string)($input['order']['column'] ?? 'created_at');
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $column)) $sql .= " ORDER BY `$column` " . (!empty($input['order']['ascending']) ? 'ASC' : 'DESC');
    }
    if (!empty($input['limit'])) $sql .= ' LIMIT ' . min(500, max(1, (int)$input['limit']));
    $stmt = $pdo->prepare($sql); $stmt->execute($params); $rows = $stmt->fetchAll();
    respond(['data' => !empty($input['single']) ? ($rows[0] ?? null) : $rows, 'error' => null]);
}

if ($operation === 'insert' && is_array($input['values'] ?? null)) {
    $values = $input['values']; $columns = array_keys($values);
    if ($table === 'employees') {
        $values['id'] ??= sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
        if (array_key_exists('org_id', $values)) { $values['organization_id'] = $values['org_id']; unset($values['org_id']); }
        $values['employee_id'] ??= $values['employee_number'] ?? null;
    }
    if ($table === 'attendance_records') {
        $values['id'] ??= sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
        if (isset($values['clock_in_at']) && !isset($values['clock_in'])) $values['clock_in'] = $values['clock_in_at'];
        if (isset($values['clock_out_at']) && !isset($values['clock_out'])) $values['clock_out'] = $values['clock_out_at'];
    }
    $columns = array_keys($values);
    if (!$columns || array_filter($columns, fn($column) => !preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', (string)$column))) respond(['error' => 'Invalid insert'], 422);
    $sql = "INSERT INTO `$table` (" . implode(',', array_map(fn($c) => "`$c`", $columns)) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')';
    $stmt = $pdo->prepare($sql); $stmt->execute(array_values($values)); respond(['data' => $values, 'error' => null]);
}

if ($operation === 'update' && is_array($input['values'] ?? null) && $where) {
    $values = $input['values']; $set = [];
    foreach ($values as $column => $value) { if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', (string)$column)) respond(['error' => 'Invalid update'], 422); $set[] = "`$column` = ?"; }
    $stmt = $pdo->prepare("UPDATE `$table` SET " . implode(', ', $set) . $whereSql); $stmt->execute([...array_values($values), ...$params]); respond(['data' => $values, 'error' => null]);
}

if ($operation === 'delete' && $where) {
    $stmt = $pdo->prepare("DELETE FROM `$table`" . $whereSql); $stmt->execute($params); respond(['data' => null, 'error' => null]);
}
respond(['error' => 'Unsupported operation'], 400);
