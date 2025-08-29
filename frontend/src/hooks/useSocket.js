import { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const useSocket = (onOrderCreated, onOrderStatusUpdated, onItemPreparationUpdated, onProductCreated, onProductUpdated, onProductDeleted) => {
  const socketRef = useRef(null);

  useEffect(() => {
    // Determine the correct socket URL based on current host
    const getSocketUrl = () => {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:5000';
      } else {
        // Use the same host as the frontend for network access
        return `http://${host}:5000`;
      }
    };

    // Connect to the socket server
    socketRef.current = io(getSocketUrl());

    const socket = socketRef.current;

    // Set up event listeners
    if (onOrderCreated) {
      socket.on('orderCreated', onOrderCreated);
    }

    if (onOrderStatusUpdated) {
      socket.on('orderStatusUpdated', onOrderStatusUpdated);
    }

    if (onItemPreparationUpdated) {
      socket.on('itemPreparationUpdated', onItemPreparationUpdated);
    }

    if (onProductCreated) {
      socket.on('productCreated', onProductCreated);
    }

    if (onProductUpdated) {
      socket.on('productUpdated', onProductUpdated);
    }

    if (onProductDeleted) {
      socket.on('productDeleted', onProductDeleted);
    }

    // Connection events for debugging
    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [onOrderCreated, onOrderStatusUpdated, onItemPreparationUpdated]);

  return socketRef.current;
};

export default useSocket;
