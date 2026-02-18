# Tenant Migration System - Implementation Reference

## Overview
This document provides detailed technical information about the tenant migration system implementation for LLMs and developers to understand the architecture and implement additional features.

## Tech Stack

### Frontend
- **Framework**: React with TypeScript
- **Bundler**: Vite
- **Runtime**: Tauri (cross-platform desktop application)
- **HTTP Client**: `@tauri-apps/plugin-http`
- **File System**: `@tauri-apps/plugin-fs`

### Backend
- **Language**: Rust
- **Framework**: Tauri (command handlers)
- **HTTP Client**: `reqwest` (async HTTP requests)
- **JSON Serialization**: `serde_json`

## Architecture

### Request Flow
```
React Component → TypeScript API Wrapper → Tauri IPC → Rust Command → External API
                                                              ↓
                                       Response Parsing & Error Handling
                                                              ↓
React Component ← JSON Response ← Rust → Tauri IPC
```

## Supported Regions

The system uses region-specific base URLs for API and OAuth endpoints:

| Region | API URL | OAuth URL |
|--------|---------|-----------|
| Europe | `https://api.eu.ruckus.cloud` | `https://eu.ruckus.cloud` |
| Asia | `https://api.asia.ruckus.cloud` | `https://asia.ruckus.cloud` |
| North America | `https://api.ruckus.cloud` | `https://ruckus.cloud` |

## Authentication Flow

### 1. Token Acquisition
**Endpoint**: `{baseUrl}/oauth2/token/{tenantId}`  
**Method**: POST

**Request**:
```typescript
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
```

**Response**:
```typescript
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
```

**Usage**:
```typescript
const token = await fetchToken(tenantId, clientId, clientSecret, region);
```

## API Endpoints

### 1. Get Tenant Details
**Endpoint**: `{apiUrl}/tenants/{tenantId}`  
**Method**: GET

**Headers**:
```
Authorization: Bearer {sessionToken}
Accept: application/json
```

**Rust Command**:
```rust
#[tauri::command]
async fn get_tenant(api_url: String, tenant_id: String, token: String) -> Result<String, String>
```

**TypeScript Invocation**:
```typescript
const resp = await invoke<string>('get_tenant', {
  apiUrl: getAPIUrlByRegion(region),
  tenantId: tenantId,
  token: sessionToken.trim()
});
const data = JSON.parse(resp);
```

---

### 2. Query Venues (Primary Implementation)
**Endpoint**: `{apiUrl}/venues/query`  
**Method**: POST

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {sessionToken}
x-rks-tenantid: {mspTenantId}
```

**Important**: The `x-rks-tenantid` header must contain the **MSP tenant ID** (the tenant making the request), not the child tenant ID. This must match the tenant used to obtain the session token.

**Request Body Payload**:
```typescript
interface VenuesQueryParams {
  fields: string[];                    // Fields to retrieve
  searchTargetFields: string[];        // Fields to search within
  filters: Record<string, any>;        // Filter criteria
  sortField: string;                   // Field to sort by
  sortOrder: 'ASC' | 'DESC';          // Sort direction
  page: number;                        // Page number (1-indexed)
  pageSize: number;                    // Results per page
  defaultPageSize: number;             // Default page size
  total: number;                       // Total count (typically 0 on request)
}
```

**Default Payload**:
```json
{
  "fields": [
    "check-all", "name", "description", "city", "country",
    "networks", "aggregatedApStatus", "switches", "switchClients",
    "clients", "apWiredClients", "edges", "iotControllers", "cog",
    "latitude", "longitude", "status", "id", "isEnforced",
    "addressLine", "tagList"
  ],
  "searchTargetFields": ["name", "addressLine", "description", "tagList"],
  "filters": {},
  "sortField": "name",
  "sortOrder": "ASC",
  "page": 1,
  "pageSize": 10,
  "defaultPageSize": 10,
  "total": 0
}
```

**Response Format**:
```typescript
interface VenuesQueryResponse {
  list: any[];           // Array of venue objects
  totalCount: number;    // Total number of venues
  hasMore: boolean;      // Whether more results exist
}
```

**Rust Command**:
```rust
#[tauri::command]
async fn query_venues(
  api_url: String,
  tenant_id: String,
  token: String,
  query_data: Value
) -> Result<String, String>
```

**TypeScript Invocation**:
```typescript
const venues = await getVenues(
  mspTenantId,              // MSP tenant ID
  sessionToken,             // JWT from token endpoint
  region,                   // Region (Europe, Asia, North America)
  customParams              // Optional: { page: 2, pageSize: 20 }
);
```

**Error Handling**:
- `HTTP 401`: Unauthorized - Token is invalid or expired
- `HTTP 403`: Forbidden - Insufficient permissions (often due to wrong tenant ID in header)
- `HTTP 404`: Not Found - Endpoint unavailable
- `HTTP 500`: Internal Server Error - API server error

---

### 3. Create/Update Tenant
**Endpoint**: `{apiUrl}/mspCustomers`  
**Method**: POST

**Headers**:
```
Authorization: Bearer {sessionToken}
Content-Type: application/json
```

**Request Body**:
```typescript
interface TenantPayload {
  // Required fields
  name: string;
  tenant_type: string;
  service_effective_date: string;
  service_expiration_date: string;
  admin_email: string;
  admin_firstname: string;
  admin_lastname: string;
  admin_role: string;
  
  // Optional address fields
  street_address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone_number?: string;
  fax_number?: string;
  
