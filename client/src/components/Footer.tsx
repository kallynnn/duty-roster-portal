import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-dark text-white text-center p-4 mt-auto">
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Duty Roster Portal. Курсовий проєкт.</p>
      </div>
    </footer>
  );
};