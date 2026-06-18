// Category chips are static UI metadata. Restaurant records themselves now come
// from the shared backend via the API (see src/hooks/useRestaurants.js).
export const categories = [
  { id: 'georgian', name: 'Georgian', icon: 'khachapuri' },
  { id: 'asian', name: 'Asian', icon: '🥢' },
  { id: 'italian', name: 'Italian', icon: '🍝' },
  { id: 'desserts', name: 'Desserts', icon: '🍰' },
  { id: 'sushi', name: 'Sushi', icon: '🍣' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'burgers', name: 'Burgers', icon: '🍔' },
  { id: 'shawarma', name: 'Shawarma', icon: '🌯' },
  { id: 'seafood', name: 'Seafood', icon: '🦐' },
  { id: 'vegan', name: 'Vegan', icon: '🥗' },
  { id: 'steakhouse', name: 'Steakhouse', icon: '🥩' },
  { id: 'fastfood', name: 'Fast Food', icon: '🍟' },
  { id: 'mexican', name: 'Mexican', icon: '🌮' },
  { id: 'indian', name: 'Indian', icon: '🍛' },
];
