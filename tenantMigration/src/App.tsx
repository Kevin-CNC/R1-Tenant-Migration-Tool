import { useState, useCallback } from "react";
import "./App.css";
import "./textColors.css";
import "./animations.css";
import { ToastContainer, useToast } from "./components/Toast";
import { Region, MSPAccount, ECAccount, AppStep } from "./types";
import {
  addMSPAccount,
  deleteMSPAccount,
  addECAccount,
  deleteECAccount,
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

  // EC Accounts state
  const [ecAccounts, setEcAccounts] = useState<ECAccount[]>([]);

  // Add EC Account form state
  const [ecForm, setEcForm] = useState({
    name: "",
    tenantId: "",
    mspId: "",
  });

  // Migration state
  const [sourceECId, setSourceECId] = useState<string>("");
  const [targetECId, setTargetECId] = useState<string>("");

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
      case "manage-ec":
        setStep("main-menu");
        setMspForm({ tenantId: "", clientId: "", clientSecret: "" });
        setEcForm({ name: "", tenantId: "", mspId: "" });
        setSourceECId("");
        setTargetECId("");
        break;
      case "add-ec":
        setStep("manage-ec");
        setEcForm({ name: "", tenantId: "", mspId: "" });
        break;
    }
  }, [step]);

  const handleAddMSPAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mspAccounts.find(acc => acc.tenantId === mspForm.tenantId && acc.region === selectedRegion)) {
        toast.error("An MSP account with this Tenant ID already exists in the selected region.");
        setIsLoading(false);
        return;
      }

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
        // Force a new array reference to trigger React re-render
        setMspAccounts(prev => prev.filter((acc) => acc.id !== accountId));
        toast.success("Account deleted successfully");
        
        // Clear EC migration selection if the deleted MSP is the parent of selected ECs
        const affected = ecAccounts.filter(ec => ec.mspId === accountId);
        const affectedIds = new Set(affected.map(ec => ec.id));
        if (affectedIds.has(sourceECId)) setSourceECId("");
        if (affectedIds.has(targetECId)) setTargetECId("");
      } else {
        toast.error("Failed to delete account");
      }
    } catch {
      toast.error("An error occurred while deleting the account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddECAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (ecAccounts.find(ec => ec.tenantId === ecForm.tenantId.trim() && ec.region === selectedRegion)) {
        toast.error("An End Customer with this Tenant ID already exists in the selected region.");
        setIsLoading(false);
        return;
      }

      const newEC = await addECAccount(
        ecForm.name.trim(),
        ecForm.tenantId.trim(),
        ecForm.mspId,
        selectedRegion
      );

      setEcAccounts(prev => [...prev, newEC]);
      toast.success(`End Customer "${newEC.name}" added successfully!`);
      setEcForm({ name: "", tenantId: "", mspId: "" });
      setStep("manage-ec");
    } catch (error) {
      console.error("Error adding EC account:", error);
      toast.error("Failed to add End Customer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteECAccount = async (ecId: string) => {
    setIsLoading(true);
    try {
      const success = await deleteECAccount(ecId);
      if (success) {
        setEcAccounts(prev => prev.filter((ec) => ec.id !== ecId));
        toast.success("End Customer deleted successfully");
        if (sourceECId === ecId) setSourceECId("");
        if (targetECId === ecId) setTargetECId("");
      } else {
        toast.error("Failed to delete End Customer");
      }
    } catch {
      toast.error("An error occurred while deleting the End Customer");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePerformMigration = async () => {
    if (!sourceECId || !targetECId) {
      toast.error("Please select both source and target End Customer accounts");
      return;
    }
    if (sourceECId === targetECId) {
      toast.error("Source and target End Customer accounts must be different");
      return;
    }

    setIsLoading(true);
    toast.info("Starting tenant migration...", 3000);

    try {
      const result = await performTenantMigration(sourceECId, targetECId);

      if (result.success) {
        toast.success(result.message, 5000);
        setSourceECId("");
        setTargetECId("");
        setStep("main-menu");
      } else {
        toast.warning(result.message, 5000);
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

  const regionECAccounts = ecAccounts.filter(
    (ec) => ec.region === selectedRegion
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
              onClick={() => setStep("add-ec")}
              disabled={regionAccounts.length === 0}
            >
              <FontAwesomeIcon icon={faPersonBurst} style={{color: "#f3f0f9",}} />
              <span className="menu-text">Add an End Customer</span>
              <span className="menu-description">
                {regionAccounts.length === 0
                  ? "Add an MSP account first"
                  : "Register an End Customer tenant under an MSP"}
              </span>
            </button>

            <button
              className="menu-button"
              onClick={() => setStep("tenant-migration")}
              disabled={regionECAccounts.length < 2}
            >
              <FontAwesomeIcon icon={faAnglesRight} style={{color: "#ffffff",}} />
              <span className="menu-text">Perform Tenant Migration</span>
              <span className="menu-description">
                {regionECAccounts.length < 2
                  ? `Need at least 2 End Customers (${regionECAccounts.length} added)`
                  : "Migrate data between End Customer tenants"}
              </span>
            </button>

            {regionAccounts.length > 0 && (
              <button
                className="menu-button secondary"
                onClick={() => setStep("manage-accounts")}
              >
                <FontAwesomeIcon icon={faGear} style={{color: "#f3f0f9",}} />
                <span className="menu-text">Manage MSP Accounts</span>
                <span className="menu-description">
                  {regionAccounts.length} MSP account(s) configured
                </span>
              </button>
            )}

            {regionECAccounts.length > 0 && (
              <button
                className="menu-button secondary"
                onClick={() => setStep("manage-ec")}
              >
                <FontAwesomeIcon icon={faGear} style={{color: "#f3f0f9",}} />
                <span className="menu-text">Manage End Customers</span>
                <span className="menu-description">
                  {regionECAccounts.length} End Customer(s) configured
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
            Select the source and target End Customer accounts to migrate between.
          </p>

          <div className="migration-container">
            <div className="msp-selection-row">
              <div className="msp-select-group">
                <label>Source End Customer (From)</label>
                <select
                  value={sourceECId}
                  onChange={(e) => setSourceECId(e.target.value)}
                  className="msp-select"
                >
                  <option value="">Select source End Customer...</option>
                  {regionECAccounts
                    .filter((ec) => ec.id !== targetECId)
                    .map((ec) => {
                      const parentMSP = mspAccounts.find(m => m.id === ec.mspId);
                      return (
                        <option key={ec.id} value={ec.id}>
                          {ec.name} ({parentMSP?.name ?? "Unknown MSP"})
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="migration-arrow">→</div>

              <div className="msp-select-group">
                <label>Target End Customer (To)</label>
                <select
                  value={targetECId}
                  onChange={(e) => setTargetECId(e.target.value)}
                  className="msp-select"
                >
                  <option value="">Select target End Customer...</option>
                  {regionECAccounts
                    .filter((ec) => ec.id !== sourceECId)
                    .map((ec) => {
                      const parentMSP = mspAccounts.find(m => m.id === ec.mspId);
                      return (
                        <option key={ec.id} value={ec.id}>
                          {ec.name} ({parentMSP?.name ?? "Unknown MSP"})
                        </option>
                      );
                    })}
                </select>
              </div>
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
                type="button"
                className="btn-primary"
                onClick={handlePerformMigration}
                disabled={isLoading || !sourceECId || !targetECId}
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

      {/* Add End Customer */}
      {step === "add-ec" && (
        <div key="add-ec" className="setup-page slideIn">
          <h1 className="white-text">Add End Customer</h1>
          <p className="white-text subtitle">
            Region:{" "}
            <strong className="ruckus-orange-text">{selectedRegion}</strong>
          </p>

          <form onSubmit={handleAddECAccount} className="msp-form">
            <div className="form-group">
              <label htmlFor="ec-name">Name</label>
              <input
                id="ec-name"
                type="text"
                value={ecForm.name}
                onChange={(e) => setEcForm({ ...ecForm, name: e.target.value })}
                placeholder="e.g. Acme Corporation"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ec-tenant-id">Tenant ID</label>
              <input
                id="ec-tenant-id"
                type="text"
                value={ecForm.tenantId}
                onChange={(e) => setEcForm({ ...ecForm, tenantId: e.target.value })}
                placeholder="Enter End Customer Tenant ID"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ec-msp">Associated MSP Account</label>
              <select
                id="ec-msp"
                value={ecForm.mspId}
                onChange={(e) => setEcForm({ ...ecForm, mspId: e.target.value })}
                className="msp-select"
                disabled={isLoading}
              >
                <option value="">Select MSP account...</option>
                {regionAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
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
                  !ecForm.name.trim() ||
                  !ecForm.tenantId.trim() ||
                  !ecForm.mspId
                }
              >
                {isLoading ? "Adding..." : "Add End Customer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manage End Customers */}
      {step === "manage-ec" && (
        <div key="manage-ec" className="setup-page wide slideIn">
          <h1 className="white-text">Manage End Customers</h1>
          <p className="white-text subtitle">
            Region:{" "}
            <strong className="ruckus-orange-text">{selectedRegion}</strong>
          </p>

          <div className="accounts-list">
            {regionECAccounts.length === 0 ? (
              <p className="white-text no-accounts">No End Customers configured for this region.</p>
            ) : (
              regionECAccounts.map((ec) => {
                const parentMSP = mspAccounts.find(m => m.id === ec.mspId);
                return (
                  <div key={ec.id} className="account-card">
                    <div className="account-info">
                      <h3>{ec.name}</h3>
                      <p className="account-detail">
                        <span className="label">Tenant ID:</span>
                        <span className="value">{ec.tenantId}</span>
                      </p>
                      <p className="account-detail">
                        <span className="label">MSP Account:</span>
                        <span className="value">{parentMSP?.name ?? "Unknown MSP"}</span>
                      </p>
                    </div>
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteECAccount(ec.id)}
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  </div>
                );
              })
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
              onClick={() => setStep("add-ec")}
            >
              + Add End Customer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;