import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCarrierServices, listCarriers } from '../api/carriers';
import { getApiErrorMessage } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

export function CarrierSearchPage() {
  const [params, setParams] = useSearchParams();

  const [originInput, setOriginInput] = useState(params.get('origin') ?? '');
  const [destinationInput, setDestinationInput] = useState(params.get('destination') ?? '');

  const mode = params.get('mode') ?? '';
  const sort = params.get('sort') ?? 'price';
  const carrierId = params.get('carrierId') ?? '';

  const debouncedOrigin = useDebounce(originInput, 400);
  const debouncedDestination = useDebounce(destinationInput, 400);

  const carriersQuery = useQuery({
    queryKey: ['carriers-list'],
    queryFn: listCarriers,
    staleTime: Infinity,
  });

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['carrier-services', { debouncedOrigin, debouncedDestination, mode, sort, carrierId }],
    queryFn: () =>
      searchCarrierServices({
        origin: debouncedOrigin || undefined,
        destination: debouncedDestination || undefined,
        mode: mode || undefined,
        carrierId: carrierId || undefined,
        sort,
      }),
  });

  function updateParam(key: string, value: string) {
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
              Filter by route, carrier, and mode. Results update as you type.
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
            <label htmlFor="carrier-select">Carrier</label>
            <select
              id="carrier-select"
              value={carrierId}
              onChange={(e) => updateParam('carrierId', e.target.value)}
            >
              <option value="">Any carrier</option>
              {carriersQuery.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mode-select">Mode</label>
            <select
              id="mode-select"
              value={mode}
              onChange={(e) => updateParam('mode', e.target.value)}
            >
              <option value="">Any mode</option>
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
              onChange={(e) => updateParam('sort', e.target.value)}
            >
              <option value="price">Price (low → high)</option>
              <option value="transitTime">Transit time (fastest first)</option>
              <option value="carrierName">Carrier name (A → Z)</option>
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
            {data?.total != null
              ? `${data.total} service${data.total !== 1 ? 's' : ''} found`
              : 'Adjust filters to search.'}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Carrier</th>
              <th>Group</th>
              <th>Mode</th>
              <th>Route</th>
              <th>Transit</th>
              <th>Max weight</th>
              <th>Max volume</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((s) => (
              <tr key={s.id}>
                <td>{s.carrierName}</td>
                <td style={{ fontSize: '0.75rem' }} className="muted">{s.carrierGroupId}</td>
                <td style={{ textTransform: 'capitalize' }}>{s.mode}</td>
                <td>{s.origin} → {s.destination}</td>
                <td>{s.transitDays}d</td>
                <td>{s.maxWeight.toLocaleString()} kg</td>
                <td>{s.maxVolume.toLocaleString()} m³</td>
                <td>{s.basePrice.toLocaleString()} {s.currency}</td>
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
