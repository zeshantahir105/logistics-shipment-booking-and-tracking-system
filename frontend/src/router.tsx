import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { CarrierSearchPage } from './pages/CarrierSearchPage';
import { ShipmentDraftPage } from './pages/ShipmentDraftPage';
import { ShipmentReviewPage } from './pages/ShipmentReviewPage';
import { ShipmentTrackingListPage } from './pages/ShipmentTrackingListPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';

function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
      <div className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        404
      </div>
      <div className="muted">No page found at {pathname}</div>
      <div style={{ marginTop: '1rem' }}>
        <Link to="/" className="btn">
          Back to home
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Logistics Console</div>
        <nav className="nav-links">
          <Link to="/carriers">Carrier Search</Link>
          <Link to="/shipments">Shipments</Link>
          <Link to="/shipments/new">New Booking</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CarrierSearchPage />} />
          <Route path="/carriers" element={<CarrierSearchPage />} />
          <Route path="/shipments" element={<ShipmentTrackingListPage />} />
          <Route path="/shipments/new" element={<ShipmentDraftPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/shipments/:id/review" element={<ShipmentReviewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

