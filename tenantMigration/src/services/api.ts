import { MSPAccount, MigrationResult, Region } from "../types";
import { GET, POST, PUT, DELETE, POSTFormEncoded } from "./httpReqs";
import { fetch } from "@tauri-apps/plugin-http";
import { writeTextFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { invoke } from '@tauri-apps/api/core';


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
  tenantIds: string[]
): Promise<MigrationResult> => {
  await initializeMSPs();

  // Simulate some failures randomly
  const migratedTenants: string[] = [];
  const failedTenants: string[] = [];

  const sourceMSP = mspAccounts.find((a) => a.id === sourceMspId);
  
  if (!sourceMSP) {
    throw new Error(`Source MSP account with ID ${sourceMspId} not found`);
  }
  
  console.log(`Starting migration with source MSP: ${sourceMSP.name}`);

  for (const tenantId of tenantIds) {
    try {
      console.log(`Migrating tenant ${tenantId}...`);
      const sessionToken = await fetchToken(sourceMSP.tenantId, sourceMSP.clientId, sourceMSP.clientSecret, sourceMSP.region);
      //console.log(sessionToken);
      //console.log(`${getAPIUrlByRegion(sourceMSP.region)}/tenants/${tenantId}`)

      const myHeaders = new Headers();
      myHeaders.append("Authorization", `Bearer ${sessionToken.trim()}`);
      myHeaders.append('Accept', 'application/json');
      //console.log(Object.fromEntries(myHeaders.entries()));

      const resp = await invoke<string>('get_tenant', {
        apiUrl: getAPIUrlByRegion(sourceMSP.region),
        tenantId: tenantId,
        token: sessionToken.trim()
      });

      const data = JSON.parse(resp);
      console.log(`✓ Successfully fetched data for tenant ${tenantId}:`, data);
      

      const putResp = await invoke<string>('put_tenant', {
        apiUrl: getAPIUrlByRegion(sourceMSP.region),
        tenantId: tenantId,
        token: sessionToken.trim(),
        tenant_data: data
      });

      const putData = JSON.parse(putResp);
      console.log(putData);

      // Add to migrated list
      migratedTenants.push(tenantId);
      
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
