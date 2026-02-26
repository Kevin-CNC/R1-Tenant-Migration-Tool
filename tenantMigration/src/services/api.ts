import { MSPAccount, ECAccount, MigrationResult, Region } from "../types";
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

// Wifi Networks interfaces
interface WifiNetworksQueryParams {
  searchString: string;
  searchTargetFields: string[];
  fields: string[];
  page: number;
  pageSize: number;
  defaultPageSize: number;
  total: number;
  sortField: string;
  sortOrder: 'ASC' | 'DESC';
  filters: Record<string, any>;
  groupFilters: any[];
}


interface networkAPsQueryParams {
  fields: string[];
  pageSize: number;
  page?: number;
  total?: number;
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


// ─── End Customer (EC) Account Storage ───────────────────────────────────────

const ecFilePath = "ecAccounts.json";
let ecAccounts: ECAccount[] = [];
let ecIsInitialized = false;

/* Initialize EC accounts from file storage */
const initializeECs = async (): Promise<void> => {
  if (ecIsInitialized) return;

  try {
    const savedData = await readTextFile(ecFilePath, { baseDir: BaseDirectory.AppLocalData });
    ecAccounts = JSON.parse(savedData);
  } catch (e) {
    console.log("No existing EC accounts found, starting fresh.");
    ecAccounts = [];
  }

  ecIsInitialized = true;
};

/* Save EC accounts to file */
const saveECsToFile = async (): Promise<void> => {
  try {
    await writeTextFile(ecFilePath, JSON.stringify(ecAccounts, null, 2), { baseDir: BaseDirectory.AppLocalData });
    console.log("EC accounts saved successfully");
  } catch (e) {
    console.error("File save error:", e);
    throw new Error(`Failed to save EC accounts to file: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Add a new End Customer account tied to an MSP
 */
export const addECAccount = async (
  name: string,
  tenantId: string,
  mspId: string,
  region: Region
): Promise<ECAccount> => {
  await initializeECs();

  const newEC: ECAccount = {
    id: `ec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    tenantId,
    mspId,
    region,
  };

  ecAccounts.push(newEC);
  await saveECsToFile();
  return newEC;
};

/**
 * Get EC accounts, optionally filtered by region
 */
export const getECAccounts = async (region?: Region): Promise<ECAccount[]> => {
  await initializeECs();
  if (region) {
    return ecAccounts.filter((ec) => ec.region === region);
  }
  return ecAccounts;
};

/**
 * Delete an EC account
 */
export const deleteECAccount = async (ecId: string): Promise<boolean> => {
  await initializeECs();
  const index = ecAccounts.findIndex((ec) => ec.id === ecId);
  if (index > -1) {
    ecAccounts.splice(index, 1);
    await saveECsToFile();
    return true;
  }
  return false;
};


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
 * Perform tenant migration between two End Customer accounts
 */
export const performTenantMigration = async (
  sourceECId: string,
  targetECId: string
): Promise<MigrationResult> => {
  await initializeMSPs();
  await initializeECs();

  const migratedTenants: string[] = [];
  const failedTenants: string[] = [];

  const sourceEC = ecAccounts.find((a) => a.id === sourceECId);
  const targetEC = ecAccounts.find((a) => a.id === targetECId);

  if (!sourceEC || !targetEC) {
    throw new Error(`One of the EC accounts not found`);
  }

  const sourceMSP = mspAccounts.find((a) => a.id === sourceEC.mspId);
  const targetMSP = mspAccounts.find((a) => a.id === targetEC.mspId);

  if (!sourceMSP || !targetMSP) {
    throw new Error(`Parent MSP account not found for one of the EC accounts`);
  }

  console.log(`Starting migration: EC "${sourceEC.name}" → EC "${targetEC.name}"`);
  console.log(`Source MSP: ${sourceMSP.name} | Target MSP: ${targetMSP.name}`);

  const givenSourceTenantID = sourceEC.tenantId;
  const givenTargetTenantID = targetEC.tenantId;

  try {
    console.log(`Migrating EC tenant ${givenSourceTenantID}...`);

    const sourceSessionToken = await fetchToken(
      sourceMSP.tenantId, sourceMSP.clientId, sourceMSP.clientSecret, sourceMSP.region
    );

    // If they are the same MSP, reuse token to not make another unnecessary token request
    const targetSessionToken = (sourceMSP.tenantId === targetMSP.tenantId) ? sourceSessionToken
    : await fetchToken(
      targetMSP.tenantId, targetMSP.clientId, targetMSP.clientSecret, targetMSP.region
    );

    // Source tenant data retrieval here
    const sourceTenResponse = await invoke<string>('get_tenant', {
      apiUrl: getAPIUrlByRegion(sourceMSP.region),
      tenantId: givenSourceTenantID,
      token: sourceSessionToken.trim()
    });

    const sourceTenantData = JSON.parse(sourceTenResponse);
    const sourceTenantId = sourceTenantData.tenant_id;


    // Source tenant data retrieval here
    const targetTenResponse = await invoke<string>('get_tenant', {
      apiUrl: getAPIUrlByRegion(targetMSP.region),
      tenantId: givenTargetTenantID,
      token: targetSessionToken.trim()
    });

    const targetTenantData = JSON.parse(targetTenResponse);
    const targetTenantId = targetTenantData.tenant_id;


    console.log(`✓ Successfully fetched data for tenant ${givenSourceTenantID}:`, sourceTenantData);

    const sourceVenues = await getVenues(
      sourceTenantId,
      sourceSessionToken,
      sourceMSP.region
    );

    console.log(`✓ Successfully fetched venues for tenant ${givenSourceTenantID}:`, sourceVenues);
    console.log(sourceVenues);

    // Process of addition of the venues from the source tenant to the target tenant
    /* for( const venue of sourceVenues.data ){
        const postResponse = await postVenues(
          targetTenantId,
          targetSessionToken,
          targetMSP.region,
          venue
        ) 

        //console.log(postResponse);
    } */ 

    // Get WLans from source tenants
    const sourceWifiNetworks = await query_wNetworks(
      sourceTenantId,
      sourceSessionToken,
      sourceMSP.region
    );


    console.log(`✓ Successfully fetched wifi networks for tenant ${givenSourceTenantID}:`, sourceWifiNetworks);
    console.log(sourceWifiNetworks);


    // Process the addition of all wifi networks




    const sourceAPs = await queryAllAPs(
      sourceTenantId,
      sourceSessionToken,
      sourceMSP.region
    );

    console.log(`✓ Successfully fetched APs for tenant ${givenSourceTenantID}:`, sourceAPs);

    // Target session token is available for future write operations
    console.log(`Target session token obtained for MSP "${targetMSP.name}" (ready for write operations)`);
    void targetSessionToken;

    migratedTenants.push(givenSourceTenantID);
  } catch (error) {
    console.error(`Error migrating EC tenant ${givenSourceTenantID}:`, error);
    failedTenants.push(givenSourceTenantID);
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


// Query APs for a tenant
// Query Wifi Networks for a tenant
export const queryAllAPs = async (
  tenantId: string,
  token: string,
  region: Region,
  customParams?: Partial<networkAPsQueryParams>
): Promise<networkAPsQueryParams> => {
  const defaultQueryParams: networkAPsQueryParams = {
    fields: [
      "name", "description", "nwSubType", "venueApGroups",
      "apSerialNumbers", "apCount", "clientCount", "vlan", "cog",
      "ssid", "vlanPool", "captiveType", "id", "securityProtocol",
      "dsaeOnboardNetwork", "isOweMaster", "owePairNetworkId",
      "tunnelWlanEnable", "isEnforced"
    ],
    page: 1,
    pageSize: 10000,
    total: 0,
  };

  // Merge custom parameters with defaults
  const queryParams = { ...defaultQueryParams, ...customParams };

  try {
    console.log(`Querying wifi networks for tenant ${tenantId} in region ${region}...`);
    console.log('Query parameters:', JSON.stringify(queryParams, null, 2));

    const response = await invoke<string>('query_wNetworks', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      queryData: queryParams
    });

    const data: networkAPsQueryParams = JSON.parse(response);
    console.log('✓ Wifi networks query successful:');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error querying wifi networks:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('HTTP 401')) {
      throw new Error('Unauthorized: Invalid or expired token');
    } else if (errorMessage.includes('HTTP 403')) {
      throw new Error('Forbidden: Insufficient permissions to access wifi networks');
    } else if (errorMessage.includes('HTTP 404')) {
      throw new Error('Not Found: Wifi networks endpoint not available');
    } else if (errorMessage.includes('HTTP 500')) {
      throw new Error('Internal Server Error: API server encountered an error');
    } else {
      throw new Error(`Failed to query wifi networks: ${errorMessage}`);
    }
  }
};


// Query Wifi Networks for an EC tenant
export const query_wNetworks = async (
  tenantId: string,
  token: string,
  region: Region,
  customParams?: Partial<WifiNetworksQueryParams>
): Promise<WifiNetworksQueryParams> => {
  // Default query parameters - CORRECTED
  const defaultQueryParams: WifiNetworksQueryParams = {
    searchString: "",
    searchTargetFields: ["name"],
    fields: [
      "name","description","nwSubType","venueApGroups",
      "apSerialNumbers","apCount","clientCount","vlan",
      "cog","ssid","vlanPool","captiveType","id",
      "securityProtocol","dsaeOnboardNetwork","isOweMaster","owePairNetworkId",
      "tunnelWlanEnable","isEnforced","type","isCloudpathEnabled","enableAccountingService",
      "wlanSecurity","managementFrameProtection","vlanId","passphrase","enable",
      "enableVlanPooling","accountingInterimUpdates","hotspot20Settings","dnsProxyRules",
      "accessControlProfileEnable","maxRate","bssMinimumPhyRate",
      "managementFrameMinimumPhyRate","enableOfdmOnly"
    ],
    page: 1,
    pageSize: 10,
    defaultPageSize: 10,
    total: 0,
    sortField: "name",
    sortOrder: "ASC",
    filters: {},
    groupFilters: []
  };

  // Merge custom parameters with defaults
  const queryParams = { ...defaultQueryParams, ...customParams };

  try {
    console.log(`Querying wifi networks for tenant ${tenantId} in region ${region}...`);
    console.log('Query parameters:', JSON.stringify(queryParams, null, 2));

    const response = await invoke<string>('query_wNetworks', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      queryData: queryParams
    });

    const data: WifiNetworksQueryParams = JSON.parse(response);
    console.log('✓ Wifi networks query successful:');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error querying wifi networks:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('HTTP 401')) {
      throw new Error('Unauthorized: Invalid or expired token');
    } else if (errorMessage.includes('HTTP 403')) {
      throw new Error('Forbidden: Insufficient permissions to access wifi networks');
    } else if (errorMessage.includes('HTTP 404')) {
      throw new Error('Not Found: Wifi networks endpoint not available');
    } else if (errorMessage.includes('HTTP 500')) {
      throw new Error('Internal Server Error: API server encountered an error');
    } else {
      throw new Error(`Failed to query wifi networks: ${errorMessage}`);
    }
  }
};


