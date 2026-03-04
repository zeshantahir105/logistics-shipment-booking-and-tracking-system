import { useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  saveLegs, deleteLeg,
  updateLegStatus, closeShipment,
  createException, resolveException,
  type LegInput, type ShipmentLeg,
} from '../api/shipments';
import { searchCarrierServices, type CarrierService } from '../api/carriers';
import { getApiErrorMessage } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';

function LegEditor({
  shipmentId,
  existingLegs,
  onSaved,
}: {
  shipmentId: string;
  existingLegs: ShipmentLeg[];
  onSaved: () => void;
}) {
    const [serviceSearch, setServiceSearch] = useState('');
  const [selectedService, setSelectedService] = useState<CarrierService | null>(null);
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    service?: string;
    departure?: string;
    arrival?: string;
  }>({});

  const debouncedSearch = useDebounce(serviceSearch, 400);

  const servicesQuery = useQuery({
    queryKey: ['carrier-services-picker', debouncedSearch],
    queryFn: () =>
      searchCarrierServices({
        q: debouncedSearch || undefined,
        pageSize: 50,
      }),
    enabled: debouncedSearch.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: (leg: LegInput) =>
      saveLegs(shipmentId, [leg]),
    onSuccess: () => {
      setSelectedService(null);
      setServiceSearch('');
      setDeparture('');
      setArrival('');
      setFormError('');
      setFieldErrors({});
      onSaved();
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (legId: string) => deleteLeg(shipmentId, legId),
    onSuccess: onSaved,
    onError: (err) => setFormError(getApiErrorMessage(err)),
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    const errs: typeof fieldErrors = {};

    if (!selectedService) errs.service = 'Select a carrier service first.';

    const departureDate = departure ? new Date(departure) : null;
    const arrivalDate = arrival ? new Date(arrival) : null;

    if (!departure) {
      errs.departure = 'Scheduled departure is required.';
    } else if (!departureDate || isNaN(departureDate.getTime())) {
      errs.departure = 'Departure date is invalid — use the date/time picker.';
    }

    if (!arrival) {
      errs.arrival = 'Scheduled arrival is required.';
    } else if (!arrivalDate || isNaN(arrivalDate.getTime())) {
      errs.arrival = 'Arrival date is invalid — use the date/time picker.';
    } else if (departureDate && arrivalDate <= departureDate) {
      errs.arrival = 'Arrival must be after departure.';
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const nextSequence = existingLegs.length + 1;
    saveMutation.mutate({
      sequence: nextSequence,
      carrierServiceId: selectedService!.id,
      scheduledDeparture: departureDate!.toISOString(),
      scheduledArrival: arrivalDate!.toISOString(),
    });
  }

  return (
    <div className="stack">
      {/* Existing legs */}
      {existingLegs.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Route</th>
              <th>Mode</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Days</th>
              <th>Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {existingLegs.map((leg) => (
              <tr key={leg.id}>
                <td>{leg.sequence}</td>
                <td>{leg.origin} → {leg.destination}</td>
                <td style={{ textTransform: 'capitalize' }}>{leg.mode}</td>
                <td>{new Date(leg.scheduledDeparture).toLocaleString()}</td>
                <td>{new Date(leg.scheduledArrival).toLocaleString()}</td>
                <td>{leg.transitDays}d</td>
                <td>{leg.price.toLocaleString()} {leg.currency}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    onClick={() => deleteMutation.mutate(leg.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {existingLegs.length === 0 && (
        <div className="muted">No legs added yet. Use the form below to add the first leg.</div>
      )}

      {/* Summary row */}
      {existingLegs.length > 0 && (
        <div className="stack-row" style={{ borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: '0.5rem' }}>
          <div>
            <span className="muted">Total price: </span>
            <strong>
              {existingLegs.reduce((s, l) => s + l.price, 0).toLocaleString()}{' '}
              {existingLegs[0]?.currency}
            </strong>
          </div>
          <div>
            <span className="muted">Total transit: </span>
            <strong>{existingLegs.reduce((s, l) => s + l.transitDays, 0)} days</strong>
          </div>
          <div>
            <span className="muted">ETA: </span>
            <strong>
              {new Date(
                existingLegs[existingLegs.length - 1].scheduledArrival
              ).toLocaleDateString()}
            </strong>
          </div>
        </div>
      )}

      {/* Add leg form */}
      <form onSubmit={handleAdd} noValidate>
        <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
          Add leg {existingLegs.length + 1}
          {existingLegs.length > 0 && (
            <> — must use the same carrier group as previous legs</>
          )}
        </div>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="service-search">Search carrier service (origin or destination)</label>
            <input
              id="service-search"
              value={serviceSearch}
              className={fieldErrors.service ? 'field-error' : ''}
              onChange={(e) => {
                setServiceSearch(e.target.value);
                setSelectedService(null);
                if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: undefined }));
              }}
              placeholder="e.g. Karachi, Dubai, Riyadh..."
              autoComplete="off"
            />
            {fieldErrors.service && (
              <span className="field-error-msg" role="alert">{fieldErrors.service}</span>
            )}
            {/* Dropdown results */}
            {debouncedSearch && servicesQuery.data && (
              <div style={{
                marginTop: '0.25rem',
                background: '#0f172a',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: '0.5rem',
                maxHeight: '180px',
                overflowY: 'auto',
              }}>
                {servicesQuery.data.data.length === 0 && (
                  <div className="muted" style={{ padding: '0.5rem' }}>No services found.</div>
                )}
                {servicesQuery.data.data.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => {
                      setSelectedService(svc);
                      setServiceSearch(`${svc.origin} → ${svc.destination} (${svc.mode})`);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(148,163,184,0.15)',
                      fontSize: '0.8rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div>
                      <strong>{svc.origin} → {svc.destination}</strong>
                      <span className="muted"> · {svc.mode} · {svc.transitDays}d</span>
                    </div>
                    <div className="muted">
                      Group: {svc.carrierGroupId} · {svc.basePrice.toLocaleString()} {svc.currency}
                      · max {svc.maxWeight}kg / {svc.maxVolume}m³
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedService && (
              <div style={{
                marginTop: '0.25rem',
                padding: '0.4rem 0.6rem',
                background: 'rgba(59,130,246,0.15)',
                borderRadius: '0.4rem',
                fontSize: '0.75rem',
              }}>
                Selected: <strong>{selectedService.origin} → {selectedService.destination}</strong>
                {' '}· {selectedService.mode} · {selectedService.transitDays} days
                · {selectedService.basePrice.toLocaleString()} {selectedService.currency}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="leg-departure">Scheduled departure</label>
            <input
              id="leg-departure"
              type="datetime-local"
              value={departure}
              className={fieldErrors.departure ? 'field-error' : ''}
              onChange={(e) => {
                setDeparture(e.target.value);
                if (fieldErrors.departure) setFieldErrors((p) => ({ ...p, departure: undefined }));
              }}
            />
            {fieldErrors.departure && (
              <span className="field-error-msg" role="alert">{fieldErrors.departure}</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="leg-arrival">Scheduled arrival</label>
            <input
              id="leg-arrival"
              type="datetime-local"
              value={arrival}
              className={fieldErrors.arrival ? 'field-error' : ''}
              min={departure}
              onChange={(e) => {
                setArrival(e.target.value);
                if (fieldErrors.arrival) setFieldErrors((p) => ({ ...p, arrival: undefined }));
              }}
            />
            {fieldErrors.arrival && (
              <span className="field-error-msg" role="alert">{fieldErrors.arrival}</span>
            )}
          </div>
        </div>

        {formError && (
          <div
            className="error-text"
            role="alert"
            style={{
              marginTop: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '0.4rem',
              fontSize: '0.85rem',
            }}
          >
            {formError}
          </div>
        )}

        <div style={{ marginTop: '0.75rem' }}>
          <button className="btn" type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Adding leg...' : `Add leg ${existingLegs.length + 1}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Active legs panel (Booked / InTransit / Exception / Delivered) ────────────

function ActiveLegsPanel({
  shipmentId,
  shipmentStatus,
  legs,
  onUpdated,
}: {
  shipmentId: string;
  shipmentStatus?: string;
  legs: ShipmentLeg[];
  onUpdated: () => void;
}) {
  const [exceptionLegId, setExceptionLegId] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [description, setDescription] = useState('');
  const [panelError, setPanelError] = useState('');

  const advanceMutation = useMutation({
    mutationFn: ({ legId, status }: { legId: string; status: string }) =>
      updateLegStatus(shipmentId, legId, status),
    onSuccess: () => { setPanelError(''); onUpdated(); },
    onError: (err) => setPanelError(getApiErrorMessage(err)),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeShipment(shipmentId),
    onSuccess: () => { setPanelError(''); onUpdated(); },
    onError: (err) => setPanelError(getApiErrorMessage(err)),
  });

  const exceptionMutation = useMutation({
    mutationFn: ({ legId, reasonCode, description }: { legId: string; reasonCode: string; description: string }) =>
      createException(shipmentId, legId, reasonCode, description),
    onSuccess: () => {
      setExceptionLegId(null);
      setReasonCode('');
      setDescription('');
      setPanelError('');
      onUpdated();
    },
    onError: (err) => setPanelError(getApiErrorMessage(err)),
  });

  const resolveMutation = useMutation({
    mutationFn: (legId: string) => resolveException(shipmentId, legId),
    onSuccess: () => { setPanelError(''); onUpdated(); },
    onError: (err) => setPanelError(getApiErrorMessage(err)),
  });

  const allDelivered = legs.length > 0 && legs.every((l) => l.status === 'Delivered');
  const canClose = allDelivered && shipmentStatus !== 'Closed';

  return (
    <div className="stack">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Route</th>
            <th>Mode</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg) => (
            <tr key={leg.id}>
              <td>{leg.sequence}</td>
              <td>{leg.origin} → {leg.destination}</td>
              <td style={{ textTransform: 'capitalize' }}>{leg.mode}</td>
              <td>{new Date(leg.scheduledDeparture).toLocaleString()}</td>
              <td>{new Date(leg.scheduledArrival).toLocaleString()}</td>
              <td>
                <span className={`badge badge-status-${(leg.status ?? 'draft').toLowerCase()}`}>
                  {leg.status === 'InTransit' ? 'In Transit' : leg.status}
                </span>
                {leg.exception && !leg.exception.resolvedAt && (
                  <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '0.15rem' }}>
                    {leg.exception.reasonCode}
                    {leg.exception.description && ` — ${leg.exception.description}`}
                  </div>
                )}
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {leg.status === 'Booked' && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                      disabled={advanceMutation.isPending}
                      onClick={() => advanceMutation.mutate({ legId: leg.id, status: 'InTransit' })}
                    >
                      Start transit
                    </button>
                  )}
                  {leg.status === 'InTransit' && (
                    <>
                      <button
                        className="btn"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                        disabled={advanceMutation.isPending}
                        onClick={() => advanceMutation.mutate({ legId: leg.id, status: 'Delivered' })}
                      >
                        Delivered
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', color: '#f87171' }}
                        onClick={() => { setExceptionLegId(leg.id); setPanelError(''); }}
                      >
                        Flag exception
                      </button>
                    </>
                  )}
                  {leg.status === 'Exception' && !leg.exception?.resolvedAt && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                      disabled={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate(leg.id)}
                    >
                      Resolve exception
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {legs.length === 0 && (
        <div className="muted" style={{ padding: '0.5rem 0' }}>No legs recorded.</div>
      )}

      {/* Close shipment */}
      {canClose && (
        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <button
            className="btn"
            disabled={closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending ? 'Closing...' : 'Close shipment'}
          </button>
          <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.8rem' }}>
            All legs delivered — close to finalise.
          </span>
        </div>
      )}

      {/* Exception form */}
      {exceptionLegId && (
        <div
          style={{
            padding: '0.75rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '0.5rem',
          }}
        >
          <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>
            Flag exception on leg
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="exc-reason">Reason code <span style={{ color: '#f87171' }}>*</span></label>
              <input
                id="exc-reason"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                placeholder="e.g. CUSTOMS_HOLD"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="exc-description">Description (optional)</label>
              <input
                id="exc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details..."
                autoComplete="off"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              className="btn"
              style={{ background: '#ef4444' }}
              disabled={exceptionMutation.isPending || !reasonCode.trim()}
              onClick={() =>
                exceptionMutation.mutate({ legId: exceptionLegId, reasonCode, description })
              }
            >
              {exceptionMutation.isPending ? 'Saving...' : 'Submit exception'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setExceptionLegId(null); setReasonCode(''); setDescription(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {panelError && (
        <div
          className="error-text"
          role="alert"
          style={{
            padding: '0.6rem 0.75rem',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '0.4rem',
          }}
        >
          {panelError}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shipment-detail', id],
    queryFn: async () => {
      const res = await api.get(`/shipments/${id}`);
      return res.data as { shipment: any; legs: ShipmentLeg[]; history: any[] };
    },
    enabled: !!id,
  });

  if (!id) return null;

  const shipment = data?.shipment;
  const legs = data?.legs ?? [];
  const history = data?.history ?? [];
  const isDraft = shipment?.status === 'Draft';

  function refreshDetail() {
    void queryClient.invalidateQueries({ queryKey: ['shipment-detail', id] });
  }

  return (
    <div className="stack">
      {/* Header card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              {shipment?.shipmentNumber ?? shipment?.shortId ?? 'Shipment'}
            </div>
            <div className="card-subtitle" style={{ marginTop: '0.25rem' }}>
              <span className={`badge badge-status-${(shipment?.status ?? 'Draft').toLowerCase()}`}>
                {shipment?.status === 'InTransit' ? 'In Transit' : (shipment?.status ?? '—')}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isDraft && legs.length > 0 && (
              <Link to={`/shipments/${id}/review`} className="btn">
                Review & submit
              </Link>
            )}
            {isDraft && legs.length === 0 && (
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                Add legs below before submitting
              </span>
            )}
            {!isDraft && (
              <Link to={`/shipments/${id}/review`} className="btn btn-secondary">
                View review
              </Link>
            )}
          </div>
        </div>

        {isLoading && <div className="loading">Loading...</div>}
        {error && <div className="error-text" role="alert">{getApiErrorMessage(error)}</div>}

        {shipment && (
          <div className="stack">
            <div className="stack-row">
              <div>
                <div className="muted">Shipper</div>
                <div>{shipment.shipper.name}</div>
                <div className="muted">{shipment.shipper.contactEmail}</div>
              </div>
              <div>
                <div className="muted">Cargo</div>
                <div>{shipment.cargo.type}</div>
                <div className="muted">{shipment.cargo.weight} kg · {shipment.cargo.volume} m³</div>
              </div>
              <div>
                <div className="muted">Pickup</div>
                <div>{shipment.pickupAddress.city}, {shipment.pickupAddress.country}</div>
              </div>
              <div>
                <div className="muted">Delivery</div>
                <div>{shipment.deliveryAddress.city}, {shipment.deliveryAddress.country}</div>
              </div>
              {shipment.requiredDeliveryDate && (
                <div>
                  <div className="muted">Required by</div>
                  <div>{new Date(shipment.requiredDeliveryDate).toLocaleDateString()}</div>
                </div>
              )}
            </div>

            {shipment.snapshot && (
              <div className="stack-row" style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: '0.75rem' }}>
                <div>
                  <div className="muted">Booked total</div>
                  <div style={{ fontWeight: 600 }}>
                    {shipment.snapshot.totalPrice.toLocaleString()} {shipment.snapshot.currency}
                  </div>
                </div>
                <div>
                  <div className="muted">Transit</div>
                  <div>{shipment.snapshot.totalTransitDays} days</div>
                </div>
                <div>
                  <div className="muted">ETA</div>
                  <div>
                    {shipment.snapshot.estimatedArrivalDate
                      ? new Date(shipment.snapshot.estimatedArrivalDate).toLocaleDateString()
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legs card — editable if Draft */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Transport legs</div>
            <div className="card-subtitle">
              {isDraft
                ? 'All legs must belong to the same carrier group.'
                : 'Route segments for this shipment.'}
            </div>
          </div>
        </div>

        {shipment && isDraft ? (
          <LegEditor
            shipmentId={id}
            existingLegs={legs}
            onSaved={refreshDetail}
          />
        ) : (
          <ActiveLegsPanel
            shipmentId={id}
            shipmentStatus={shipment?.status}
            legs={legs}
            onUpdated={refreshDetail}
          />
        )}
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Timeline</div>
        </div>
        <div className="stack">
          {history.map((h) => (
            <div key={h.id} className="stack-row">
              <div className="muted" style={{ whiteSpace: 'nowrap' }}>
                {new Date(h.changedAt).toLocaleString()}
              </div>
              <div>
                <span className={`badge badge-status-${(h.fromStatus ?? 'draft').toLowerCase()}`}>
                  {h.fromStatus ?? '—'}
                </span>
                {' → '}
                <span className={`badge badge-status-${h.toStatus.toLowerCase()}`}>
                  {h.toStatus}
                </span>
                {h.reasonCode && <span className="muted"> · {h.reasonCode}</span>}
                {h.note && <span className="muted"> · {h.note}</span>}
              </div>
            </div>
          ))}
          {history.length === 0 && <div className="muted">No status events yet.</div>}
        </div>
      </div>
    </div>
  );
}
