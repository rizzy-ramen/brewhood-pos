import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        {/* Logo with pulse animation */}
        <div className="logo-container">
          <img 
            src="/images/brewhood-logo.png" 
            alt="Brewhood Logo" 
            className="brewhood-logo"
          />
          <div className="logo-glow"></div>
        </div>
        
        {/* Loading text removed */}
        
        {/* Loading dots removed */}
        
        {/* Spinning ring removed */}
        
        {/* Background particles */}
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
