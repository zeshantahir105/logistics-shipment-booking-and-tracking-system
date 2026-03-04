import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { getApiErrorMessage } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

interface ShipmentListItem {
  id: string;
  shortId: string;
  shipmentNumber?: string;
  status: string;
  shipper: { name: string };
  pickupAddress: { city: string; country: string };
  deliveryAddress: { city: string; country: string };
  updatedAt: string;
}

export function ShipmentTrackingListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const shipmentNumberParam = params.get('shipmentNumber') ?? '';

  // Local input state; debounced value drives the URL and query
  const [inputValue, setInputValue] = useState(shipmentNumberParam);
  const debouncedSearch = useDebounce(inputValue, 400);

  // Sync debounced value to URL
  const searchParam = debouncedSearch.trim();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['shipments', { status, shipmentNumber: searchParam }],
    queryFn: async () => {
      const res = await api.get('/shipments', {
        params: {
          status: status || undefined,
          shipmentNumber: searchParam || undefined,
        },
      });
      return res.data as { items: ShipmentListItem[]; total: number };
    },
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Shipments</div>
            <div className="card-subtitle">Filter by status or search by shipment number.</div>
          </div>
          <Link className="btn" to="/shipments/new">
            New booking
          </Link>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => updateParam('status', e.target.value)}
            >
              <option value="">Any</option>
              <option value="Draft">Draft</option>
              <option value="Booked">Booked</option>
              <option value="InTransit">In Transit</option>
              <option value="Delivered">Delivered</option>
              <option value="Closed">Closed</option>
              <option value="Exception">Exception</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="shipment-number-search">Shipment number</label>
            <input
              id="shipment-number-search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search e.g. SHP-2025..."
              autoComplete="off"
            />
          </div>
        </div>
        {(isLoading || isFetching) && (
          <div className="loading" style={{ marginTop: '0.5rem' }}>
            {isLoading ? 'Loading...' : 'Refreshing...'}
          </div>
        )}
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
              ? `${data.total} shipment${data.total !== 1 ? 's' : ''}`
              : 'No shipments found with current filters.'}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Shipment #</th>
              <th>Shipper</th>
              <th>Route</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/shipments/${s.id}`}>
                    {s.shipmentNumber ?? s.shortId}
                  </Link>
                </td>
                <td>{s.shipper.name}</td>
                <td>
                  {s.pickupAddress.city}, {s.pickupAddress.country} →{' '}
                  {s.deliveryAddress.city}, {s.deliveryAddress.country}
                </td>
                <td>
                  <span className={`badge badge-status-${s.status.toLowerCase()}`}>
                    {s.status === 'InTransit' ? 'In Transit' : s.status}
                  </span>
                </td>
                <td>{new Date(s.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 && !isLoading && (
          <div className="muted" style={{ padding: '1rem 0.5rem' }}>
            No results. Try a different shipment number or status filter.
          </div>
        )}
      </div>
    </div>
  );
}
