<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
requireSession(true);
$data=input(); $name=(string)($data['name']??''); $p=is_array($data['params']??null)?$data['params']:[]; $pdo=db();
if($name==='admin_delete_employee'){ $s=$pdo->prepare('UPDATE employees SET status="inactive", onboarding_status="inactive", end_date=COALESCE(end_date,CURDATE()) WHERE id=?');$s->execute([$p['target_emp_id']??'']);respond(['data'=>true,'error'=>null]); }
if($name==='admin_reset_employee_pin'){ $s=$pdo->prepare('SELECT user_id FROM employees WHERE id=? LIMIT 1');$s->execute([$p['p_employee_id']??'']);$uid=$s->fetchColumn();if(!$uid)respond(['error'=>'Employee not found'],404);$pin=(string)random_int(1000,9999);$pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($pin,PASSWORD_DEFAULT),$uid]);respond(['data'=>['new_pin'=>$pin,'reset_count'=>1],'error'=>null]); }
if($name==='edit_employee_info'){ $id=$p['p_employee_id']??'';$parts=preg_split('/\s+/',trim(($p['p_first_name']??'').' '.($p['p_last_name']??'')),2);$s=$pdo->prepare('UPDATE employees SET first_name=?,last_name=?,full_name=?,id_number=?,department=?,role=? WHERE id=?');$s->execute([$parts[0]??'', $parts[1]??'', trim(($p['p_first_name']??'').' '.($p['p_last_name']??'')),$p['p_id_number']??null,$p['p_department']??null,$p['p_role']??'employee',$id]);respond(['data'=>true,'error'=>null]); }
if($name==='save_biometric_enrollment'){ $id=$p['p_employee_id']??'';$desc=json_encode($p['p_face_descriptor']??$p['face_descriptor']??[]);$s=$pdo->prepare('INSERT INTO biometric_enrollments (id,employee_id,face_image_path,face_template_hash,consent_at,status) VALUES (?,?,?,?,NOW(),"active") ON DUPLICATE KEY UPDATE face_template_hash=VALUES(face_template_hash),updated_at=NOW(),status="active"');$s->execute([bin2hex(random_bytes(16)),$id,'wamp://biometric',$desc]);respond(['data'=>true,'error'=>null]);}
respond(['error'=>'Unsupported operation'],400);
