import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCarrierServices } from '../api/carriers';
import { getApiErrorMessage } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

export function CarrierSearchPage() {
  const [params, setParams] = useSearchParams();

  // Text inputs: local state → debounced → URL + query
  const [originInput, setOriginInput] = useState(params.get('origin') ?? '');
  const [destinationInput, setDestinationInput] = useState(params.get('destination') ?? '');

  // Dropdowns: no debounce needed, update URL immediately
  const mode = params.get('mode') ?? '';
  const sort = params.get('sort') ?? 'price';

  const debouncedOrigin = useDebounce(originInput, 400);
  const debouncedDestination = useDebounce(destinationInput, 400);

  // Sync debounced text values into URL params
  // (Dropdowns already write to URL directly, so they're already in params)
  const effectiveOrigin = debouncedOrigin;
  const effectiveDestination = debouncedDestination;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['carrier-services', { effectiveOrigin, effectiveDestination, mode, sort }],
    queryFn: () =>
      searchCarrierServices({
        origin: effectiveOrigin || undefined,
        destination: effectiveDestination || undefined,
        mode: mode || undefined,
        sort,
      }),
  });

  function updateDropdown(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const showSpinner = isLoading || isFetching;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Search carrier services</div>
            <div className="card-subtitle">
              Filter by route and mode. Results update automatically as you type.
            </div>
          </div>
          {showSpinner && <div className="loading">Searching...</div>}
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="origin-input">Origin</label>
            <input
              id="origin-input"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="e.g. Karachi"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="destination-input">Destination</label>
            <input
              id="destination-input"
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              placeholder="e.g. Riyadh"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="mode-select">Mode</label>
            <select
              id="mode-select"
              value={mode}
              onChange={(e) => updateDropdown('mode', e.target.value)}
            >
              <option value="">Any</option>
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="road">Road</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort-select">Sort by</label>
            <select
              id="sort-select"
              value={sort}
              onChange={(e) => updateDropdown('sort', e.target.value)}
            >
              <option value="price">Price (low to high)</option>
              <option value="transitTime">Transit time (fastest first)</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="error-text" role="alert" style={{ marginTop: '0.5rem' }}>
            {getApiErrorMessage(error)}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Results</div>
          <div className="card-subtitle">
            {data?.total
              ? `${data.total} service${data.total !== 1 ? 's' : ''} found`
              : 'No services yet — adjust filters to search.'}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Carrier group</th>
              <th>Mode</th>
              <th>Route</th>
              <th>Transit days</th>
              <th>Max weight</th>
              <th>Max volume</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id}>
                <td>{s.carrierGroupId}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.mode}</td>
                <td>
                  {s.origin} → {s.destination}
                </td>
                <td>{s.transitDays} days</td>
                <td>{s.maxWeight.toLocaleString()} kg</td>
                <td>{s.maxVolume.toLocaleString()} m³</td>
                <td>
                  {s.basePrice.toLocaleString()} {s.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data.length === 0 && !isLoading && (
          <div className="muted" style={{ padding: '1rem 0.5rem' }}>
            No services match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
