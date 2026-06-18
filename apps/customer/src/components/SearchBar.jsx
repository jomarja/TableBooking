import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiMapPin, FiStar, FiArrowRight } from "react-icons/fi";
import { useRestaurantsContext } from "../context/RestaurantsContext";

export default function SearchBar({ value, onChange }) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { restaurants } = useRestaurantsContext();

  const query = value?.toLowerCase() || "";
  const allResults = query.length > 0
    ? restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.cuisine.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query)
      )
    : [];

  const previewResults = allResults.slice(0, 2);
  const hasMore = allResults.length > 2;
  const showDropdown = isFocused && query.length > 0 && allResults.length > 0;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (restaurant) => {
    setIsFocused(false);
    onChange("");
    navigate(`/restaurant/${restaurant.id}`);
  };

  const handleShowAll = () => {
    setIsFocused(false);
    navigate(`/restaurants?q=${encodeURIComponent(value)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && query.length > 0) {
      setIsFocused(false);
      navigate(`/restaurants?q=${encodeURIComponent(value)}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label htmlFor="restaurant-search" className="sr-only">
        Search restaurants
      </label>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <FiSearch size={20} className="text-gray-400" />
      </div>
      <input
        id="restaurant-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search restaurants, cuisines or locations..."
        autoComplete="off"
        className="w-full min-h-[52px] pl-12 pr-4 py-3 text-base text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm placeholder:text-gray-400 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
        aria-label="Search restaurants, cuisines or locations"
        aria-expanded={showDropdown}
        role="combobox"
        aria-controls="search-results"
        aria-autocomplete="list"
      />

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            id="search-results"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50"
          >
            <ul role="listbox">
              {previewResults.map((restaurant) => (
                <li key={restaurant.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(restaurant)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left min-h-[56px]"
                    role="option"
                  >
                    <img
                      src={restaurant.image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {restaurant.name}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <FiMapPin size={10} />
                        {restaurant.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <FiStar size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-medium text-gray-600">{restaurant.rating}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {hasMore && (
              <button
                type="button"
                onClick={handleShowAll}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-100 text-emerald-600 hover:bg-emerald-50 transition-colors min-h-[48px] font-medium text-sm"
              >
                Show all {allResults.length} results
                <FiArrowRight size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
