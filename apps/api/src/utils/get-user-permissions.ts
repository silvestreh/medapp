export async function getUserPermissions(
  app: any, userId: string, organizationId: string
): Promise<string[]> {
  const userRoles: any[] = await app.service('user-roles').find({
    query: { userId, organizationId },
    paginate: false
  } as any);

  const roleIds: string[] = userRoles.map((ur: any) => ur.roleId);

  if (roleIds.length === 0) {
    return [];
  }

  const roles = await Promise.all(
    roleIds.map((id: string) => app.service('roles').get(id))
  );

  return [...new Set(roles.flatMap((r: any) => r.permissions as string[]))];
}
