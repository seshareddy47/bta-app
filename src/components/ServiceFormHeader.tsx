import { useAuth } from '../context/AuthContext';
import type { ServiceRequest } from '../types';

interface Props {
  service?: ServiceRequest;
}

function formatAudit(name?: string | null, timestamp?: string | null): string {
  if (!name || !timestamp) return 'Not available';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? `${name} — date unavailable` : `${name} — ${date.toLocaleString('en-IN')}`;
}

export function ServiceFormHeader({ service }: Props) {
  const { user } = useAuth();

  return (
    <div className="card__header service-form-header">
      <h3 className="card__title">{service ? 'Edit Service' : 'Add Service'}</h3>
      <div className="service-form-header__audit">
        <p><strong>Added by:</strong> {service
          ? formatAudit(service.createdByName, service.createdAt)
          : `${user?.name ?? 'Unknown user'} — recorded on save`}</p>
        {service?.updatedByName && service.updatedAt && (
          <p><strong>Last updated by:</strong> {formatAudit(service.updatedByName, service.updatedAt)}</p>
        )}
      </div>
    </div>
  );
}
