import { Link } from 'react-router-dom';

import { useTheme } from '../context/themeContext.js';

const LIGHT_ICON = '/brand/nutrilens-focus-leaf-icon-light.svg';
const DARK_ICON = '/brand/nutrilens-focus-leaf-icon-dark.svg';

export function BrandMark({ compact = false, tone = 'auto' }) {
  const { isDark } = useTheme();
  const useDarkBackgroundLogo = tone === 'dark' || (tone === 'auto' && isDark);

  return (
    <Link className="brand" to="/" aria-label="NutriLens home">
      <img
        className="brand-symbol"
        src={useDarkBackgroundLogo ? DARK_ICON : LIGHT_ICON}
        width="48"
        height="48"
        alt=""
        aria-hidden="true"
      />
      {!compact && <span className="brand-word">NutriLens</span>}
    </Link>
  );
}
