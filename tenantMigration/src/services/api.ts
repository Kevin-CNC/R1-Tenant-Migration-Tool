import { MSPAccount, MigrationResult, Region, TenantCreationData, FieldConfig } from "../types";
import { GET, POST, PUT, DELETE, POSTFormEncoded } from "./httpReqs";
import { fetch } from "@tauri-apps/plugin-http";
import { writeTextFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { invoke } from '@tauri-apps/api/core';

// Venues query interfaces
interface VenuesQueryParams {
  fields: string[];
  searchTargetFields: string[];
  filters: Record<string, any>;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  page: number;
  pageSize: number;
  defaultPageSize: number;
  total: number;
}

interface VenuesQueryResponse {
  list: any[];
  totalCount: number;
  hasMore: boolean;
}


const filePath = "userAccounts.json";


// In-memory storage (Populated from actual file storage)
let mspAccounts: MSPAccount[] = [];
let isInitialized = false;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// Field configurations for tenant creation (based on official Postman collection)
const TENANT_FIELD_CONFIGS: FieldConfig[] = [
  // Required fields per Postman collection
  { fieldName: 'name', label: 'Tenant Name', maxLength: 255, minLength: 2, required: true, type: 'string' },
  { fieldName: 'tenant_type', label: 'Tenant Type', maxLength: 25, minLength: 0, required: true, type: 'string' },
  { fieldName: 'service_effective_date', label: 'Service Start Date', maxLength: 255, minLength: 0, required: true, type: 'string' },
  { fieldName: 'service_expiration_date', label: 'Service End Date', maxLength: 255, minLength: 0, required: true, type: 'string' },
  { fieldName: 'admin_email', label: 'Admin Email', maxLength: 255, minLength: 0, required: true, type: 'string' },
  { fieldName: 'admin_firstname', label: 'Admin First Name', maxLength: 64, minLength: 0, required: true, type: 'string' },
  { fieldName: 'admin_lastname', label: 'Admin Last Name', maxLength: 64, minLength: 0, required: true, type: 'string' },
  { fieldName: 'admin_role', label: 'Admin Role', maxLength: 255, minLength: 0, required: true, type: 'string' },
  // Optional address fields (must be strings)
  { fieldName: 'street_address', label: 'Street Address', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'city', label: 'City', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'state', label: 'State', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'country', label: 'Country', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'postal_code', label: 'Postal Code', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'phone_number', label: 'Phone Number', maxLength: 255, minLength: 0, required: false, type: 'string' },
  { fieldName: 'fax_number', label: 'Fax Number', maxLength: 255, minLength: 0, required: false, type: 'string' },
];

/**
 * Callback type for requesting user input
 */
export type InputRequester = (
  fieldName: string,
  label: string,
  currentValue: string | null,
  config: FieldConfig
) => Promise<string | null>;

/**
 * Validate and collect missing required fields from user
 */
export const collectMissingFields = async (
  data: Partial<TenantCreationData>,
  inputRequester: InputRequester
): Promise<TenantCreationData> => {
  const result = { ...data } as any;

  for (const config of TENANT_FIELD_CONFIGS) {
    const fieldName = config.fieldName;
    const currentValue = result[fieldName];

    // Skip non-string fields (objects/arrays will be handled separately)
    if (config.type !== 'string') {
      if (!currentValue) {
        if (config.type === 'object') {
          result[fieldName] = {};
        } else if (config.type === 'array') {
          result[fieldName] = [];
        }
      }
      continue;
    }

    // Check if field is null, undefined, or empty string
    if (currentValue === null || currentValue === undefined || currentValue === '') {
      const userInput = await inputRequester(
        fieldName,
        config.label,
        currentValue,
        config
      );

      // If user provided input, use it; otherwise keep as empty string
      result[fieldName] = userInput !== null ? userInput : '';
    }
  }

  return result as TenantCreationData;
};


/* Initialize MSP accounts from file storage */
const initializeMSPs = async(): Promise<void> => {
  if (isInitialized) return;

  try{
    const savedData = await readTextFile(filePath, { baseDir: BaseDirectory.AppLocalData });
    mspAccounts = JSON.parse(savedData);
  }catch(e){
    console.log("No existing MSP accounts found, starting fresh.");
    mspAccounts = [];
  }

  isInitialized = true;
}

/* Save MSP accounts to file */
const saveMSPsToFile = async (): Promise<void> => {
  try{
    await writeTextFile(filePath, JSON.stringify(mspAccounts, null, 2), { baseDir: BaseDirectory.AppLocalData });
    console.log("MSP accounts saved successfully");
  } catch (e){
    console.error("File save error:", e);
    throw new Error(`Failed to save MSP accounts to file: ${e instanceof Error ? e.message : String(e)}`);
  }
}


/* Fetch region-based URL */
function getRegionUrl(region: Region): string {
  switch (region) {
    case "Europe":
      return "https://eu.ruckus.cloud";
    case "Asia":
      return "https://asia.ruckus.cloud";
    case "North America":
      return "https://ruckus.cloud";
    default:
      throw new Error("Invalid region selected");
  }
}

function getAPIUrlByRegion(region: Region): string {
  switch (region) {
    case "Europe":
      return "https://api.eu.ruckus.cloud";
    case "Asia":
      return "https://api.asia.ruckus.cloud";
    case "North America":
      return "https://api.ruckus.cloud";
    default:
      throw new Error("Invalid region selected");
  }
}

/* Fetch JWT for a given MSP account */
export const fetchToken = async(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  region: Region
): Promise<string> => {
  const URL = `${getRegionUrl(region)}/oauth2/token/${tenantId}`;
  console.log(URL);
  
  const formData = new URLSearchParams();
  formData.append('grant_type', 'client_credentials');
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  
  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data: TokenResponse = await response.json();
    return data.access_token;
  } catch (e){
    console.log(e);
    throw new Error("Failed to fetch token. Please check your credentials.");
  }
}

