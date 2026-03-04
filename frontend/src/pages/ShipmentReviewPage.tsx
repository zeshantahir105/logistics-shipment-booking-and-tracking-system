import { useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { getApiErrorMessage } from '../api/client';

function makeIdempotencyKey() {
  return `web-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function ShipmentReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Stable across re-renders and retries — only regenerated if the component unmounts/remounts
  const idempotencyKeyRef = useRef<string>(makeIdempotencyKey());

  const detailQuery = useQuery({
    queryKey: ['shipment-detail', id],
    queryFn: async () => {
      const res = await api.get(`/shipments/${id}`);
      return res.data as { shipment: any; legs: any[] };
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `/shipments/${id}/submit`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKeyRef.current } }
      );
      return res.data as { shipment: any };
    },
    onSuccess: (data) => {
      navigate(`/shipments/${data.shipment.id}`);
    },
  });

  if (!id) return null;

  const shipment = detailQuery.data?.shipment;
  const legs = detailQuery.data?.legs ?? [];
  const totalPrice = legs.reduce((sum: number, l: any) => sum + (l.price ?? 0), 0);
  const totalTransitDays = legs.reduce((sum: number, l: any) => sum + (l.transitDays ?? 0), 0);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Review & confirm booking</div>
            <div className="card-subtitle">
              Pricing and transit are snapshotted on confirmation and cannot change afterwards.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/shipments/${id}`} className="btn btn-secondary">
              Back
            </Link>
            <button
              className="btn"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !shipment || legs.length === 0}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Confirm booking'}
            </button>
          </div>
        </div>

        {detailQuery.isLoading && <div className="loading">Loading shipment...</div>}

        {detailQuery.error && (
          <div className="error-text" role="alert">
            {getApiErrorMessage(detailQuery.error)}
          </div>
        )}

        {submitMutation.isError && (
          <div className="error-text" role="alert">
            {getApiErrorMessage(submitMutation.error)}
          </div>
        )}

        {legs.length === 0 && shipment && !detailQuery.isLoading && (
          <div className="error-text" role="alert">
            No legs configured. Go back and add at least one transport leg before submitting.
          </div>
        )}

        {shipment && (
          <div className="stack" style={{ marginTop: '0.5rem' }}>
            <div className="stack-row">
              <div>
                <div className="muted">Shipper</div>
                <div>{shipment.shipper.name}</div>
                <div className="muted" style={{ marginTop: '0.15rem' }}>
                  {shipment.shipper.contactEmail}
                </div>
              </div>
              <div>
                <div className="muted">Cargo</div>
                <div>{shipment.cargo.type}</div>
                <div className="muted" style={{ marginTop: '0.15rem' }}>
                  {shipment.cargo.weight} kg · {shipment.cargo.volume} m³
                </div>
              </div>
              <div>
                <div className="muted">Route</div>
                {legs.length > 0 ? (
                  <div>
                    {legs[0].origin} → {legs[legs.length - 1].destination}
                  </div>
                ) : (
                  <div className="muted">—</div>
                )}
              </div>
            </div>

            {legs.length > 0 && (
              <>
                <table className="table" style={{ marginTop: '0.25rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Route</th>
                      <th>Mode</th>
                      <th>Transit days</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map((leg: any) => (
                      <tr key={leg.id}>
                        <td>{leg.sequence}</td>
                        <td>
                          {leg.origin} → {leg.destination}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{leg.mode}</td>
                        <td>{leg.transitDays} days</td>
                        <td>
                          {leg.price?.toLocaleString()} {leg.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="stack-row" style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
                  <div>
                    <div className="muted">Total price</div>
                    <div style={{ fontWeight: 600 }}>
                      {totalPrice.toLocaleString()} {legs[0]?.currency}
                    </div>
                  </div>
                  <div>
                    <div className="muted">Total transit</div>
                    <div style={{ fontWeight: 600 }}>{totalTransitDays} days</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
