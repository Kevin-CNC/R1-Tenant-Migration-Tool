// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde_json::Value;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_tenant(api_url: String, tenant_id: String, token: String) -> Result<String, String> {
    let url = format!("{}/tenants/{}", api_url, tenant_id);
    
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn put_tenant(api_url: String, tenant_id: String, token: String, tenant_data: Value) -> Result<String, String> {
    // Use /mspCustomers endpoint as per official Postman collection
    let url = format!("{}/mspCustomers", api_url);
    
    println!("Request URL: {}", url);
    println!("Tenant Data: {}", serde_json::to_string_pretty(&tenant_data).unwrap());

    // Use flat payload structure - NO data wrapper (as per Postman collection)
    let body_data = tenant_data;
    
    println!("Request Body: {}", serde_json::to_string_pretty(&body_data).unwrap());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&body_data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn query_venues(api_url: String, tenant_id: String, token: String, query_data: Value) -> Result<String, String> {
    let url = format!("{}/venues/query", api_url);
    
    println!("Venues Query URL: {}", url);
    println!("Query Data: {}", serde_json::to_string_pretty(&query_data).unwrap());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .header("x-rks-tenantid", tenant_id)
        .json(&query_data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}


#[tauri::command]
async fn querywNetworks(api_url: String, tenant_id: String, token: String, query_data: Value) -> Result<String, String> {
    let url = format!("{}/wifiNetworks/query", api_url);
    
    println!("Wifi Networks Query URL: {}", url);
    println!("Query Data: {}", serde_json::to_string_pretty(&query_data).unwrap());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .header("x-rks-tenantid", tenant_id)
        .json(&query_data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn query_aps(api_url: String, tenant_id: String, token: String, query_data: Value) -> Result<String, String> {
    let url = format!("{}/venues/aps/query", api_url);
    
    println!("APs Query URL: {}", url);
    println!("Query Data: {}", serde_json::to_string_pretty(&query_data).unwrap());

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .header("x-rks-tenantid", tenant_id)
        .json(&query_data)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("HTTP {}: {}", status, body))
    }
}



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, get_tenant, put_tenant, query_venues, querywNetworks, query_aps])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}