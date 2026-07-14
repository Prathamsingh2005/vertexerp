export const ROLE_CODES = [
  "owner",
  "admin",
  "accountant",
  "sales_executive",
  "purchase_manager",
  "inventory_manager",
  "viewer",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const PERMISSION_CODES = [
  "dashboard.view",
  "company.view",
  "company.edit",
  "company.delete",
  "team.view",
  "team.manage",
  "roles.view",
  "roles.manage",
  "ledgers.view",
  "ledgers.create",
  "ledgers.edit",
  "ledgers.delete",
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.delete",
  "sales.view",
  "sales.create",
  "sales.edit",
  "sales.delete",
  "credit_notes.view",
  "credit_notes.create",
  "credit_notes.void",
  "purchase.view",
  "purchase.create",
  "purchase.edit",
  "purchase.delete",
  "debit_notes.view",
  "debit_notes.create",
  "debit_notes.void",
  "expenses.view",
  "expenses.create",
  "expenses.edit",
  "expenses.delete",
  "payments.view",
  "payments.create",
  "payments.edit",
  "payments.delete",
  "outstanding.view",
  "accounting.view",
  "accounting.manage",
  "accounting.lock",
  "reports.view",
  "gst_reports.view",
  "audit.view",
  "backup.export",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export type CompanyAccess = {
  companyId: string;
  companyName: string;
  roleCode: RoleCode | string;
  roleName: string;
  memberStatus: "active" | "inactive" | string;
  permissionCodes: PermissionCode[];
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  sales_executive: "Sales Executive",
  purchase_manager: "Purchase Manager",
  inventory_manager: "Inventory Manager",
  viewer: "Viewer",
};

export function hasPermission(
  access: CompanyAccess | null | undefined,
  permission: PermissionCode,
) {
  return Boolean(
    access?.memberStatus === "active" &&
      access.permissionCodes.includes(permission),
  );
}

export function hasAnyPermission(
  access: CompanyAccess | null | undefined,
  permissions: PermissionCode[],
) {
  return permissions.some((permission) =>
    hasPermission(access, permission),
  );
}

export function hasAllPermissions(
  access: CompanyAccess | null | undefined,
  permissions: PermissionCode[],
) {
  return permissions.every((permission) =>
    hasPermission(access, permission),
  );
}

export function normalizeCompanyAccessRow(
  row:
    | {
        company_id?: unknown;
        company_name?: unknown;
        role_code?: unknown;
        role_name?: unknown;
        member_status?: unknown;
        permission_codes?: unknown;
      }
    | null
    | undefined,
): CompanyAccess | null {
  if (
    !row ||
    typeof row.company_id !== "string" ||
    typeof row.company_name !== "string" ||
    typeof row.role_code !== "string"
  ) {
    return null;
  }

  const rawPermissions = Array.isArray(row.permission_codes)
    ? row.permission_codes
    : [];

  const validPermissions = new Set<string>(PERMISSION_CODES);

  return {
    companyId: row.company_id,
    companyName: row.company_name,
    roleCode: row.role_code,
    roleName:
      typeof row.role_name === "string"
        ? row.role_name
        : ROLE_LABELS[row.role_code as RoleCode] || row.role_code,
    memberStatus:
      typeof row.member_status === "string"
        ? row.member_status
        : "inactive",
    permissionCodes: rawPermissions.filter(
      (permission): permission is PermissionCode =>
        typeof permission === "string" &&
        validPermissions.has(permission),
    ),
  };
}