/**
 * Query APs for an EC tenant
 */
export const queryAPs = async (
  tenantId: string,
  token: string,
  region: Region,
  customParams?: Partial<networkAPsQueryParams>
): Promise<networkAPsQueryParams> => {
  // Default query parameters based on curl command
  const defaultQueryParams: networkAPsQueryParams = {
    fields: [
      "serialNumber", "name", "venueId", "networkStatus", "lanPortStatuses",
      "radioStatuses", "afcStatus", "cellularStatus", "firmwareVersion"
    ],
    pageSize: 10000
  };

  // Merge custom parameters with defaults
  const queryParams = { ...defaultQueryParams, ...customParams };

  try {
    console.log(`Querying APs for tenant ${tenantId} in region ${region}...`);
    console.log('Query parameters:', JSON.stringify(queryParams, null, 2));

    const response = await invoke<string>('query_aps', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      queryData: queryParams
    });

    const data: networkAPsQueryParams = JSON.parse(response);
    console.log('✓ APs query successful:');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error querying APs:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('HTTP 401')) {
      throw new Error('Unauthorized: Invalid or expired token');
    } else if (errorMessage.includes('HTTP 403')) {
      throw new Error('Forbidden: Insufficient permissions to access APs');
    } else if (errorMessage.includes('HTTP 404')) {
      throw new Error('Not Found: APs endpoint not available');
    } else if (errorMessage.includes('HTTP 500')) {
      throw new Error('Internal Server Error: API server encountered an error');
    } else {
      throw new Error(`Failed to query APs: ${errorMessage}`);
    }
  }
};