  // Complex objects
  licenses?: { trialAction: string; assignments: any[] };
  admin_delegations?: any[];
  delegations?: any[];
}
```

**Rust Command**:
```rust
#[tauri::command]
async fn put_tenant(
  api_url: String,
  tenant_id: String,
  token: String,
  tenant_data: Value
) -> Result<String, String>
```

**TypeScript Invocation**:
```typescript
const putResp = await invoke<string>('put_tenant', {
  apiUrl: getAPIUrlByRegion(region),
  tenantId: mspTenantId,
  token: sessionToken.trim(),
  tenantData: tenantPayload
});
```

## Key Implementation Details

### MSP Account Management
**Storage**: File-based JSON storage in AppLocalData directory
**Path**: `userAccounts.json`

**MSPAccount Interface**:
```typescript
interface MSPAccount {
  id: string;              // Unique identifier (msp-{timestamp}-{random})
  name: string;            // Display name
  tenantId: string;        // MSP tenant ID
  clientId: string;        // OAuth client ID
  clientSecret: string;    // OAuth client secret
  JWToken: string;         // Current session JWT
  region: Region;          // Deployment region
}
```

### Important Security Notes
1. **Token Management**: Tokens are stored in memory and persisted to disk
2. **Header Validation**: The `x-rks-tenantid` header MUST match the tenant that generated the session token
3. **Client Credentials**: Stored securely in appData directory with restricted access
4. **Token Expiration**: Tokens expire per `expires_in` in TokenResponse - implement refresh logic for long-running sessions

## Error Handling Pattern

All Rust commands follow this pattern:
```rust
// Log the request details
println!("Request URL: {}", url);
println!("Request Data: {}", data_str);

// Make request with error mapping
let response = client
  .post(&url)
  .header("Header-Name", value)
  .json(&data)
  .send()
  .await
  .map_err(|e| format!("Request failed: {}", e))?;

// Check status and return appropriate error
let status = response.status();
let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

if status.is_success() {
  Ok(body)
} else {
  Err(format!("HTTP {}: {}", status, body))
}
```

TypeScript wrapper handles specific error codes:
```typescript
if (errorMessage.includes('HTTP 401')) {
  throw new Error('Unauthorized: Invalid or expired token');
} else if (errorMessage.includes('HTTP 403')) {
  throw new Error('Forbidden: Insufficient permissions');
} else if (errorMessage.includes('HTTP 404')) {
  throw new Error('Not Found: Endpoint unavailable');
} else if (errorMessage.includes('HTTP 500')) {
  throw new Error('Internal Server Error');
}
```

## Adding New API Endpoints

### Step 1: Create Rust Command (lib.rs)
```rust
#[tauri::command]
async fn new_endpoint(
  api_url: String,
  tenant_id: String,
  token: String,
  data: Value
) -> Result<String, String> {
  let url = format!("{}/endpoint/path", api_url);
  
  let client = reqwest::Client::new();
  let response = client
    .post(&url)
    .header("Authorization", format!("Bearer {}", token))
    .header("Content-Type", "application/json")
    .header("x-rks-tenantid", tenant_id)
    .json(&data)
    .send()
    .await
    .map_err(|e| format!("Request failed: {}", e))?;
  
  let status = response.status();
  let body = response.text().await?;
  
  if status.is_success() {
    Ok(body)
  } else {
    Err(format!("HTTP {}: {}", status, body))
  }
}
```

### Step 2: Register in Handler (lib.rs run function)
```rust
.invoke_handler(tauri::generate_handler![
  greet,
  get_tenant,
  put_tenant,
  query_venues,
  new_endpoint  // Add here
])
```

### Step 3: Create TypeScript Wrapper (api.ts)
```typescript
export const newEndpoint = async (
  tenantId: string,
  token: string,
  region: Region,
  payload: any
): Promise<any> => {
  try {
    console.log(`Calling new endpoint for tenant ${tenantId}...`);
    
    const response = await invoke<string>('new_endpoint', {
      apiUrl: getAPIUrlByRegion(region),
      tenantId: tenantId,
      token: token.trim(),
      data: payload
    });
    
    const data = JSON.parse(response);
    console.log('✓ Request successful:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw new Error(`Failed: ${error}`);
  }
};
```

## Testing with cURL

Example: Query venues endpoint
```bash
curl -i -X POST 'https://api.eu.ruckus.cloud/venues/query' \
  -H 'Content-Type: application/json' \
  -H 'x-rks-tenantid: {mspTenantId}' \
  -H 'Authorization: Bearer {sessionToken}' \
  -d '{
    "fields": ["check-all", "name", "description"],
    "searchTargetFields": ["name"],
    "filters": {},
    "sortField": "name",
    "sortOrder": "ASC",
    "page": 1,
    "pageSize": 10,
    "defaultPageSize": 10,
    "total": 0
  }'
```

## Debugging Tips

1. **Check Console Logs**: All requests are logged to console with URL and payload
2. **Header Validation**: Always verify tenant ID in `x-rks-tenantid` matches the token's tenant
3. **Token Expiration**: If getting 401 errors, fetch a new token
4. **Region Mismatch**: Ensure API URL region matches where the token was obtained
5. **Payload Format**: All payloads must be JSON serializable without circular references

## Future Implementation Considerations

- Implement token refresh mechanism before expiration
- Add request retry logic with exponential backoff
- Add request caching for frequently accessed endpoints
- Implement WebSocket support for real-time updates
- Add request/response middleware for logging and monitoring
- Consider pagination helpers for large result sets
