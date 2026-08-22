import { query } from '../config/database.js';

export async function audit(adminId, action, entityType, entityId, oldValues, newValues) {
  await query(
    `INSERT INTO admin_audit_logs
       (admin_user_id, action, entity_type, entity_id, old_values, new_values)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, action, entityType, entityId, oldValues ?? null, newValues ?? null]
  );
}
