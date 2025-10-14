import React, { useState, useEffect, useRef } from 'react';
import Konva from 'konva';

export default function ImageFrameClipper() {
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [frames, setFrames] = useState([]);
  const [statusText, setStatusText] = useState('No frame selected');
  const [statusType, setStatusType] = useState('none');
  const [showImageControls, setShowImageControls] = useState(false);
  const [scaleValue, setScaleValue] = useState(1);
  const [rotateValue, setRotateValue] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [isClipped, setIsClipped] = useState(false);
  
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const transformerRef = useRef(null);

  useEffect(() => {
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: 1000,
      height: 600
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const transformer = new Konva.Transformer({
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: true,
      keepRatio: false,
      ignoreStroke: true,
      boundBoxFunc: (oldBox, newBox) => {
        return newBox;
      }
    });
    
    layer.add(transformer);
    transformerRef.current = transformer;

    stageRef.current = stage;
    layerRef.current = layer;

    // Create initial frames
    createFrame(100, 100, 250, 200);
    createFrame(400, 150, 300, 250);
    createFrame(750, 80, 200, 300);

    // Click on empty area to deselect
    stage.on('click', (e) => {
      if (e.target === stage) {
        transformer.nodes([]);
        layer.draw();
      }
    });

    return () => {
      stage.destroy();
    };
  }, []);

  const createFrame = (x, y, width, height) => {
    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: false
    });

    const rect = new Konva.Rect({
      width: width,
      height: height,
      stroke: '#667eea',
      strokeWidth: 3,
      dash: [10, 5],
      fill: 'rgba(102, 126, 234, 0.1)',
      listening: true
    });

    const clipGroup = new Konva.Group({
      listening: true
    });

    group.add(rect);
    group.add(clipGroup);
    
    group.frameData = {
      rect: rect,
      clipGroup: clipGroup,
      width: width,
      height: height,
      image: null,
      imageNode: null,
      originalImageData: null,
      isClipped: false,
      transparentOverlay: null
    };

    // Click on frame border to select frame - only if no image
    rect.on('click tap', function(e) {
      if (!group.frameData.imageNode) {
        e.cancelBubble = true;
        selectFrame(group);
      }
    });

    // Make frame border draggable only when no image
    rect.on('dragstart', function(e) {
      e.cancelBubble = true;
      if (!group.frameData.imageNode) {
        group.draggable(true);
      }
    });

    group.on('dragmove', function() {
      layerRef.current.batchDraw();
    });

    setFrames(prev => [...prev, group]);
    layerRef.current.add(group);
    layerRef.current.draw();

    return group;
  };

  const selectFrame = (frame) => {
    if (selectedFrame) {
      selectedFrame.frameData.rect.stroke('#667eea');
      selectedFrame.frameData.rect.strokeWidth(3);
    }

    setSelectedFrame(frame);
    frame.frameData.rect.stroke('#f59e0b');
    frame.frameData.rect.strokeWidth(5);
    
    setStatusText(`Frame selected at (${Math.round(frame.x())}, ${Math.round(frame.y())})`);
    setStatusType('selected');
    
    if (frame.frameData.imageNode) {
      frame.draggable(false);
      setShowImageControls(true);
      setIsClipped(frame.frameData.isClipped);
      setStatusText('✅ Image ready! Click image center and drag to move');
      setStatusType('editing');
      transformerRef.current.nodes([frame.frameData.imageNode]);
    } else {
      frame.draggable(true);
      setShowImageControls(false);
      transformerRef.current.nodes([]);
    }
    
    layerRef.current.draw();
  };

  const addTransparentOverlay = (frame) => {
    const frameData = frame.frameData;
    
    // Remove existing overlay if any
    if (frameData.transparentOverlay) {
      frameData.transparentOverlay.destroy();
    }

    if (!frameData.imageNode) return;

    // Set the main image to lower opacity
    frameData.imageNode.opacity(0.3);
    
    // Create a full opacity version of the image clipped to frame bounds
    const clippedImage = new Konva.Image({
      image: frameData.image,
      x: frameData.imageNode.x(),
      y: frameData.imageNode.y(),
      width: frameData.imageNode.width(),
      height: frameData.imageNode.height(),
      scaleX: frameData.imageNode.scaleX(),
      scaleY: frameData.imageNode.scaleY(),
      rotation: frameData.imageNode.rotation(),
      offset: frameData.imageNode.offset(),
      opacity: 1,
      listening: false
    });

    // Create a group with clipping for the full opacity image
    const clippedGroup = new Konva.Group({
      clipFunc: function(ctx) {
        ctx.rect(0, 0, frameData.width, frameData.height);
      },
      listening: false
    });

    clippedGroup.add(clippedImage);
    frameData.clipGroup.add(clippedGroup);
    clippedGroup.moveToTop();
    frameData.imageNode.moveToBottom();
    
    frameData.transparentOverlay = { clippedGroup, clippedImage };
    
    // Update the clipped image when main image transforms
    const updateOverlay = () => {
      if (frameData.transparentOverlay && clippedImage) {
        clippedImage.position(frameData.imageNode.position());
        clippedImage.scale(frameData.imageNode.scale());
        clippedImage.rotation(frameData.imageNode.rotation());
        clippedImage.offset(frameData.imageNode.offset());
        layerRef.current.batchDraw();
      }
    };

    frameData.imageNode.on('transform.overlay', updateOverlay);
    frameData.imageNode.on('dragmove.overlay', updateOverlay);
    
    layerRef.current.draw();
  };

  const removeTransparentOverlay = (frame) => {
    const frameData = frame.frameData;
    
    if (frameData.imageNode) {
      frameData.imageNode.opacity(1);
      frameData.imageNode.off('transform.overlay');
      frameData.imageNode.off('dragmove.overlay');
    }
    
    if (frameData.transparentOverlay) {
      if (frameData.transparentOverlay.clippedGroup) {
        frameData.transparentOverlay.clippedGroup.destroy();
      }
      frameData.transparentOverlay = null;
    }
    
    layerRef.current.draw();
  };

  const loadImageToFrame = (imageObj) => {
    if (!selectedFrame) return;

    const frameData = selectedFrame.frameData;
    
    if (frameData.imageNode) {
      frameData.imageNode.destroy();
    }

    // Remove any existing overlay first
    removeTransparentOverlay(selectedFrame);

    // Calculate scale to fit the image to frame
    const scaleX = frameData.width / imageObj.width;
    const scaleY = frameData.height / imageObj.height;
    const scale = Math.min(scaleX, scaleY);

    const konvaImage = new Konva.Image({
      image: imageObj,
      draggable: true,
      width: imageObj.width,
      height: imageObj.height,
      scaleX: scale,
      scaleY: scale,
      x: (frameData.width - imageObj.width * scale) / 2,
      y: (frameData.height - imageObj.height * scale) / 2,
      name: 'movableImage',
      listening: true,
      opacity: 1
    });

    konvaImage.moveToTop();

    frameData.originalImageData = {
      width: imageObj.width,
      height: imageObj.height,
      scale: scale,
      x: (frameData.width - imageObj.width * scale) / 2,
      y: (frameData.height - imageObj.height * scale) / 2
    };

    // Click on image to select it
    konvaImage.on('click tap', function(e) {
      e.cancelBubble = true;
      transformerRef.current.nodes([konvaImage]);
      setStatusText('✋ Image selected - Drag to move, drag corners to resize');
      layerRef.current.draw();
    });

    konvaImage.on('transform', function() {
      const scaleX = konvaImage.scaleX();
      setScaleValue(Math.abs(scaleX));
      setRotateValue(konvaImage.rotation());
    });

    konvaImage.on('dragstart', function(e) {
      e.cancelBubble = true;
      setStatusText('🎯 Dragging image...');
    });

    konvaImage.on('dragmove', function(e) {
      e.cancelBubble = true;
      layerRef.current.batchDraw();
    });

    konvaImage.on('dragend', function(e) {
      e.cancelBubble = true;
      setStatusText('✅ Image moved! Drag again to reposition');
      layerRef.current.draw();
    });

    frameData.clipGroup.add(konvaImage);
    frameData.imageNode = konvaImage;
    frameData.image = imageObj;
    
    frameData.clipGroup.moveToTop();
    selectedFrame.draggable(false);
    
    setScaleValue(scale);
    setRotateValue(0);
    setFlipH(false);
    setFlipV(false);
    setIsClipped(false);
    frameData.isClipped = false;
    setShowImageControls(true);
    setStatusText('✅ Image loaded and fitted to frame!');
    setStatusType('editing');
    
    transformerRef.current.nodes([konvaImage]);
    transformerRef.current.moveToTop();
    
    // Add transparent overlay after image is loaded
    setTimeout(() => {
      addTransparentOverlay(selectedFrame);
    }, 50);
    
    layerRef.current.draw();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && selectedFrame) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          loadImageToFrame(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleScaleChange = (e) => {
    const scale = parseFloat(e.target.value);
    setScaleValue(scale);
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      const currentScaleX = img.scaleX();
      const direction = currentScaleX < 0 ? -1 : 1;
      img.scaleX(scale * direction);
      img.scaleY(scale);
      layerRef.current.draw();
    }
  };

  const handleRotateChange = (e) => {
    const rotation = parseFloat(e.target.value);
    setRotateValue(rotation);
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      selectedFrame.frameData.imageNode.rotation(rotation);
      layerRef.current.draw();
    }
  };

  const handleFlipHorizontal = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      const newFlipH = !flipH;
      setFlipH(newFlipH);
      img.scaleX(scaleValue * (newFlipH ? -1 : 1));
      layerRef.current.draw();
    }
  };

  const handleFlipVertical = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      const newFlipV = !flipV;
      setFlipV(newFlipV);
      img.scaleY(scaleValue * (newFlipV ? -1 : 1));
      layerRef.current.draw();
    }
  };

  const handleFitImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const scaleX = frameData.width / frameData.originalImageData.width;
      const scaleY = frameData.height / frameData.originalImageData.height;
      const scale = Math.min(scaleX, scaleY);
      
      const img = frameData.imageNode;
      const direction = img.scaleX() < 0 ? -1 : 1;
      
      img.scale({ x: scale * direction, y: scale });
      img.position({
        x: (frameData.width - frameData.originalImageData.width * scale) / 2,
        y: (frameData.height - frameData.originalImageData.height * scale) / 2
      });
      img.rotation(0);
      img.offset({ x: 0, y: 0 });
      
      setScaleValue(scale);
      setRotateValue(0);
      setStatusText('✅ Image fitted to frame!');
      layerRef.current.draw();
    }
  };

  const handleFillImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const scaleX = frameData.width / frameData.originalImageData.width;
      const scaleY = frameData.height / frameData.originalImageData.height;
      const scale = Math.max(scaleX, scaleY);
      
      const img = frameData.imageNode;
      const direction = img.scaleX() < 0 ? -1 : 1;
      
      img.scale({ x: scale * direction, y: scale });
      img.position({
        x: (frameData.width - frameData.originalImageData.width * scale) / 2,
        y: (frameData.height - frameData.originalImageData.height * scale) / 2
      });
      img.rotation(0);
      img.offset({ x: 0, y: 0 });
      
      setScaleValue(scale);
      setRotateValue(0);
      setStatusText('✅ Image filled frame!');
      layerRef.current.draw();
    }
  };

  const handleResetImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const original = frameData.originalImageData;
      
      frameData.imageNode.scale({ x: original.scale, y: original.scale });
      frameData.imageNode.position({ x: original.x, y: original.y });
      frameData.imageNode.rotation(0);
      frameData.imageNode.offset({ x: 0, y: 0 });
      
      setScaleValue(original.scale);
      setRotateValue(0);
      setFlipH(false);
      setFlipV(false);
      layerRef.current.draw();
    }
  };

  const handleAlignLeft = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      const currentY = img.y();
      img.position({ x: 0, y: currentY });
      layerRef.current.draw();
    }
  };

  const handleAlignCenter = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const img = frameData.imageNode;
      const imgWidth = img.width() * Math.abs(img.scaleX());
      const currentY = img.y();
      img.position({ 
        x: (frameData.width - imgWidth) / 2,
        y: currentY 
      });
      layerRef.current.draw();
    }
  };

  const handleAlignRight = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const img = frameData.imageNode;
      const imgWidth = img.width() * Math.abs(img.scaleX());
      const currentY = img.y();
      img.position({ 
        x: frameData.width - imgWidth,
        y: currentY 
      });
      layerRef.current.draw();
    }
  };

  const handleAlignTop = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      const currentX = img.x();
      img.position({ x: currentX, y: 0 });
      layerRef.current.draw();
    }
  };

  const handleAlignMiddle = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const img = frameData.imageNode;
      const imgHeight = img.height() * Math.abs(img.scaleY());
      const currentX = img.x();
      img.position({ 
        x: currentX,
        y: (frameData.height - imgHeight) / 2
      });
      layerRef.current.draw();
    }
  };

  const handleAlignBottom = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const img = frameData.imageNode;
      const imgHeight = img.height() * Math.abs(img.scaleY());
      const currentX = img.x();
      img.position({ 
        x: currentX,
        y: frameData.height - imgHeight
      });
      layerRef.current.draw();
    }
  };

  const moveImage = (dx, dy) => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      img.position({
        x: img.x() + dx,
        y: img.y() + dy
      });
      
      // Update the overlay manually
      const frameData = selectedFrame.frameData;
      if (frameData.transparentOverlay && frameData.transparentOverlay.clippedImage) {
        frameData.transparentOverlay.clippedImage.position(img.position());
      }
      
      layerRef.current.draw();
    }
  };

  const handleMoveUp = () => moveImage(0, -10);
  const handleMoveDown = () => moveImage(0, 10);
  const handleMoveLeft = () => moveImage(-10, 0);
  const handleMoveRight = () => moveImage(10, 0);

  const handleClipImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const newClipState = !frameData.isClipped;
      
      if (newClipState) {
        // Apply clipping
        frameData.clipGroup.clipFunc(function(ctx) {
          ctx.rect(0, 0, frameData.width, frameData.height);
        });
        // Remove transparent overlay when clipping
        removeTransparentOverlay(selectedFrame);
        setStatusText('✂️ Image clipped to frame bounds!');
      } else {
        // Remove clipping
        frameData.clipGroup.clipFunc(null);
        // Add transparent overlay back when unclipping (back to adjustment mode)
        addTransparentOverlay(selectedFrame);
        setStatusText('🖼️ Image unclipped - full image visible!');
      }
      
      frameData.isClipped = newClipState;
      setIsClipped(newClipState);
      layerRef.current.draw();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedFrame || !selectedFrame.frameData.imageNode) return;
      
      switch(e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveImage(0, -10);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveImage(0, 10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveImage(-10, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveImage(10, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFrame]);

  const handleAddFrame = () => {
    const x = 50 + Math.random() * (stageRef.current.width() - 300);
    const y = 50 + Math.random() * (stageRef.current.height() - 300);
    const width = 200 + Math.random() * 100;
    const height = 150 + Math.random() * 100;
    createFrame(x, y, width, height);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all frames?')) {
      frames.forEach(frame => frame.destroy());
      setFrames([]);
      setSelectedFrame(null);
      setStatusText('No frame selected');
      setStatusType('none');
      setShowImageControls(false);
      transformerRef.current.nodes([]);
      layerRef.current.draw();
    }
  };

  const statusColors = {
    none: 'bg-red-100 text-red-800',
    selected: 'bg-blue-100 text-blue-800',
    editing: 'bg-amber-100 text-amber-800'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-6xl w-full">
        <h1 className="text-4xl font-bold text-purple-600 text-center mb-2">
          🖼️ Image Frame Clipper
        </h1>
        <p className="text-center text-gray-600 mb-5 text-sm leading-relaxed">
          1️⃣ Click frame → 2️⃣ Upload image → 3️⃣ Adjust image (full visible) → 4️⃣ Click <strong>"✂️ Clip to Frame"</strong> when done<br/>
          <span className="text-red-600">Images show in full while adjusting - clip them when ready!</span>
        </p>

        <div className={`text-center py-2 px-4 rounded-lg mb-4 font-medium ${statusColors[statusType]}`}>
          {statusText}
        </div>

        <div className="flex gap-4 mb-5 flex-wrap justify-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedFrame}
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📁 Upload Image
          </button>
          <button
            onClick={handleAddFrame}
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            ➕ Add Frame
          </button>
          <button
            onClick={handleClearAll}
            className="bg-gradient-to-r from-purple-500 to-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            🗑️ Clear All
          </button>
        </div>

        {showImageControls && (
          <div className="space-y-3 mb-4">
            <div className="flex gap-3 justify-center p-4 bg-amber-100 rounded-xl flex-wrap">
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-semibold text-amber-900">Scale: {scaleValue.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={scaleValue}
                  onChange={handleScaleChange}
                  className="w-36"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-semibold text-amber-900">Rotate: {Math.round(rotateValue)}°</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={rotateValue}
                  onChange={handleRotateChange}
                  className="w-36"
                />
              </div>
              <button
                onClick={handleFitImage}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                📐 Fit to Frame
              </button>
              <button
                onClick={handleFillImage}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                🖼️ Fill Frame
              </button>
              <button
                onClick={handleResetImage}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
              >
                🔄 Reset
              </button>
              
              
              <button
                onClick={handleClipImage}
                className={`px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all ${isClipped ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'}`}
              >
                {isClipped ? '🔓 Unclip' : '✂️ Clip to Frame'}
              </button>
            </div>
            
            <div className="flex gap-3 justify-center p-4 bg-blue-100 rounded-xl flex-wrap">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-blue-900">Move Image</span>
                <div className="grid grid-cols-3 gap-1">
                  <div></div>
                  <button
                    onClick={handleMoveUp}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬆️
                  </button>
                  <div></div>
                  <button
                    onClick={handleMoveLeft}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬅️
                  </button>
                  <div className="flex items-center justify-center text-xs text-purple-900 font-medium">
                    10px
                  </div>
                  <button
                    onClick={handleMoveRight}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ➡️
                  </button>
                  <div></div>
                  <button
                    onClick={handleMoveDown}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬇️
                  </button>
                  <div></div>
                </div>
                <span className="text-xs text-purple-700 mt-1">Use arrow keys ⌨️</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-blue-900">Horizontal Align</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleAlignLeft}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬅️ Left
                  </button>
                  <button
                    onClick={handleAlignCenter}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ↔️ Center
                  </button>
                  <button
                    onClick={handleAlignRight}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ➡️ Right
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-blue-900">Vertical Align</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleAlignTop}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬆️ Top
                  </button>
                  <button
                    onClick={handleAlignMiddle}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ↕️ Middle
                  </button>
                  <button
                    onClick={handleAlignBottom}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    ⬇️ Bottom
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div
          ref={containerRef}
          className="border-4 border-gray-300 rounded-xl overflow-hidden shadow-lg bg-gray-50"
        />
      </div>
    </div>
  );
}