import { useState, useCallback } from "react";
import "./App.css";
import "./textColors.css";
import "./animations.css";
import { ToastContainer, useToast } from "./components/Toast";
import { Region, MSPAccount, AppStep } from "./types";
import {
  addMSPAccount,
  deleteMSPAccount,
  performTenantMigration,
  validateMSPCredentials,
} from "./services/api";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faAnglesRight, faPersonBurst } from '@fortawesome/free-solid-svg-icons'



function App() {
  const [step, setStep] = useState<AppStep>("region-select");
  const [selectedRegion, setSelectedRegion] = useState<Region>(null);
  const [mspAccounts, setMspAccounts] = useState<MSPAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // Add MSP Account form state
  const [mspForm, setMspForm] = useState({
    tenantId: "",
    clientId: "",
    clientSecret: "",
  });

  // Migration state
  const [sourceMspId, setSourceMspId] = useState<string>("");
  const [targetMspId, setTargetMspId] = useState<string>("");
  const [tenantInput, setTenantInput] = useState("");
  const [tenantsToMigrate, setTenantsToMigrate] = useState<string[]>([]);

  const handleRegionSelect = (region: Region) => {
    setSelectedRegion(region);
    setStep("main-menu");
    toast.success(`Region set to ${region}`);
  };

  const handleBack = useCallback(() => {
    switch (step) {
      case "main-menu":
        setSelectedRegion(null);
        setStep("region-select");
        break;
      case "add-msp":
      case "tenant-migration":
      case "manage-accounts":
        setStep("main-menu");
        // Reset forms
        setMspForm({ tenantId: "", clientId: "", clientSecret: "" });
        setSourceMspId("");
        setTargetMspId("");
        setTenantInput("");
        setTenantsToMigrate([]);
        break;
    }
  }, [step]);

  const handleAddMSPAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First validate credentials
      const validation = await validateMSPCredentials(
        mspForm.tenantId,
        mspForm.clientId,
        mspForm.clientSecret,
        selectedRegion
      );

      if (!validation.valid) {
        toast.error(validation.message);
        setIsLoading(false);
        return;
      }

      // Add the account
      const newAccount = await addMSPAccount(
        mspForm.tenantId,
        mspForm.clientId,
        mspForm.clientSecret,
        selectedRegion
      );

      setMspAccounts([...mspAccounts, newAccount]);
      toast.success("MSP Account added successfully!");
      setMspForm({ tenantId: "", clientId: "", clientSecret: "" });
      setStep("main-menu");
    } catch (error) {
      console.error("Error adding MSP account:", error);
      toast.error("Failed to add MSP Account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteMSPAccount(accountId);
      if (success) {
        setMspAccounts(mspAccounts.filter((acc) => acc.id !== accountId));
        toast.success("Account deleted successfully");
        
        // Clear selection if deleted account was selected
        if (sourceMspId === accountId) setSourceMspId("");
        if (targetMspId === accountId) setTargetMspId("");
      } else {
        toast.error("Failed to delete account");
      }
    } catch {
      toast.error("An error occurred while deleting the account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTenant = () => {
    const trimmed = tenantInput.trim();
    if (trimmed && !tenantsToMigrate.includes(trimmed)) {
      setTenantsToMigrate([...tenantsToMigrate, trimmed]);
      setTenantInput("");
      toast.info(`Tenant "${trimmed}" added to migration list`);
    } else if (tenantsToMigrate.includes(trimmed)) {
      toast.warning("This tenant is already in the list");
    }
  };

  const handleRemoveTenant = (tenant: string) => {
    setTenantsToMigrate(tenantsToMigrate.filter((t) => t !== tenant));
  };

  const handlePerformMigration = async () => {
    if (!sourceMspId || !targetMspId) {
      toast.error("Please select both source and target MSP accounts");
      return;
    }
    if (sourceMspId === targetMspId) {
      toast.error("Source and target MSP accounts must be different");
      return;
    }
    if (tenantsToMigrate.length === 0) {
      toast.error("Please add at least one tenant to migrate");
      return;
    }

    setIsLoading(true);
    toast.info("Starting tenant migration...", 3000);

    try {
      const result = await performTenantMigration(
        sourceMspId,
        targetMspId,
        tenantsToMigrate
      );

      if (result.success) {
        toast.success(result.message, 5000);
        setTenantsToMigrate([]);
        setSourceMspId("");
        setTargetMspId("");
        setStep("main-menu");
      } else {
        toast.warning(result.message, 5000);
        // Keep failed tenants in the list
        setTenantsToMigrate(result.failedTenants);
      }
    } catch {
      toast.error("Migration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const regionAccounts = mspAccounts.filter(
    (acc) => acc.region === selectedRegion
  );

  return (
    <main className="container">
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <p className="version-p">Version 1.0.0</p>

      {/* Region Selection */}
      {step === "region-select" && (
        <div key="region-select" className="setup-page fadeIn">
          <h1 className="white-text">R1 Tenant Migration</h1>
          <p className="white-text subtitle">
            Select your host region to get started.
          </p>

          <div className="country-selection">
            {(["Asia", "Europe", "North America"] as const).map((region) => (
              <button
                key={region}
                className="country-button"
                onClick={() => handleRegionSelect(region)}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Menu */}
      {step === "main-menu" && (
        <div key="main-menu" className="setup-page fadeIn">
          <h1 className="white-text">Tenant Migration</h1>
          <p className="white-text subtitle">
            Region:{" "}
            <strong className="ruckus-orange-text">{selectedRegion}</strong>
          </p>

          <div className="main-menu-buttons">
            <button
              className="menu-button"
              onClick={() => setStep("add-msp")}
            >
              <FontAwesomeIcon icon={faPersonBurst} style={{color: "#f3f0f9",}} />
              <span className="menu-text">Add an MSP Account</span>
              <span className="menu-description">
                Configure a new MSP account for migration
              </span>
            </button>

            <button
              className="menu-button"
              onClick={() => setStep("tenant-migration")}
              disabled={regionAccounts.length < 2}
            >
              <FontAwesomeIcon icon={faAnglesRight} style={{color: "#ffffff",}} />
              <span className="menu-text">Perform Tenant Migration</span>
              <span className="menu-description">
                {regionAccounts.length < 2
                  ? `Need at least 2 MSP accounts (${regionAccounts.length} added)`
                  : "Migrate tenants between MSP accounts"}
              </span>
            </button>

            {regionAccounts.length > 0 && (
              <button
                className="menu-button secondary"
                onClick={() => setStep("manage-accounts")}
              >
                <FontAwesomeIcon icon={faGear} style={{color: "#f3f0f9",}} />
                <span className="menu-text">Manage Accounts</span>
                <span className="menu-description">
                  {regionAccounts.length} account(s) configured
                </span>
              </button>
            )}
          </div>

          <button className="btn-back" onClick={handleBack}>
            ← Change Region
          </button>
        </div>
      )}

      {/* Add MSP Account */}
      {step === "add-msp" && (
        <div key="add-msp" className="setup-page slideIn">
          <h1 className="white-text">Add MSP Account</h1>
          <p className="white-text subtitle">
            Region:{" "}
            <strong className="ruckus-orange-text">{selectedRegion}</strong>
          </p>

          <form onSubmit={handleAddMSPAccount} className="msp-form">
            <div className="form-group">
              <label htmlFor="tenant-id">Tenant ID</label>
              <input
                id="tenant-id"
                type="text"
                value={mspForm.tenantId}
                onChange={(e) =>
                  setMspForm({ ...mspForm, tenantId: e.target.value })
                }
                placeholder="Enter Tenant ID"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="client-id">Client ID</label>
              <input
                id="client-id"
                type="text"
                value={mspForm.clientId}
                onChange={(e) =>
                  setMspForm({ ...mspForm, clientId: e.target.value })
                }
                placeholder="Enter Client ID"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="client-secret">Client Secret</label>
              <input
                id="client-secret"
                type="password"
                value={mspForm.clientSecret}
                onChange={(e) =>
                  setMspForm({ ...mspForm, clientSecret: e.target.value })
                }
                placeholder="Enter Client Secret"
                disabled={isLoading}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  isLoading ||
                  !mspForm.tenantId.trim() ||
                  !mspForm.clientId.trim() ||
                  !mspForm.clientSecret.trim()
                }
              >
                {isLoading ? "Adding..." : "Add Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenant Migration */}
      {step === "tenant-migration" && (
        <div key="tenant-migration" className="setup-page wide slideIn">
          <h1 className="white-text">Tenant Migration</h1>
          <p className="white-text subtitle">
            Select source and target MSP accounts, then add tenants to migrate.
          </p>

          <div className="migration-container">
            <div className="msp-selection-row">
              <div className="msp-select-group">
                <label>Source MSP (From)</label>
                <select
                  value={sourceMspId}
                  onChange={(e) => setSourceMspId(e.target.value)}
                  className="msp-select"
                >
                  <option value="">Select source account...</option>
                  {regionAccounts
                    .filter((acc) => acc.id !== targetMspId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="migration-arrow">→</div>

              <div className="msp-select-group">
                <label>Target MSP (To)</label>
                <select
                  value={targetMspId}
                  onChange={(e) => setTargetMspId(e.target.value)}
                  className="msp-select"
                >
                  <option value="">Select target account...</option>
                  {regionAccounts
                    .filter((acc) => acc.id !== sourceMspId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="tenant-input-section">
              <label>Add Tenants to Migrate</label>
              <div className="tenant-input-row">
                <input
                  type="text"
                  value={tenantInput}
                  onChange={(e) => setTenantInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTenant())}
                  placeholder="Enter Tenant ID"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="btn-add"
                  onClick={handleAddTenant}
                  disabled={!tenantInput.trim() || isLoading}
                >
                  Add
                </button>
              </div>
            </div>

            {tenantsToMigrate.length > 0 && (
              <div className="tenant-list">
                <label>Tenants to Migrate ({tenantsToMigrate.length})</label>
                <div className="tenant-chips">
                  {tenantsToMigrate.map((tenant) => (
                    <div key={tenant} className="tenant-chip">
                      <span>{tenant}</span>
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => handleRemoveTenant(tenant)}
                        disabled={isLoading}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handlePerformMigration}
                disabled={
                  isLoading ||
                  !sourceMspId ||
                  !targetMspId ||
                  tenantsToMigrate.length === 0
                }
              >
                {isLoading ? "Migrating..." : "Start Migration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Accounts */}
      {step === "manage-accounts" && (
        <div key="manage-accounts" className="setup-page wide slideIn">
          <h1 className="white-text">Manage MSP Accounts</h1>
          <p className="white-text subtitle">
            Region:{" "}
            <strong className="ruckus-orange-text">{selectedRegion}</strong>
          </p>

          <div className="accounts-list">
            {regionAccounts.length === 0 ? (
              <p className="white-text no-accounts">No accounts configured for this region.</p>
            ) : (
              regionAccounts.map((account) => (
                <div key={account.id} className="account-card">
                  <div className="account-info">
                    <h3>{account.name}</h3>
                    <p className="account-detail">
                      <span className="label">Tenant ID:</span>
                      <span className="value">{account.tenantId}</span>
                    </p>
                    <p className="account-detail">
                      <span className="label">Client ID:</span>
                      <span className="value">{account.clientId}</span>
                    </p>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteAccount(account.id)}
                    disabled={isLoading}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBack}
              disabled={isLoading}
            >
              ← Back to Menu
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStep("add-msp")}
            >
              + Add Account
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;