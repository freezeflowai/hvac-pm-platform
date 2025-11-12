import type { User, ClientUser } from "@shared/schema";

// Discriminated union for authenticated users
export type ContractorAuthUser = User & { userType: 'contractor' };
export type ClientPortalAuthUser = ClientUser & { userType: 'client' };
export type AuthUser = ContractorAuthUser | ClientPortalAuthUser;

// Serialized form for session storage
export type SerializedAuthUser = {
  id: string;
  userType: 'contractor' | 'client';
};

// Type guards
export function isContractor(user: AuthUser): user is ContractorAuthUser {
  return user.userType === 'contractor';
}

export function isClient(user: AuthUser): user is ClientPortalAuthUser {
  return user.userType === 'client';
}
