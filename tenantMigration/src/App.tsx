import { useState } from "react";
import "./App.css";

type Country = "Asia" | "Europe" | "North America" | null;

interface SetupData {
  country: Country;
  apiKey: string;
}

function App() {
  const [step, setStep] = useState<1 | 2>(1);
  const [setupData, setSetupData] = useState<SetupData>({
    country: null,
    apiKey: "",
  });

  const handleCountrySelect = (country: Country) => {
    setSetupData({ ...setupData, country });
    setStep(2);
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (setupData.apiKey.trim()) {
      console.log("Setup complete:", setupData);
      // TODO: Save setup data and proceed to main app
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  return (
    <main className="container">
      {step === 1 ? (
        <div className="setup-page">
          <h1>Welcome to Tenant Migration</h1>
          <p className="subtitle">
            Select the region where your account is registered
          </p>

          <div className="country-selection">
            {(["Asia", "Europe", "North America"] as const).map((country) => (
              <button
                key={country}
                className="country-button"
                onClick={() => handleCountrySelect(country)}
              >
                {country}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="setup-page">
          <h1>API Key Configuration</h1>
          <p className="subtitle">
            Selected region: <strong>{setupData.country}</strong>
          </p>

          <form onSubmit={handleApiKeySubmit} className="api-form">
            <div className="form-group">
              <label htmlFor="api-key">Enter your API Key:</label>
              <input
                id="api-key"
                type="password"
                value={setupData.apiKey}
                onChange={(e) =>
                  setSetupData({ ...setupData, apiKey: e.currentTarget.value })
                }
                placeholder="Enter your API key..."
                autoFocus
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                Back
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={!setupData.apiKey.trim()}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default App;