/**
 * Query venues for an EC tenant
 */
export const getVenues = async (
  tenantId: string,
  token: string,
  region: Region,
  customParams?: Partial<VenuesQueryParams>
): Promise<any> => {
  // Default query parameters
  const defaultQueryParams: VenuesQueryParams = {
    fields: [
      "check-all", "name", "description", "city", "country",
      "networks", "aggregatedApStatus", "switches", "switchClients",
      "clients", "apWiredClients", "edges", "iotControllers", "cog",
      "latitude", "longitude", "status", "id", "isEnforced",
      "addressLine", "tagList", "countryCode", "timezone"
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

    const data = JSON.parse(response);
    console.log('✓ Venues query successful:');
    console.log('Data:', data);
    //console.log('Response:', JSON.stringify(data, null, 2));
    
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


/**
 * Creates venue for an EC tenant
 */
export const postVenues = async (
  tenantId: string,
  token: string,
  region: Region,
  venueToCreate: Record<string, any>
): Promise<any> => {
  try {

    function idGenerator(length: number = 32): string {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }

    const venueParameters = {
        "id": idGenerator(),
        "name": venueToCreate.name,
        "description": venueToCreate.description,
        "tags": venueToCreate.tagList || [],
        "templateContext": venueToCreate.templateContext || "NONE",
        "address":{
          "addressLine":venueToCreate.addressLine,
          "country": venueToCreate.country,
          "city": venueToCreate.city,
          "latitude": venueToCreate.latitude,
          "longitude": venueToCreate.longitude,
          "countryCode": venueToCreate.countryCode,
          "timezone": venueToCreate.timeZone || "Europe/London"
        }
      }

    console.log(venueParameters);


    console.log(`Querying venues for tenant ${tenantId} in region ${region}...`);
    console.log('Query parameters:', JSON.stringify(venueParameters, null, 2));

    const response = await invoke<string>('put_venue', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      venueData: venueParameters
    });

    const data = JSON.parse(response);
    console.log('✓ Venues POST successful:');
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