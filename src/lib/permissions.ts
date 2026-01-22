// Helper para verificar se usuário tem permissão
export function hasPermission(user: any, permissionId: string): boolean {
  if (!user) return false;
  
  // ADMIN tem todas as permissões
  if (user.role === 'ADMIN') return true;
  
  const userPermissions = user.permissions || [];
  return userPermissions.includes(permissionId);
}
