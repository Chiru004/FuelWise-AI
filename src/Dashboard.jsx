
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./App.css";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const dateLabel = (date) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-IN")
    : "—";

function App() {
  const [vehicles, setVehicles] = useState([]);
  const [entries, setEntries] = useState([]);

  const [vehicle, setVehicle] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleType, setVehicleType] = useState("Bike");
  const [fuelType, setFuelType] = useState("Petrol");
  const [registration, setRegistration] = useState("");

  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [amountPaid, setAmountPaid] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");

  const [activePage, setActivePage] = useState("Dashboard");
  const [period, setPeriod] = useState("All Time");
  const [notice, setNotice] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicles")
          .select("*")
          .order("created_at", { ascending: false });
        if (vehicleError) throw vehicleError;

        const { data: entryData, error: entryError } = await supabase
          .from("fuel_entries")
          .select("*")
          .order("fuel_date", { ascending: false });
        if (entryError) throw entryError;

        const mappedVehicles = (vehicleData || []).map((item) => ({
          id: item.id,
          name: item.name,
          type: item.vehicle_type || "Other",
          fuelType: item.fuel_type || "Petrol",
          registration: item.registration_number || "",
        }));
        const vehicleNames = Object.fromEntries(mappedVehicles.map((item) => [item.id, item.name]));
        const mappedEntries = (entryData || []).map((item) => ({
          id: item.id,
          vehicleId: item.vehicle_id,
          vehicleName: vehicleNames[item.vehicle_id] || "Vehicle removed",
          date: item.fuel_date,
          litres: Number(item.fuel_litres),
          price: Number(item.price_per_litre),
          cost: Number(item.total_cost),
          mileage: Number(item.mileage_kmpl) || 0,
        }));
        setVehicles(mappedVehicles);
        setEntries(mappedEntries);
      } catch (error) {
        console.error("Error loading FuelWise data:", error);
        setNotice(`Could not load saved data: ${error.message}`);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const totalCost = useMemo(
    () =>
      entries.reduce(
        (sum, entry) => sum + (entry.cost ?? entry.litres * entry.price),
        0
      ),
    [entries]
  );

  const totalLitres = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.litres, 0),
    [entries]
  );

  const mileageRecords = entries.filter((entry) => entry.mileage > 0);

  const averageMileage = mileageRecords.length
    ? mileageRecords.reduce((sum, entry) => sum + entry.mileage, 0) /
      mileageRecords.length
    : 0;

  const averagePrice = totalLitres ? totalCost / totalLitres : 0;

  const calculatedLitres = Number(price) > 0 && Number(amountPaid) > 0
    ? Number(amountPaid) / Number(price)
    : 0;

  const monthlySpending = useMemo(() => {
    const totals = {};

    entries.forEach((entry) => {
      const month = entry.date.slice(0, 7);
      totals[month] =
        (totals[month] || 0) + (entry.cost ?? entry.litres * entry.price);
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(period === "Last 3 Months" ? -3 : -6)
      .map(([month, amount]) => ({
        month: new Date(`${month}-15T12:00:00`).toLocaleDateString(
          "en-IN",
          { month: "short", year: "2-digit" }
        ),
        amount,
      }));
  }, [entries, period]);

  const chartMaximum = Math.max(
    100,
    ...monthlySpending.map((item) => item.amount)
  );

  async function addVehicle(event) {
    event.preventDefault();
    setNotice("");
    const name = vehicleName.trim();
    const reg = registration.trim().toUpperCase();

    if (!name) return setNotice("Please enter a vehicle name.");
    if (vehicles.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return setNotice("A vehicle with this name already exists.");
    }
    if (reg && vehicles.some((item) => item.registration && item.registration.toUpperCase() === reg)) {
      return setNotice("This registration number is already registered.");
    }

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again to add a vehicle.");

      const { data, error } = await supabase.from("vehicles").insert({
        user_id: userData.user.id,
        name,
        vehicle_type: vehicleType,
        fuel_type: fuelType,
        registration_number: reg || null,
      }).select().single();
      if (error) throw error;

      const newVehicle = {
        id: data.id,
        name: data.name,
        type: data.vehicle_type || "Other",
        fuelType: data.fuel_type || "Petrol",
        registration: data.registration_number || "",
      };
      setVehicles((previous) => [...previous, newVehicle]);
      setVehicle(newVehicle.id);
      setVehicleName("");
      setRegistration("");
      setNotice(`${name} added successfully!`);
    } catch (error) {
      console.error("Error saving vehicle:", error);
      setNotice(`Could not save vehicle: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function addEntry(event) {
    event.preventDefault();
    setNotice("");
    if (!vehicle) return setNotice("Please add a vehicle before recording fuel.");
    if (!date || Number(price) <= 0 || Number(amountPaid) <= 0 || !Number.isFinite(Number(price)) || !Number.isFinite(Number(amountPaid))) {
      return setNotice("Enter a valid date, price per litre, and total amount paid.");
    }
    const selectedVehicle = vehicles.find((item) => item.id === vehicle);
    if (!selectedVehicle) return setNotice("Please select a registered vehicle.");

    const litres = Number(amountPaid) / Number(price);
    if (!Number.isFinite(litres) || litres <= 0) return setNotice("Could not calculate fuel quantity. Check the amount and price.");

    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Please sign in again to record fuel.");

      const { data, error } = await supabase.from("fuel_entries").insert({
        user_id: userData.user.id,
        vehicle_id: selectedVehicle.id,
        fuel_date: date,
        fuel_litres: litres,
        price_per_litre: Number(price),
        total_cost: Number(amountPaid),
        mileage_kmpl: Number(mileage) > 0 ? Number(mileage) : null,
      }).select().single();
      if (error) throw error;

      const newEntry = {
        id: data.id,
        vehicleId: selectedVehicle.id,
        vehicleName: selectedVehicle.name,
        date: data.fuel_date,
        litres: Number(data.fuel_litres),
        price: Number(data.price_per_litre),
        cost: Number(data.total_cost),
        mileage: Number(data.mileage_kmpl) || 0,
      };
      setEntries((previous) => [newEntry, ...previous].sort((a, b) => b.date.localeCompare(a.date)));
      setAmountPaid("");
      setPrice("");
      setMileage("");
      setNotice(`Fuel expense saved! Calculated quantity: ${litres.toFixed(2)} litres.`);
    } catch (error) {
      console.error("Error saving fuel entry:", error);
      setNotice(`Could not save fuel entry: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id) {
    try {
      const { error } = await supabase.from("fuel_entries").delete().eq("id", id);
      if (error) throw error;
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      setNotice("Fuel entry deleted.");
    } catch (error) {
      console.error("Error deleting fuel entry:", error);
      setNotice(`Could not delete fuel entry: ${error.message}`);
    }
  }

  async function deleteVehicle(id) {
    const hasHistory = entries.some((entry) => entry.vehicleId === id);
    if (hasHistory) {
      setNotice("This vehicle has fuel records. Keep it registered to preserve your history.");
      return;
    }
    const selected = vehicles.find((item) => item.id === id);
    try {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
      setVehicles((previous) => previous.filter((item) => item.id !== id));
      if (vehicle === id) setVehicle("");
      setNotice(`${selected?.name || "Vehicle"} removed.`);
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      setNotice(`Could not remove vehicle: ${error.message}`);
    }
  }

  const navItems = [
    { name: "Dashboard", icon: "⌂", target: "dashboard" },
    { name: "Add Fuel", icon: "＋", target: "add-fuel" },
    { name: "Fuel History", icon: "◷", target: "fuel-history" },
    { name: "Analytics", icon: "▥", target: "analytics" },
    { name: "AI Insights", icon: "✧", target: "ai-insights" },
    { name: "Vehicles", icon: "▱", target: "vehicles" },
  ];

  function navigate(name, target) {
    setActivePage(name);
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="fuelwise-app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={(event) => {
            event.preventDefault();
            navigate("Dashboard", "dashboard");
          }}
        >
          <span className="brand-icon">⛽</span>
          <span>
            <strong>
              Fuel<span>Wise</span>
            </strong>
            <small>Track · Analyse · Save</small>
          </span>
        </a>

        <nav className="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? "selected" : ""
              }`}
              onClick={() => navigate(item.name, item.target)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-promo">
          <span className="promo-leaf">✦</span>
          <h3>Drive Smarter<br />Spend Better</h3>
          <p>Track every drop.<br />Save for tomorrow.</p>
        </div>

        <div className="sidebar-footer">
          <span className="online-dot" />
          FuelWise Personal
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="welcome-header">
          <div>
            <p className="eyebrow">YOUR PERSONAL FUEL ASSISTANT</p>
            <h1>Welcome to FuelWise <span>👋</span></h1>
            <p className="subtitle">
              Understand your fuel expenses and make every journey count.
            </p>
          </div>

          <div className="header-actions">
            <span className="date-pill">
              ▦ {dateLabel(date)}
            </span>
            <div className="avatar" title="FuelWise">F</div>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <section className="summary-grid">
          <article className="summary-card green-card">
            <div className="summary-top">
              <span className="summary-icon green-icon">₹</span>
              <span className="summary-label">Total Spending</span>
            </div>
            <strong className="summary-value">{money(totalCost)}</strong>
            <span className="summary-caption">All recorded transactions</span>
          </article>

          <article className="summary-card blue-card">
            <div className="summary-top">
              <span className="summary-icon blue-icon">⛽</span>
              <span className="summary-label">Fuel Purchased</span>
            </div>
            <strong className="summary-value">
              {totalLitres.toFixed(2)} L
            </strong>
            <span className="summary-caption">Total recorded volume</span>
          </article>

          <article className="summary-card amber-card">
            <div className="summary-top">
              <span className="summary-icon amber-icon">↗</span>
              <span className="summary-label">Average Mileage</span>
            </div>
            <strong className="summary-value">
              {averageMileage.toFixed(1)} km/L
            </strong>
            <span className="summary-caption">
              From entered mileage values
            </span>
          </article>

          <article className="summary-card purple-card">
            <div className="summary-top">
              <span className="summary-icon purple-icon">▥</span>
              <span className="summary-label">Fuel Entries</span>
            </div>
            <strong className="summary-value">{entries.length}</strong>
            <span className="summary-caption">Recorded transactions</span>
          </article>
        </section>

        <section className="primary-grid">
          <article className="panel" id="add-fuel">
            <div className="panel-heading">
              <span className="panel-icon green-icon">⛽</span>
              <div>
                <h2>Add Fuel Expense</h2>
                <p>Record your refuelling details</p>
              </div>
            </div>

            <form className="fuel-form" onSubmit={addEntry}>
              <label>
                Vehicle
                <select
                  value={vehicle}
                  onChange={(event) => setVehicle(event.target.value)}
                  required
                >
                  <option value="">Select a vehicle</option>
                  {vehicles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </label>

              <label>
                Price per Litre (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 105"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </label>

              <label>
                Total Amount Paid (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 500"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  required
                />
              </label>

              <label className="full-width">
                Mileage (km/L) <span className="optional-label">Optional</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Enter a known mileage value"
                  value={mileage}
                  onChange={(event) => setMileage(event.target.value)}
                />
              </label>

              <div className="cost-preview full-width">
                <span className="calculator-icon">▦</span>
                <span className="cost-label">Calculated Fuel Quantity</span>
                <strong>{calculatedLitres.toFixed(2)} L</strong>
              </div>

              <button className="save-button full-width" type="submit" disabled={saving || loadingData}>
                {saving ? "Saving..." : "＋ Save Fuel Entry"}
              </button>
            </form>
          </article>

          <article className="panel analytics-panel" id="analytics">
            <div className="panel-heading chart-heading">
              <span className="panel-icon purple-icon">▥</span>
              <div className="chart-title">
                <h2>Monthly Spending</h2>
                <p>Calculated from your actual records</p>
              </div>
              <select
                className="period-select"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Chart period"
              >
                <option>All Time</option>
                <option>Last 3 Months</option>
              </select>
            </div>

            {monthlySpending.length === 0 ? (
              <div className="chart-empty">
                <span>▥</span>
                <strong>No spending data yet</strong>
                <p>Register a vehicle and record a fuel purchase to start your chart.</p>
              </div>
            ) : (
              <>
                <div className="chart-area">
                  <div className="y-axis">
                    <span>{money(chartMaximum)}</span>
                    <span>{money(chartMaximum * 0.75)}</span>
                    <span>{money(chartMaximum * 0.5)}</span>
                    <span>{money(chartMaximum * 0.25)}</span>
                    <span>₹0</span>
                  </div>

                  <div className="bar-chart">
                    {monthlySpending.map((item) => (
                      <div className="bar-column" key={item.month}>
                        <span className="bar-tooltip">{money(item.amount)}</span>
                        <div
                          className="bar"
                          style={{
                            height: `${(item.amount / chartMaximum) * 100}%`,
                          }}
                        />
                        <span className="bar-month">{item.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="chart-disclaimer">
                  Based on recorded fuel expenses.
                </p>
              </>
            )}

            <div className="mini-stats">
              <div className="mini-stat mini-green">
                <span>◷</span>
                <div>
                  <small>Total spending</small>
                  <strong>{money(totalCost)}</strong>
                </div>
              </div>
              <div className="mini-stat mini-blue">
                <span>⛽</span>
                <div>
                  <small>Total litres</small>
                  <strong>{totalLitres.toFixed(2)} L</strong>
                </div>
              </div>
              <div className="mini-stat mini-amber">
                <span>₹</span>
                <div>
                  <small>Average price/L</small>
                  <strong>{money(averagePrice)}</strong>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section className="panel vehicles-panel" id="vehicles">
          <div className="panel-heading">
            <span className="panel-icon green-icon">🚘</span>
            <div>
              <h2>My Vehicles</h2>
              <p>Register and manage your vehicles</p>
            </div>
            <span className="record-count">
              {vehicles.length} vehicles
            </span>
          </div>

          <form className="fuel-form" onSubmit={addVehicle}>
            <label>
              Vehicle Name
              <input
                value={vehicleName}
                onChange={(event) => setVehicleName(event.target.value)}
                placeholder="e.g. My Himalayan"
                maxLength={50}
                required
              />
            </label>

            <label>
              Vehicle Type
              <select
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
              >
                <option>Bike</option>
                <option>Scooter</option>
                <option>Car</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Fuel Type
              <select
                value={fuelType}
                onChange={(event) => setFuelType(event.target.value)}
              >
                <option>Petrol</option>
                <option>Diesel</option>
                <option>CNG</option>
                <option>Electric</option>
                <option>Hybrid</option>
              </select>
            </label>

            <label>
              Registration Number (Optional)
              <input
                value={registration}
                onChange={(event) => setRegistration(event.target.value)}
                placeholder="e.g. AP XX XX 1234"
                maxLength={20}
              />
            </label>

            <button className="save-button full-width" type="submit">
              ＋ Add Vehicle
            </button>
          </form>

          <div className="vehicle-list">
            {vehicles.length === 0 ? (
              <div className="empty-state">
                <span>🚗</span>
                <h3>No vehicles registered</h3>
                <p>Add your first vehicle using the form above.</p>
              </div>
            ) : (
              vehicles.map((item) => (
                <article className="vehicle-card" key={item.id}>
                  <span className="vehicle-card-icon">
                    {item.type === "Car" ? "🚗" : item.type === "Other" ? "🚘" : "🏍️"}
                  </span>

                  <div className="vehicle-card-info">
                    <strong>{item.name}</strong>
                    <span>{item.type} · {item.fuelType}</span>
                    {item.registration && <small>{item.registration}</small>}
                  </div>

                  <button
                    type="button"
                    className="select-vehicle-button"
                    onClick={() => {
                      setVehicle(item.id);
                      navigate("Add Fuel", "add-fuel");
                    }}
                  >
                    Use vehicle
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => deleteVehicle(item.id)}
                    title="Remove vehicle"
                    aria-label={`Remove ${item.name}`}
                  >
                    ×
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel history-panel" id="fuel-history">
          <div className="panel-heading">
            <span className="panel-icon blue-icon">▤</span>
            <div>
              <h2>Fuel History</h2>
              <p>Your recorded refuelling transactions</p>
            </div>
            <span className="record-count">{entries.length} records</span>
          </div>

          {entries.length === 0 ? (
            <div className="empty-state">
              <span>⛽</span>
              <h3>No fuel entries yet</h3>
              <p>Record your first fuel expense to see it here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vehicle</th>
                    <th>Litres</th>
                    <th>Price/L</th>
                    <th>Total Cost</th>
                    <th>Mileage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{dateLabel(entry.date)}</td>
                      <td>{entry.vehicleName}</td>
                      <td>{entry.litres.toFixed(2)} L</td>
                      <td>{money(entry.price)}</td>
                      <td className="table-cost">
                        {money(entry.cost ?? entry.litres * entry.price)}
                      </td>
                      <td>
                        {entry.mileage > 0
                          ? `${entry.mileage.toFixed(1)} km/L`
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => deleteEntry(entry.id)}
                          aria-label="Delete fuel entry"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel ai-panel" id="ai-insights">
          <div className="ai-heading">
            <span className="ai-sparkle">✦</span>
            <div>
              <h2>FuelWise AI Insights</h2>
              <p>Your smarter fuel companion</p>
            </div>
            <span className="beta-badge">IN DEVELOPMENT</span>
          </div>

          <div className="ai-message">
            <span className="tip-icon">↗</span>
            <p>
              You have recorded <strong>{entries.length}</strong> fuel entries.
              Continue tracking expenses to build your fuel history.
            </p>
          </div>

          <div className="ai-message">
            <span className="tip-icon leaf-tip">✦</span>
            <p>
              Your average entered mileage is{" "}
              <strong>{averageMileage.toFixed(1)} km/L</strong>.
              Actual mileage depends on reliable distance and fuel records.
            </p>
          </div>

          <div className="ai-message">
            <span className="tip-icon bulb-tip">✧</span>
            <p>
              <strong>Coming next:</strong> machine-learning expense
              forecasting and mileage anomaly detection.
            </p>
          </div>

          <div className="ai-footer">
            <span className="robot-face">✦</span>
            <div>
              <strong>FuelWise Intelligence</strong>
              <small>Real ML predictions will be added in a later phase.</small>
            </div>
          </div>
        </section>

        <footer className="app-footer">
          FuelWise <span>•</span> Track Every Drop. Control Every Rupee.
        </footer>
      </main>
    </div>
  );
}

export default App;