/**
 * Add a new MSP account
 */
export const addMSPAccount = async (
  tenantId: string,
  clientId: string,
  clientSecret: string,
  region: Region
): Promise<MSPAccount> => {
  await initializeMSPs(); // ADD THIS LINE

  const JWToken = await fetchToken(tenantId, clientId, clientSecret, region); 

  console.log(`Fetched JWT for ${tenantId}:`, JWToken);

  const newAccount: MSPAccount = {
    id: `msp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `MSP Account (${tenantId.substring(0, 8)}...)`,
    tenantId,
    clientId,
    clientSecret,
    JWToken,
    region,
  };

  mspAccounts.push(newAccount);
  await saveMSPsToFile();
  return newAccount;
};

/**
 * Get all MSP accounts for a region
 */
export const getMSPAccounts = async (region: Region): Promise<MSPAccount[]> => {
  await initializeMSPs();
  return mspAccounts.filter((account) => account.region === region);
};

/**
 * Delete an MSP account
 */
export const deleteMSPAccount = async (accountId: string): Promise<boolean> => {
  await initializeMSPs(); // ADD THIS LINE TOO
  const index = mspAccounts.findIndex((acc) => acc.id === accountId);
  if (index > -1) {
    mspAccounts.splice(index, 1);
    await saveMSPsToFile();
    return true;
  }
  return false;
};

/**
 * Perform tenant migration between two MSP accounts
 */
export const performTenantMigration = async (
  sourceMspId: string,
  targetMspId: string,
  tenantIds: string[],
  inputRequester: InputRequester
): Promise<MigrationResult> => {
  await initializeMSPs();

  // Simulate some failures randomly
  const migratedTenants: string[] = [];
  const failedTenants: string[] = [];

  const sourceMSP = mspAccounts.find((a) => a.id === sourceMspId);
  const targetMSP = mspAccounts.find((a) => a.id === targetMspId);

  if (!sourceMSP || !targetMSP) {
    throw new Error(`One of the MSP accounts (ID ${sourceMspId}) not found`);
  }
  
  console.log(`Starting migration with source MSP: ${sourceMSP.name}`);

  for (const tenantId of tenantIds) {
    try {
      console.log(`Migrating tenant ${tenantId}...`);
      const sessionToken = await fetchToken(sourceMSP.tenantId, sourceMSP.clientId, sourceMSP.clientSecret, sourceMSP.region);
      const targetSessionToken = await fetchToken(targetMSP.tenantId, targetMSP.clientId, targetMSP.clientSecret, targetMSP.region);

      const resp = await invoke<string>('get_tenant', {
        apiUrl: getAPIUrlByRegion(sourceMSP.region),
        tenantId: tenantId,
        token: sessionToken.trim()
      });

      const data = JSON.parse(resp);
      const sourceTenantId = data.tenant_id;

      console.log(`✓ Successfully fetched data for tenant ${tenantId}:`, data);
      

      const venues = await getVenues(sourceTenantId, 
        sessionToken, 
        sourceMSP.region);

      console.log(`✓ Successfully fetched venues for tenant ${tenantId}:`, venues);
      console.log(venues);

      /* const tenantPayload: any = {
        // REQUIRED fields
        name: data.name || '',

        tenant_type: 'MSP_EC',
        service_effective_date: formatDate(data.service_effective_date) || new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z',
        service_expiration_date: formatDate(data.service_expiration_date) || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0] + 'Z',
        admin_email: data.admin_email || '',
        admin_firstname: data.admin_firstname || '',
        admin_lastname: data.admin_lastname || '',
        admin_role: 'PRIME_ADMIN',
        

        licenses: data.licenses || { trialAction: 'UNASSIGNED', assignments: [] },
        admin_delegations: data.admin_delegations || [],
        delegations: data.delegations || [],
      };

      // Optional address fields (ensure they are strings)
      if (data.street_address) tenantPayload.street_address = String(data.street_address);
      if (data.city) tenantPayload.city = String(data.city);
      if (data.state) tenantPayload.state = String(data.state);
      if (data.country) tenantPayload.country = String(data.country);
      if (data.postal_code) tenantPayload.postal_code = String(data.postal_code);
      if (data.phone_number) tenantPayload.phone_number = String(data.phone_number);
      if (data.fax_number) tenantPayload.fax_number = String(data.fax_number);

      console.log('Submitting tenant creation request to /mspCustomers...');
      console.log('Payload:', JSON.stringify(tenantPayload, null, 2));
      
      const putResp = await invoke<string>('put_tenant', {
        apiUrl: getAPIUrlByRegion(targetMSP.region),
        tenantId: targetMSP.tenantId,
        token: targetSessionToken.trim(),
        tenantData: tenantPayload
      });

      const putData = JSON.parse(putResp);
      console.log('✓ Tenant created successfully:', putData);

      // Add to migrated list
      migratedTenants.push(tenantId); */
      
    } catch (error) {
      console.error(`Error migrating tenant ${tenantId}:`, error);
      failedTenants.push(tenantId);
    }
  }

  return {
    success: failedTenants.length === 0,
    message:
      failedTenants.length === 0
        ? `Successfully migrated ${migratedTenants.length} tenant(s)`
        : `Migration completed with ${failedTenants.length} failure(s)`,
    migratedTenants,
    failedTenants,
  };
};

/**
 * Validate MSP credentials
 */
export const validateMSPCredentials = async (
  tenantId: string,
  clientId: string,
  clientSecret: string,
  region: Region
): Promise<{ valid: boolean; message: string }> => {

  // Basic validation
  if (!tenantId || tenantId.length < 32) {
    return { valid: false, message: "Invalid Tenant ID format" };
  }
  if (!clientId || clientId.length < 32) {
    return { valid: false, message: "Invalid Client ID format" };
  }
  if (!clientSecret || clientSecret.length < 32) {
    return { valid: false, message: "Invalid Client Secret format" };
  }

  const JWToken = await fetchToken(tenantId, clientId, clientSecret, region); 

  // Simulate 95% validation success
  if (JWToken) {
    return { valid: true, message: "Credentials validated successfully; A JWT was returned." };
  }

  return { valid: false, message: "Failed to authenticate with provided credentials" };
};

/**
 * Get tenants for an MSP account
 */
export const getTenantsList = async (_mspId: string): Promise<string[]> => {
  // Return dummy tenant IDs
  return [
    "tenant-001",
    "tenant-002",
    "tenant-003",
    "tenant-004",
    "tenant-005",
  ];
};

/**
 * Query venues for a tenant
 */
export const getVenues = async (
  tenantId: string,
  token: string,
  region: Region,
  customParams?: Partial<VenuesQueryParams>
): Promise<VenuesQueryResponse> => {
  // Default query parameters
  const defaultQueryParams: VenuesQueryParams = {
    fields: [
      "check-all", "name", "description", "city", "country",
      "networks", "aggregatedApStatus", "switches", "switchClients",
      "clients", "apWiredClients", "edges", "iotControllers", "cog",
      "latitude", "longitude", "status", "id", "isEnforced",
      "addressLine", "tagList"
    ],
    searchTargetFields: ["name", "addressLine", "description", "tagList"],
    filters: {},
    sortField: "name",
    sortOrder: "ASC",
    page: 1,
    pageSize: 10,
    defaultPageSize: 10,
    total: 0
  };

  // Merge custom parameters with defaults
  const queryParams = { ...defaultQueryParams, ...customParams };

  try {
    console.log(`Querying venues for tenant ${tenantId} in region ${region}...`);
    console.log('Query parameters:', JSON.stringify(queryParams, null, 2));

    const response = await invoke<string>('query_venues', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      queryData: queryParams
    });

    const data: VenuesQueryResponse = JSON.parse(response);
    console.log('✓ Venues query successful:');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error querying venues:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Parse error message for HTTP status codes
    if (errorMessage.includes('HTTP 401')) {
      throw new Error('Unauthorized: Invalid or expired token');
    } else if (errorMessage.includes('HTTP 403')) {
      throw new Error('Forbidden: Insufficient permissions to access venues');
    } else if (errorMessage.includes('HTTP 404')) {
      throw new Error('Not Found: Venues endpoint not available');
    } else if (errorMessage.includes('HTTP 500')) {
      throw new Error('Internal Server Error: API server encountered an error');
    } else {
      throw new Error(`Failed to query venues: ${errorMessage}`);
    }
  }
};
