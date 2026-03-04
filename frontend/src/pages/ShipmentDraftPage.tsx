import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createDraft, type ShipmentDraftInput } from '../api/shipments';
import { getApiErrorMessage, getApiFieldErrors } from '../api/client';

type FormErrors = Partial<Record<string, string>>;

function validateDraftForm(form: ShipmentDraftInput): FormErrors {
  const errors: FormErrors = {};

  if (!form.shipper.name.trim()) errors['shipper.name'] = 'Shipper name is required';
  if (!form.shipper.contactEmail.trim()) {
    errors['shipper.contactEmail'] = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.shipper.contactEmail)) {
    errors['shipper.contactEmail'] = 'Enter a valid email address';
  }

  if (!form.cargo.type.trim()) errors['cargo.type'] = 'Cargo type is required';
  if (!form.cargo.weight || form.cargo.weight <= 0)
    errors['cargo.weight'] = 'Weight must be greater than 0';
  if (!form.cargo.volume || form.cargo.volume <= 0)
    errors['cargo.volume'] = 'Volume must be greater than 0';

  if (!form.pickupAddress.line1.trim()) errors['pickupAddress.line1'] = 'Address is required';
  if (!form.pickupAddress.city.trim()) errors['pickupAddress.city'] = 'City is required';
  if (!form.pickupAddress.country.trim()) errors['pickupAddress.country'] = 'Country is required';

  if (!form.deliveryAddress.line1.trim()) errors['deliveryAddress.line1'] = 'Address is required';
  if (!form.deliveryAddress.city.trim()) errors['deliveryAddress.city'] = 'City is required';
  if (!form.deliveryAddress.country.trim())
    errors['deliveryAddress.country'] = 'Country is required';

  return errors;
}

function FieldInput({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={error ? 'field-error' : ''} {...props} />
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}

export function ShipmentDraftPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ShipmentDraftInput>({
    shipper: { name: '', contactEmail: '' },
    pickupAddress: { line1: '', city: '', country: '' },
    deliveryAddress: { line1: '', city: '', country: '' },
    cargo: { type: '', weight: 0, volume: 0 },
    requiredDeliveryDate: null,
  });
  const [clientErrors, setClientErrors] = useState<FormErrors>({});

  const mutation = useMutation({
    mutationFn: createDraft,
    onSuccess: (shipment) => {
      navigate(`/shipments/${shipment.id}`);
    },
    onError: (err) => {
      const apiErrors = getApiFieldErrors(err);
      if (Object.keys(apiErrors).length > 0) {
        setClientErrors(apiErrors);
      }
    },
  });

  function err(field: string) {
    return clientErrors[field];
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validateDraftForm(form);
    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
    mutation.mutate(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="stack">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">New shipment</div>
            <div className="card-subtitle">
              Enter shipper details, cargo info, and pickup/delivery addresses.
            </div>
          </div>
          <button className="btn" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating draft...' : 'Save draft'}
          </button>
        </div>

        <div className="stack">
          {/* Shipper */}
          <div style={{ marginBottom: '0.25rem' }}>
            <div className="card-subtitle" style={{ marginBottom: '0.5rem' }}>
              Shipper information
            </div>
            <div className="form-grid">
              <FieldInput
                id="shipper-name"
                label="Shipper name"
                value={form.shipper.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, shipper: { ...f.shipper, name: e.target.value } }))
                }
                autoComplete="organization"
                error={err('shipper.name')}
              />
              <FieldInput
                id="shipper-email"
                label="Contact email"
                type="email"
                value={form.shipper.contactEmail}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shipper: { ...f.shipper, contactEmail: e.target.value },
                  }))
                }
                autoComplete="email"
                error={err('shipper.contactEmail')}
              />
            </div>
          </div>

          {/* Cargo */}
          <div>
            <div className="card-subtitle" style={{ marginBottom: '0.5rem' }}>
              Cargo
            </div>
            <div className="form-grid">
              <FieldInput
                id="cargo-type"
                label="Cargo type"
                value={form.cargo.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cargo: { ...f.cargo, type: e.target.value } }))
                }
                placeholder="e.g. Electronics"
                error={err('cargo.type')}
              />
              <FieldInput
                id="cargo-weight"
                label="Weight (kg)"
                type="number"
                min="0.01"
                step="0.01"
                value={form.cargo.weight || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cargo: { ...f.cargo, weight: parseFloat(e.target.value) || 0 },
                  }))
                }
                error={err('cargo.weight')}
              />
              <FieldInput
                id="cargo-volume"
                label="Volume (m³)"
                type="number"
                min="0.01"
                step="0.01"
                value={form.cargo.volume || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cargo: { ...f.cargo, volume: parseFloat(e.target.value) || 0 },
                  }))
                }
                error={err('cargo.volume')}
              />
              <div className="field">
                <label htmlFor="required-delivery-date">Required delivery date (optional)</label>
                <input
                  id="required-delivery-date"
                  type="date"
                  value={
                    form.requiredDeliveryDate
                      ? form.requiredDeliveryDate.slice(0, 10)
                      : ''
                  }
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      requiredDeliveryDate: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Pickup address */}
          <div>
            <div className="card-subtitle" style={{ marginBottom: '0.5rem' }}>
              Pickup address
            </div>
            <div className="form-grid">
              <FieldInput
                id="pickup-line1"
                label="Street address"
                value={form.pickupAddress.line1}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pickupAddress: { ...f.pickupAddress, line1: e.target.value },
                  }))
                }
                error={err('pickupAddress.line1')}
              />
              <FieldInput
                id="pickup-city"
                label="City"
                value={form.pickupAddress.city}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pickupAddress: { ...f.pickupAddress, city: e.target.value },
                  }))
                }
                error={err('pickupAddress.city')}
              />
              <FieldInput
                id="pickup-country"
                label="Country"
                value={form.pickupAddress.country}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pickupAddress: { ...f.pickupAddress, country: e.target.value },
                  }))
                }
                error={err('pickupAddress.country')}
              />
            </div>
          </div>

          {/* Delivery address */}
          <div>
            <div className="card-subtitle" style={{ marginBottom: '0.5rem' }}>
              Delivery address
            </div>
            <div className="form-grid">
              <FieldInput
                id="delivery-line1"
                label="Street address"
                value={form.deliveryAddress.line1}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryAddress: { ...f.deliveryAddress, line1: e.target.value },
                  }))
                }
                error={err('deliveryAddress.line1')}
              />
              <FieldInput
                id="delivery-city"
                label="City"
                value={form.deliveryAddress.city}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryAddress: { ...f.deliveryAddress, city: e.target.value },
                  }))
                }
                error={err('deliveryAddress.city')}
              />
              <FieldInput
                id="delivery-country"
                label="Country"
                value={form.deliveryAddress.country}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deliveryAddress: { ...f.deliveryAddress, country: e.target.value },
                  }))
                }
                error={err('deliveryAddress.country')}
              />
            </div>
          </div>

          {mutation.isError && (
            <div className="error-text" role="alert">
              {getApiErrorMessage(mutation.error)}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
