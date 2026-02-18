export async function getUserPermissions(
  app: any, userId: string, primaryRoleId: string
): Promise<string[]> {
  const additionalRoles: any[] = await app.service('user-roles').find({
    query: { userId },
    paginate: false
  } as any);

  const roleIds: string[] = additionalRoles.map((ur: any) => ur.roleId);
  if (!roleIds.includes(primaryRoleId)) {
    roleIds.push(primaryRoleId);
  }

  const roles = await Promise.all(
    roleIds.map((id: string) => app.service('roles').get(id))
  );

  return [...new Set(roles.flatMap((r: any) => r.permissions as string[]))];
}
