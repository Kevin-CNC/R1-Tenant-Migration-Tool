// Types for the Tenant Migration application

export type Region = "Asia" | "Europe" | "North America" | null;

export interface MSPAccount {
  id: string;
  name: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  JWToken: string;
  region: Region;
}

export interface TenantMigrationRequest {
  sourceMspId: string;
  targetMspId: string;
  tenantIds: string[];
}

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedTenants: string[];
  failedTenants: string[];
}

// App state types
export type AppStep = 
  | "region-select" 
  | "main-menu" 
  | "add-msp" 
  | "tenant-migration"
  | "manage-accounts";

export interface AppState {
  currentStep: AppStep;
  selectedRegion: Region;
  mspAccounts: MSPAccount[];
}