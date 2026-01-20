import { MSPAccount, MigrationResult, Region } from "../types";
import { GET, POST, PUT, DELETE, POSTFormEncoded } from "./httpReqs";
import { fetch } from "@tauri-apps/plugin-http";


// In-memory storage (will be replaced by actual backend storage)
let mspAccounts: MSPAccount[] = [];

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
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
  return newAccount;
};

/**
 * Get all MSP accounts for a region
 */
export const getMSPAccounts = async (region: Region): Promise<MSPAccount[]> => {
  return mspAccounts.filter((account) => account.region === region);
};

/**
 * Delete an MSP account
 */
export const deleteMSPAccount = async (accountId: string): Promise<boolean> => {
  const index = mspAccounts.findIndex((acc) => acc.id === accountId);
  if (index > -1) {
    mspAccounts.splice(index, 1);
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
  tenantIds: string[]
): Promise<MigrationResult> => {

  // Simulate some failures randomly
  const migratedTenants: string[] = [];
  const failedTenants: string[] = [];

  for (const tenantId of tenantIds) {
    // 90% success rate simulation
    if (Math.random() > 0.1) {
      migratedTenants.push(tenantId);
    } else {
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
