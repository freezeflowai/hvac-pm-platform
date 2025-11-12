import type { User, ClientUser } from "@shared/schema";

// Base authenticated user shape with common fields
export type BaseAuthUser = {
  id: string;
  email: string;
  password: string;
  userType: 'contractor' | 'client';
};

// Discriminated union for authenticated users
export type ContractorAuthUser = BaseAuthUser & {
  userType: 'contractor';
  isAdmin: boolean;
};

export type ClientPortalAuthUser = BaseAuthUser & {
  userType: 'client';
  clientId: string;
  createdAt: Date;
};

export type AuthUser = ContractorAuthUser | ClientPortalAuthUser;

// Serialized form for session storage
export type SerializedAuthUser = {
  id: string;
  userType: 'contractor' | 'client';
};

// Type guards
export function isContractor(user: BaseAuthUser): user is ContractorAuthUser {
  return user.userType === 'contractor';
}

export function isClient(user: BaseAuthUser): user is ClientPortalAuthUser {
  return user.userType === 'client';
}
