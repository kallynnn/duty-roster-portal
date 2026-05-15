import React from 'react';

interface SkProps {
  w?: string | number;
  h?: string | number;
  r?: string | number;
  style?: React.CSSProperties;
}

export const Sk: React.FC<SkProps> = ({ w = '100%', h = '1rem', r = '6px', style }) => (
  <span className="sk-bone" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />
);
