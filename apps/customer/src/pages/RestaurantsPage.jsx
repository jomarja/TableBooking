import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiChevronDown, FiChevronUp, FiX, FiMoreHorizontal } from 'react-icons/fi';
import SearchBar from '../components/SearchBar';
import RestaurantCard from '../components/RestaurantCard';
import CategoryIcon from '../components/CategoryIcon';
import { categories } from '../data/restaurants';
import { useRestaurantsContext } from '../context/RestaurantsContext';

const VISIBLE_CATEGORIES = 10;

export default function RestaurantsPage() {
  const { restaurants, loading, error } = useRestaurantsContext();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    cuisineType: [],
    priceRange: [],
    openNow: false,
    minRating: 0,
    maxDistance: null,
    reservationToday: false,
    outdoorSeating: false,
    familyFriendly: false,
  });

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // Sticky search bar logic
  const [showStickySearch, setShowStickySearch] = useState(false);
  const lastScrollY = useRef(0);
  const topRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const threshold = topRef.current
        ? topRef.current.offsetTop + topRef.current.offsetHeight
        : 200;

      if (currentScrollY <= threshold) {
        setShowStickySearch(false);
      } else if (currentScrollY < lastScrollY.current) {
        setShowStickySearch(true);
      } else {
        setShowStickySearch(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isOpenNow = (restaurant) => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const { openingTime, closingTime } = restaurant;
    if (closingTime < openingTime) {
      return currentTime >= openingTime || currentTime <= closingTime;
    }
    return currentTime >= openingTime && currentTime <= closingTime;
  };

  const hasReservationToday = (restaurant) => {
    const today = new Date().toISOString().split('T')[0];
    const todayReservations = restaurant.reservations.filter((r) => r.date === today);
    return todayReservations.length < restaurant.tables.length;
  };

  const filteredRestaurants = restaurants
    .filter((restaurant) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = restaurant.name.toLowerCase().includes(query);
        const matchesCuisine = restaurant.cuisine.toLowerCase().includes(query);
        const matchesAddress = restaurant.address.toLowerCase().includes(query);
        if (!matchesName && !matchesCuisine && !matchesAddress) return false;
      }
      if (filters.cuisineType.length > 0 && !filters.cuisineType.includes(restaurant.cuisine)) return false;
      if (filters.priceRange.length > 0 && !filters.priceRange.includes(restaurant.priceLevel)) return false;
      if (filters.openNow && !isOpenNow(restaurant)) return false;
      if (filters.minRating > 0 && restaurant.rating < filters.minRating) return false;
      if (filters.maxDistance && restaurant.distance > filters.maxDistance) return false;
      if (filters.reservationToday && !hasReservationToday(restaurant)) return false;
      if (filters.outdoorSeating && !restaurant.outdoorSeating) return false;
      if (filters.familyFriendly && !restaurant.familyFriendly) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular': return (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.rating - a.rating;
        case 'rating': return b.rating - a.rating;
        case 'priceLow': return a.priceLevel - b.priceLevel;
        case 'priceHigh': return b.priceLevel - a.priceLevel;
        case 'distance': return a.distance - b.distance;
        default: return 0;
      }
    });

  const toggleCuisineFilter = (cuisineId) => {
    setFilters((prev) => ({
      ...prev,
      cuisineType: prev.cuisineType.includes(cuisineId)
        ? prev.cuisineType.filter((c) => c !== cuisineId)
        : [...prev.cuisineType, cuisineId],
    }));
  };

  const togglePriceFilter = (level) => {
    setFilters((prev) => ({
      ...prev,
      priceRange: prev.priceRange.includes(level)
        ? prev.priceRange.filter((p) => p !== level)
        : [...prev.priceRange, level],
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      cuisineType: [],
      priceRange: [],
      openNow: false,
      minRating: 0,
      maxDistance: null,
      reservationToday: false,
      outdoorSeating: false,
      familyFriendly: false,
    });
    setSearchQuery('');
  };

  const activeFilterCount =
    filters.cuisineType.length +
    filters.priceRange.length +
    (filters.openNow ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxDistance ? 1 : 0) +
    (filters.reservationToday ? 1 : 0) +
    (filters.outdoorSeating ? 1 : 0) +
    (filters.familyFriendly ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Search Bar */}
      <AnimatePresence>
        {showStickySearch && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100 py-3 px-4"
          >
            <div className="max-w-7xl mx-auto">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header with Search */}
        <div ref={topRef} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Restaurants</h1>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Category Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Browse by Category</h2>
          <div className="flex flex-wrap gap-3 py-2">
            {(showAllCategories ? categories : categories.slice(0, VISIBLE_CATEGORIES)).map((category) => (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleCuisineFilter(category.id)}
                className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all duration-200 ${
                  filters.cuisineType.includes(category.id)
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <span className="mb-1"><CategoryIcon icon={category.icon} size={32} /></span>
                <span className={`text-xs font-medium ${filters.cuisineType.includes(category.id) ? 'text-indigo-700' : 'text-gray-600'}`}>
                  {category.name}
                </span>
              </motion.button>
            ))}

            {!showAllCategories && categories.length > VISIBLE_CATEGORIES && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAllCategories(true)}
                className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200"
              >
                <FiMoreHorizontal className="text-2xl text-gray-500 mb-1" />
                <span className="text-xs font-medium text-gray-600">More...</span>
              </motion.button>
            )}

            {showAllCategories && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAllCategories(false)}
                className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200"
              >
                <FiChevronUp className="text-2xl text-gray-500 mb-1" />
                <span className="text-xs font-medium text-gray-600">Less</span>
              </motion.button>
            )}
          </div>
        </section>

        {/* Sort and Filter Section */}
        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select-restaurants" className="text-sm font-medium text-gray-600">Sort by:</label>
              <select
                id="sort-select-restaurants"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="priceLow">Lowest Price</option>
                <option value="priceHigh">Highest Price</option>
                <option value="distance">Closest Distance</option>
              </select>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
              }`}
            >
              <FiFilter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                <FiX className="w-4 h-4" />
                Clear all
              </button>
            )}

            <span className="ml-auto text-sm text-gray-500">
              {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {/* Collapsible Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Cuisine Type */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Cuisine Type</h3>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => toggleCuisineFilter(cat.id)}
                            className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all ${
                              filters.cuisineType.includes(cat.id)
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                            }`}
                          >
                            <CategoryIcon icon={cat.icon} size={14} /> {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Price Range</h3>
                      <div className="flex flex-wrap gap-2">
                        {[{ level: 1, label: '$' }, { level: 2, label: '$$' }, { level: 3, label: '$$$' }, { level: 4, label: '$$$$' }].map(({ level, label }) => (
                          <button
                            key={level}
                            onClick={() => togglePriceFilter(level)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              filters.priceRange.includes(level)
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rating */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Minimum Rating</h3>
                      <div className="flex flex-wrap gap-2">
                        {[4.0, 4.5, 4.7, 4.9].map((rating) => (
                          <button
                            key={rating}
                            onClick={() => setFilters((prev) => ({ ...prev, minRating: prev.minRating === rating ? 0 : rating }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              filters.minRating === rating
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {rating}+
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Distance */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Max Distance</h3>
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 5, 10].map((km) => (
                          <button
                            key={km}
                            onClick={() => setFilters((prev) => ({ ...prev, maxDistance: prev.maxDistance === km ? null : km }))}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              filters.maxDistance === km
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {km} km
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Filters */}
                  <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={filters.openNow} onChange={(e) => setFilters((prev) => ({ ...prev, openNow: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Open Now</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={filters.reservationToday} onChange={(e) => setFilters((prev) => ({ ...prev, reservationToday: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Reservation Available Today</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={filters.outdoorSeating} onChange={(e) => setFilters((prev) => ({ ...prev, outdoorSeating: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Outdoor Seating</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={filters.familyFriendly} onChange={(e) => setFilters((prev) => ({ ...prev, familyFriendly: e.target.checked }))} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">Family Friendly</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Restaurant Grid */}
        <section>
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 animate-pulse">
                  <div className="aspect-[16/10] bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-9 bg-gray-100 rounded w-full mt-4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">⚠️</p>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Couldn't load restaurants</h3>
              <p className="text-gray-500 mb-1">{error}</p>
              <p className="text-gray-400 text-sm">Make sure the API server is running on port 4000.</p>
            </div>
          )}

          {!loading && !error && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredRestaurants.map((restaurant) => (
                <motion.div
                  key={restaurant.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <RestaurantCard restaurant={restaurant} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredRestaurants.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <p className="text-5xl mb-4">🍽️</p>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No restaurants found</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search or filters.</p>
              <button
                onClick={clearAllFilters}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Clear all filters
              </button>
            </motion.div>
          )}
          </>
          )}
        </section>
      </div>
    </div>
  );
}
