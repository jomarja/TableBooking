import { Link } from "react-router-dom";
import { FiFacebook, FiTwitter, FiInstagram, FiLinkedin, FiYoutube } from "react-icons/fi";

const footerLinks = [
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
  { to: "/restaurants", label: "Restaurants" },
  { to: "/reservations", label: "My Reservations" },
];

const legalLinks = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/terms", label: "Terms of Service" },
];

const socialLinks = [
  { href: "https://www.facebook.com/tablebooker", icon: FiFacebook, label: "Facebook" },
  { href: "https://www.instagram.com/tablebooker", icon: FiInstagram, label: "Instagram" },
  { href: "https://www.twitter.com/tablebooker", icon: FiTwitter, label: "Twitter / X" },
  { href: "https://www.linkedin.com/company/tablebooker", icon: FiLinkedin, label: "LinkedIn" },
  { href: "https://www.youtube.com/@tablebooker", icon: FiYoutube, label: "YouTube" },
];

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link
              to="/"
              className="text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
              aria-label="TableBooker home"
            >
              TableBooker
            </Link>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Book your perfect table at the best restaurants near you. Smart reservations made simple.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Navigation</h3>
            <nav className="flex flex-col gap-2" aria-label="Footer navigation">
              {footerLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-gray-400 hover:text-white transition-colors py-1"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Legal</h3>
            <nav className="flex flex-col gap-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-gray-400 hover:text-white transition-colors py-1"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Follow Us</h3>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <social.icon size={20} />
                </a>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Stay connected for updates, new restaurant partners, and exclusive offers.
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 TableBooker. All rights reserved.</p>
          <p>Made with care in Tbilisi, Georgia</p>
        </div>
      </div>
    </footer>
  );
}
