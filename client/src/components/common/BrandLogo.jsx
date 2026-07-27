import React from 'react';

/**
 * Shared restaurant logo for headers, sidebars, and welcome screens.
 * @param {'light'|'dark'} variant - light = orange on white (default), dark = orange on black
 */
export default function BrandLogo({
  size = 40,
  variant = 'light',
  className = '',
  alt = 'Restaurant',
  style = {},
}) {
  const src = variant === 'dark' ? '/logo-dark.png' : '/logo.png';

  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo ${className}`.trim()}
      width={size}
      height={size}
      style={{ width: size, height: size, ...style }}
      decoding="async"
    />
  );
}
