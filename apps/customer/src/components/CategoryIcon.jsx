import GeorgianFlag from './GeorgianFlag';
import khachapuriImg from '../assets/khachapuri.png';

export default function CategoryIcon({ icon, size = 32 }) {
  if (icon === 'ge-flag') {
    return <GeorgianFlag size={size} />;
  }
  if (icon === 'khachapuri') {
    const imgSize = Math.round(size * 1.4);
    return <img src={khachapuriImg} alt="Khachapuri" width={imgSize} height={imgSize} style={{ objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: size * 0.85 }}>{icon}</span>;
}
