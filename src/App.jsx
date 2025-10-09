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
  
  const stageRef = useRef(null);
  const layerRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: 1000,
      height: 600
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    stageRef.current = stage;
    layerRef.current = layer;

    // Create initial frames
    createFrame(100, 100, 250, 200);
    createFrame(400, 150, 300, 250);
    createFrame(750, 80, 200, 300);

    return () => {
      stage.destroy();
    };
  }, []);

  const createFrame = (x, y, width, height) => {
    const group = new Konva.Group({
      x: x,
      y: y,
      draggable: true
    });

    const rect = new Konva.Rect({
      width: width,
      height: height,
      stroke: '#667eea',
      strokeWidth: 3,
      dash: [10, 5],
      fill: 'rgba(102, 126, 234, 0.1)'
    });

    const clipGroup = new Konva.Group({
      clipFunc: function(ctx) {
        ctx.rect(0, 0, width, height);
      }
    });

    group.add(clipGroup);
    group.add(rect);
    
    group.frameData = {
      rect: rect,
      clipGroup: clipGroup,
      width: width,
      height: height,
      image: null,
      imageNode: null,
      originalImageData: null
    };

    group.on('click tap', function(e) {
      e.cancelBubble = true;
      selectFrame(group);
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
      setShowImageControls(true);
      setStatusText('Image clipped to frame - Drag to reposition visible area');
      setStatusType('editing');
    } else {
      setShowImageControls(false);
    }
    
    layerRef.current.draw();
  };

  const loadImageToFrame = (imageObj) => {
    if (!selectedFrame) return;

    const frameData = selectedFrame.frameData;
    
    if (frameData.imageNode) {
      frameData.imageNode.destroy();
    }

    const konvaImage = new Konva.Image({
      image: imageObj,
      draggable: true,
      width: frameData.width,
      height: frameData.height,
      x: 0,
      y: 0
    });

    frameData.originalImageData = {
      width: imageObj.width,
      height: imageObj.height,
      scale: 1,
      x: 0,
      y: 0
    };

    konvaImage.on('wheel', function(e) {
      e.evt.preventDefault();
    });

    konvaImage.on('dragmove', function() {
      layerRef.current.draw();
    });

    frameData.clipGroup.add(konvaImage);
    frameData.imageNode = konvaImage;
    
    setScaleValue(1);
    setRotateValue(0);
    setShowImageControls(true);
    setStatusText('Image clipped to frame - Drag to reposition visible area');
    setStatusType('editing');
    
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
      selectedFrame.frameData.imageNode.scale({ x: scale, y: scale });
      layerRef.current.draw();
    }
  };

  const handleRotateChange = (e) => {
    const rotation = parseFloat(e.target.value);
    setRotateValue(rotation);
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const img = selectedFrame.frameData.imageNode;
      
      // Simply rotate without changing position
      img.rotation(rotation);
      
      layerRef.current.draw();
    }
  };

  const handleFitImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const scaleX = frameData.width / frameData.originalImageData.width;
      const scaleY = frameData.height / frameData.originalImageData.height;
      const scale = Math.min(scaleX, scaleY);
      
      frameData.imageNode.scale({ x: scale, y: scale });
      frameData.imageNode.position({
        x: (frameData.width - frameData.originalImageData.width * scale) / 2,
        y: (frameData.height - frameData.originalImageData.height * scale) / 2
      });
      frameData.imageNode.rotation(0);
      frameData.imageNode.offset({ x: 0, y: 0 });
      
      setScaleValue(scale);
      setRotateValue(0);
      layerRef.current.draw();
    }
  };

  const handleFillImage = () => {
    if (selectedFrame && selectedFrame.frameData.imageNode) {
      const frameData = selectedFrame.frameData;
      const scaleX = frameData.width / frameData.originalImageData.width;
      const scaleY = frameData.height / frameData.originalImageData.height;
      const scale = Math.max(scaleX, scaleY);
      
      frameData.imageNode.scale({ x: scale, y: scale });
      frameData.imageNode.position({
        x: (frameData.width - frameData.originalImageData.width * scale) / 2,
        y: (frameData.height - frameData.originalImageData.height * scale) / 2
      });
      frameData.imageNode.rotation(0);
      frameData.imageNode.offset({ x: 0, y: 0 });
      
      setScaleValue(scale);
      setRotateValue(0);
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
      layerRef.current.draw();
    }
  };

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
          Click on a frame to select it → Upload an image → Image will be clipped exactly to frame size<br/>
          Drag to reposition the visible portion of the image
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
          <div className="flex gap-3 justify-center mb-4 p-4 bg-amber-100 rounded-xl flex-wrap">
            <div className="flex flex-col items-center gap-1">
              <label className="text-xs font-semibold text-amber-900">Scale</label>
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
              <label className="text-xs font-semibold text-amber-900">Rotate</label>
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