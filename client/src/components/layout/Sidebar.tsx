import { useLocation, Link } from "wouter";
import { 
  Monitor, 
  Network, 
  Wifi, 
  Server, 
  Shield, 
  Boxes, 
  Users, 
  AlertTriangle,
  LogOut
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { 
      section: "DASHBOARD", 
      items: [
        { label: "Overview", href: "/", icon: <Monitor className="h-5 w-5 mr-2" /> }
      ]
    },
    { 
      section: "MONITORING", 
      items: [
        { label: "Performance", href: "/performance", icon: <Network className="h-5 w-5 mr-2" stroke="currentColor" />  },
        { label: "Network", href: "/network", icon: <Network className="h-5 w-5 mr-2" /> },
        { label: "Wireless", href: "/wireless", icon: <Wifi className="h-5 w-5 mr-2" /> },
        { label: "CAPsMAN", href: "/capsman", icon: <Server className="h-5 w-5 mr-2" /> },
        { label: "Security", href: "/firewalls", icon: <Shield className="h-5 w-5 mr-2" /> }
      ]
    },
    { 
      section: "MANAGEMENT", 
      items: [
        { label: "Devices", href: "/devices", icon: <Boxes className="h-5 w-5 mr-2" /> },
        { label: "Clients", href: "/clients", icon: <Users className="h-5 w-5 mr-2" /> },
        { label: "Alerts", href: "/alerts", icon: <AlertTriangle className="h-5 w-5 mr-2" /> }
      ]
    }
  ];

  return (
    <div className="w-56 bg-sidebar flex-shrink-0 border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <svg className="h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
        <span className="ml-2 text-primary font-semibold text-lg">MikroMonitor</span>
      </div>

      {/* Navigation */}
      <div className="py-4 flex-1 overflow-auto">
        {navItems.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? "mt-6" : ""}>
            <div className="px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
              {section.section}
            </div>
            {section.items.map((item, itemIndex) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={itemIndex} 
                  href={item.href}
                >
                  <a 
                    className={`block px-4 py-2 ${
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <div className="flex items-center">
                      {item.icon}
                      {item.label}
                    </div>
                  </a>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="w-56 bg-sidebar border-t border-sidebar-border p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            N
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-sidebar-foreground">Network Admin</p>
            <button className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground flex items-center">
              <LogOut className="h-3 w-3 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
