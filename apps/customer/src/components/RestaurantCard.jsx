import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiStar, FiHeart, FiMapPin, FiClock } from "react-icons/fi";

export default function RestaurantCard({ restaurant, availability }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const {
    id,
    name,
    image,
    rating,
    address,
    openingTime,
    closingTime,
    cuisine,
    cuisines,
    priceRange,
  } = restaurant;

  // Show every cuisine the owner selected (multi-select), not just the first.
  const cuisineList = cuisines?.length ? cuisines : cuisine ? [cuisine] : [];

  return (
    <motion.article
      className="relative bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col"
      whileHover={{ y: -4, shadow: "0 20px 40px rgba(0,0,0,0.1)" }}
      transition={{ duration: 0.2 }}
    >
      {/* Image */}
      <Link
        to={`/restaurant/${id}`}
        className="block relative aspect-[16/10] overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
        aria-label={`View ${name}`}
      >
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
        />

        {/* Price range badge — the restaurant's average meal price range */}
        {priceRange && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
            {priceRange}
          </span>
        )}

        {/* Today's availability badge — instant "can I book here today?" signal */}
        {availability?.status && availability.status !== 'available' && (
          <span
            className={`absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm ${
              availability.status === 'fully_booked'
                ? 'bg-red-500 text-white'
                : availability.status === 'limited'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-500 text-white'
            }`}
          >
            {availability.status === 'fully_booked'
              ? 'Fully Booked Today'
              : availability.status === 'limited'
                ? `Limited${availability.freeTables ? ` · ${availability.freeTables} left` : ''}`
                : 'Closed Today'}
          </span>
        )}
      </Link>

      {/* Favorite button */}
      <button
        type="button"
        onClick={() => setIsFavorite(!isFavorite)}
        className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        aria-pressed={isFavorite}
      >
        <motion.span
          animate={isFavorite ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <FiHeart
            size={18}
            className={isFavorite ? "fill-red-500 text-red-500" : "text-gray-600"}
          />
        </motion.span>
      </button>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Name and rating */}
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/restaurant/${id}`}
            className="text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          >
            {name}
          </Link>
          <div className="flex items-center gap-1 shrink-0" aria-label={`Rating: ${rating} out of 5`}>
            <FiStar size={14} className="text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-gray-700">{rating}</span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
          <FiMapPin size={14} className="shrink-0" />
          <span className="truncate">{address}</span>
        </div>

        {/* Opening hours */}
        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
          <FiClock size={14} className="shrink-0" />
          <span>{openingTime} - {closingTime}</span>
        </div>

        {/* Cuisine badges — all selected cuisines */}
        {cuisineList.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cuisineList.slice(0, 3).map((c) => (
              <span
                key={c}
                className="inline-block bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full capitalize"
              >
                {c}
              </span>
            ))}
            {cuisineList.length > 3 && (
              <span className="inline-block text-gray-400 text-xs px-1 py-1">
                +{cuisineList.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Quick Reserve button */}
        <div className="mt-auto pt-4">
          <Link
            to={`/restaurant/${id}`}
            className="block w-full min-h-[44px] flex items-center justify-center bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Quick Reserve
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
