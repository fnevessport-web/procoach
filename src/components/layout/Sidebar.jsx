import { useLocation, useNavigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { getNavItems } from '../../constants/navItems'

export function Sidebar() {
  const { role } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()

  const items = getNavItems(role)

  return (
    <nav className="sidebar-desktop">
      <div className="sidebar-logo">
        <img src="/images/logoprocoach.png" alt="ProCoach" />
      </div>

      <div className="sidebar-items">
        {items.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`sidebar-item${active ? ' sidebar-item-active' : ''}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
