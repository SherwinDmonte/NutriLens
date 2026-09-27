import { Database, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';

import { AuthenticatedAppShell } from '../components/auth/AuthenticatedAppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { useAuth } from '../context/authContext.js';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <AuthenticatedAppShell contentId="profile-content">
      <div className="profile-shell">
        <section className="profile-heading" aria-labelledby="profile-heading">
          <p className="dashboard-kicker">Account & privacy</p>
          <h1 id="profile-heading">Your account, clearly explained.</h1>
          <p>Review your identity, session protection, and what NutriLens stores.</p>
        </section>

        <div className="profile-grid">
          <Card className="profile-card profile-identity-card">
            <div className="profile-avatar" aria-hidden="true">
              {user?.name?.charAt(0).toUpperCase() || <UserRound size={24} />}
            </div>
            <div className="profile-identity-copy">
              <p className="dashboard-kicker">Signed in as</p>
              <h2>{user?.name}</h2>
              <span>
                <Mail size={15} aria-hidden="true" /> {user?.email}
              </span>
            </div>
          </Card>

          <Card className="profile-info-card">
            <span className="profile-card-icon" aria-hidden="true">
              <KeyRound size={20} />
            </span>
            <div>
              <h2>Secure session</h2>
              <p>
                Your signed-in session uses a protected HTTP-only cookie instead of browser storage.
              </p>
            </div>
          </Card>

          <Card className="profile-info-card">
            <span className="profile-card-icon" aria-hidden="true">
              <Database size={20} />
            </span>
            <div>
              <h2>Data you choose to save</h2>
              <p>
                Your manual food entries and explicitly saved recipes are stored for this account.
              </p>
            </div>
          </Card>

          <Card className="profile-privacy-card">
            <ShieldCheck size={25} aria-hidden="true" />
            <div>
              <p className="dashboard-kicker">Provider privacy boundary</p>
              <h2>Your identity is not part of a recipe request.</h2>
              <p>
                NutriLens protects recipe requests with your session, but does not send your name,
                email, session, or food-log history to a recipe provider.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AuthenticatedAppShell>
  );
}
