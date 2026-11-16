import { describe, expect, it } from 'vitest';
import { canManageMember, rolesActorCanAssign } from './team';

describe('team role rules', () => {
  it('lets only owners assign the admin role', () => {
    expect(rolesActorCanAssign('owner')).toEqual(['admin', 'member', 'viewer']);
    expect(rolesActorCanAssign('admin')).toEqual(['member', 'viewer']);
    expect(rolesActorCanAssign('member')).toEqual([]);
    expect(rolesActorCanAssign('viewer')).toEqual([]);
  });

  it('prevents self-management and changes to the owner', () => {
    const owner = { id: 'user-owner', role: 'owner' as const };
    expect(canManageMember(owner, { userId: owner.id, role: 'owner' }, 'member')).toBe(false);
    expect(canManageMember({ id: 'user-admin', role: 'admin' }, { userId: 'user-owner', role: 'owner' }, 'member')).toBe(
      false,
    );
  });

  it('prevents admins from managing another admin or granting admin', () => {
    const admin = { id: 'user-admin', role: 'admin' as const };
    expect(canManageMember(admin, { userId: 'user-other', role: 'admin' }, 'member')).toBe(false);
    expect(canManageMember(admin, { userId: 'user-member', role: 'member' }, 'admin')).toBe(false);
    expect(canManageMember(admin, { userId: 'user-member', role: 'member' }, 'viewer')).toBe(true);
  });

  it('allows owners to manage non-owner members but not themselves', () => {
    const owner = { id: 'user-owner', role: 'owner' as const };
    expect(canManageMember(owner, { userId: 'user-admin', role: 'admin' }, 'member')).toBe(true);
    expect(canManageMember(owner, { userId: 'user-admin', role: 'admin' })).toBe(true);
  });

  it('does not allow members or viewers to manage anyone', () => {
    expect(canManageMember({ id: 'user-member', role: 'member' }, { userId: 'user-viewer', role: 'viewer' })).toBe(
      false,
    );
    expect(canManageMember({ id: 'user-viewer', role: 'viewer' }, { userId: 'user-member', role: 'member' })).toBe(
      false,
    );
  });
});
