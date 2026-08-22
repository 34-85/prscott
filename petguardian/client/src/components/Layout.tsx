import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-bold text-lg">
            <span aria-hidden>🛡️🐾</span> PetGuardian
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {user && (
              <>
                <NavItem to="/dashboard">My Plans</NavItem>
                <NavItem to="/learn">State Law</NavItem>
                <NavItem to="/account">Account</NavItem>
                <span className="mx-2 text-brand-100/70 hidden sm:inline">{user.fullName}</span>
                <button
                  className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/20"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            )}
            {!user && (
              <>
                <NavItem to="/learn">State Law</NavItem>
                <NavItem to="/login">Sign in</NavItem>
                <Link to="/register" className="rounded-lg px-3 py-1.5 bg-white text-brand-900 font-semibold">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 space-y-2">
          <p>
            PetGuardian provides general educational information and self-help document preparation.
            It is not a law firm and does not provide legal advice. Review all documents with a
            licensed attorney in your state before signing or funding.
          </p>
          <Link to="/privacy" className="text-brand-600 font-medium hover:underline">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-3 py-1.5 hover:bg-white/10 ${isActive ? 'bg-white/15' : ''}`
      }
    >
      {children}
    </NavLink>
  );
}
