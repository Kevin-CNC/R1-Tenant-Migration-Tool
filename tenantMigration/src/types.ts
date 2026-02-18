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

// Tenant creation data structure
export interface TenantCreationData {
  account_id: string;
  name: string;
  street_address: string;
  state: string;
  country: string;
  postal_code: string;
  phone_number: string;
  fax_number: string;
  city: string;
  mapping_url: string;
  service_effective_date: string;
  service_expiration_date: string;
  admin_email: string;
  admin_firstname: string;
  admin_lastname: string;
  admin_role: string;
  tenant_type: string;
  licenses: object;
  delegations: object[];
  admin_delegations: object[];
  tier: string;
  privilege_group_ids: string[];
  privacyFeatures: object[];
  propertyCode: string;
  default_template_activation_id: string;
}

export interface FieldConfig {
  fieldName: keyof TenantCreationData;
  label: string;
  maxLength: number;
  minLength: number;
  required: boolean;
  type: 'string' | 'object' | 'array';
}