import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, Search, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Movies", path: "/#movies" },
  { label: "Trending", path: "/#trending" },
  { label: "My List", path: "/profile" },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? "glass-dark" : "bg-transparent"}`}>
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-horror text-2xl md:text-3xl text-primary text-glow-red tracking-wider">
          PHANTOM VEIL
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm tracking-wider transition-colors hover:text-primary ${
                location.pathname === item.path ? "text-primary" : "text-foreground/70"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link to="/search" className="text-foreground/70 hover:text-primary transition-colors">
            <Search size={18} />
          </Link>
          {user ? (
            <Link to="/profile" className="text-foreground/70 hover:text-primary transition-colors">
              <User size={18} />
            </Link>
          ) : (
            <Link to="/login" className="text-sm tracking-wider text-foreground/70 hover:text-primary transition-colors">
              Login
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-dark px-6 pb-6 space-y-4">
          {navItems.map(item => (
            <Link key={item.path} to={item.path} className="block text-sm tracking-wider text-foreground/70 hover:text-primary" onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link to="/search" className="block text-sm tracking-wider text-foreground/70 hover:text-primary" onClick={() => setMobileOpen(false)}>Search</Link>
          {user ? (
            <Link to="/profile" className="block text-sm tracking-wider text-foreground/70 hover:text-primary" onClick={() => setMobileOpen(false)}>Profile</Link>
          ) : (
            <Link to="/login" className="block text-sm tracking-wider text-foreground/70 hover:text-primary" onClick={() => setMobileOpen(false)}>Login</Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
