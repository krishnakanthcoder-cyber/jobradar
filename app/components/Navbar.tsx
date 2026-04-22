export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <a href="/" className="navbar-logo">
          <span className="navbar-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Concentric radar arcs from bottom-left origin */}
              <path d="M 3,18 A 5,5 0 0,1 8,23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M 3,12 A 11,11 0 0,1 14,23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              {/* Sweep line */}
              <line x1="3" y1="23" x2="17" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.45"/>
              {/* Origin dot */}
              <circle cx="3" cy="23" r="2" fill="white"/>
              {/* Detection blip */}
              <circle cx="13" cy="11" r="2" fill="white"/>
              <circle cx="13" cy="11" r="4" stroke="white" strokeWidth="1" strokeOpacity="0.3"/>
            </svg>
          </span>
          <span className="navbar-logo-text">JobRadar</span>
        </a>

        <span className="navbar-tagline">Engineering Jobs Monitor</span>

        <nav className="navbar-nav">
          <a href="/" className="navbar-link">Jobs</a>
          <a href="/subscribers" className="navbar-link">Subscribers</a>
        </nav>

        <div className="navbar-right">
          <span className="navbar-badge">US Only</span>
          <span className="navbar-badge">Greenhouse · Ashby</span>
        </div>
      </div>
    </header>
  );
}
