import React, { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import { Upload, Crop, RotateCw, Download, X, Check, RefreshCw } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';

const ImageEditor = ({ onImageSave, onClose, initialImageUrl = null }) => {
  const [imageSrc, setImageSrc] = useState(initialImageUrl);
  const [crop, setCrop] = useState({
    unit: '%',
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [aspect, setAspect] = useState(1); // 1:1 square by default
  const [isProcessing, setIsProcessing] = useState(false);
  
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
        setRotation(0);
        setScale(1);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  }, []);

  // Handle crop completion
  const onCropComplete = useCallback((crop) => {
    setCompletedCrop(crop);
  }, []);

  // Generate cropped image
  const generateCroppedImage = useCallback(async (
    image,
    crop,
    scale = 1,
    rotate = 0,
    outputWidth = 400,
    outputHeight = 400
  ) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || !crop.width || !crop.height) {
      throw new Error('Crop canvas does not exist');
    }

    // Set canvas size to desired output size
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = outputWidth * pixelRatio;
    canvas.height = outputHeight * pixelRatio;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    const centerX = outputWidth / 2;
    const centerY = outputHeight / 2;

    ctx.save();

    // Move to center
    ctx.translate(centerX, centerY);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    // Draw the cropped image
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

    ctx.restore();
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return;
    }

    setIsProcessing(true);

    try {
      await generateCroppedImage(
        imgRef.current,
        completedCrop,
        scale,
        rotation,
        400, // Output width
        400  // Output height
      );

      // Convert canvas to blob
      canvasRef.current.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          return;
        }

        // Convert blob to data URL
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          onImageSave(dataUrl);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.9);

    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, scale, rotation, generateCroppedImage, onImageSave]);

  // Preset aspect ratios
  const aspectRatios = [
    { label: 'Square (1:1)', value: 1 },
    { label: 'Landscape (4:3)', value: 4/3 },
    { label: 'Portrait (3:4)', value: 3/4 },
    { label: 'Wide (16:9)', value: 16/9 },
    { label: 'Free', value: undefined },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: '800px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>Image Editor</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              color: '#666'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Controls */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center'
        }}>
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: '1px solid #007bff',
              borderRadius: '6px',
              background: 'white',
              color: '#007bff',
              cursor: 'pointer'
            }}
          >
            <Upload size={16} />
            Upload Image
          </button>

          {/* Aspect Ratio */}
          <select
            value={aspect || 'free'}
            onChange={(e) => setAspect(e.target.value === 'free' ? undefined : parseFloat(e.target.value))}
            style={{
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '6px'
            }}
          >
            {aspectRatios.map(ratio => (
              <option key={ratio.label} value={ratio.value || 'free'}>
                {ratio.label}
              </option>
            ))}
          </select>

          {/* Scale */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: '#666' }}>Scale:</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
            <span style={{ fontSize: '14px', color: '#666', minWidth: '40px' }}>
              {scale.toFixed(1)}x
            </span>
          </div>

          {/* Rotation */}
          <button
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: '1px solid #6c757d',
              borderRadius: '6px',
              background: 'white',
              color: '#6c757d',
              cursor: 'pointer'
            }}
          >
            <RotateCw size={16} />
            Rotate
          </button>
        </div>

        {/* Image Crop Area */}
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          maxHeight: '500px',
          overflow: 'hidden'
        }}>
          {imageSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => onCropComplete(c)}
              aspect={aspect}
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imageSrc}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center'
                }}
                onLoad={() => {
                  // Reset crop when new image loads
                  setCrop({
                    unit: '%',
                    width: 80,
                    height: 80,
                    x: 10,
                    y: 10,
                  });
                }}
              />
            </ReactCrop>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              color: '#666',
              textAlign: 'center'
            }}>
              <Crop size={48} />
              <p>Upload an image to start cropping</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '12px 24px',
                  border: '2px dashed #007bff',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#007bff',
                  cursor: 'pointer'
                }}
              >
                Choose Image
              </button>
            </div>
          )}
        </div>

        {/* Preview Canvas (hidden) */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Output size: 400x400 pixels
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #6c757d',
                borderRadius: '6px',
                background: 'white',
                color: '#6c757d',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!completedCrop || isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: completedCrop && !isProcessing ? '#28a745' : '#ccc',
                color: 'white',
                cursor: completedCrop && !isProcessing ? 'pointer' : 'not-allowed'
              }}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Save Image
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CSS for spinning animation */}
      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ImageEditor;
