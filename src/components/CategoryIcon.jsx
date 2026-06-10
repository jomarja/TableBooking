import GeorgianFlag from './GeorgianFlag';

export default function CategoryIcon({ icon, size = 32 }) {
  if (icon === 'ge-flag') {
    return <GeorgianFlag size={size} />;
  }
  return <span style={{ fontSize: size * 0.85 }}>{icon}</span>;
}
