import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  PenTool,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  Download,
  X,
  Palette,
} from 'lucide-react';
import { WhiteboardElement } from '../types';
import { signaling } from '../services/signaling';

interface WhiteboardViewProps {
  onClose: () => void;
}

const COLORS = [
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#10b981',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const WhiteboardView: React.FC<WhiteboardViewProps> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [history, setHistory] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  const [activeTool, setActiveTool] = useState<
    'pen' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'note'
  >('pen');
  const [activeColor, setActiveColor] = useState<string>('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  // Redraw entire canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0f172a'; // slate-900 canvas background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid pattern
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const all = currentElement ? [...elements, currentElement] : elements;

    for (const el of all) {
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'draw') {
        if (el.points && el.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
      } else if (el.type === 'rect') {
        if (el.x !== undefined && el.y !== undefined && el.width && el.height) {
          ctx.strokeRect(el.x, el.y, el.width, el.height);
        }
      } else if (el.type === 'circle') {
        if (el.x !== undefined && el.y !== undefined && el.width) {
          ctx.beginPath();
          const radius = Math.abs(el.width / 2);
          ctx.arc(el.x + radius, el.y + radius, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (el.type === 'line') {
        if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + el.width, el.y + el.height);
          ctx.stroke();
        }
      } else if (el.type === 'note') {
        if (el.x !== undefined && el.y !== undefined) {
          // Sticky note card
          ctx.fillStyle = '#fef08a'; // yellow sticky
          ctx.fillRect(el.x, el.y, 140, 100);
          ctx.fillStyle = '#0f172a';
          ctx.font = '12px sans-serif';
          ctx.fillText(el.text || 'Sticky note', el.x + 10, el.y + 24);
        }
      } else if (el.type === 'text') {
        if (el.x !== undefined && el.y !== undefined) {
          ctx.fillStyle = el.color;
          ctx.font = '16px sans-serif';
          ctx.fillText(el.text || 'Text', el.x, el.y);
        }
      }

      ctx.restore();
    }
  }, [elements, currentElement]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle incoming whiteboard broadcasts from other participants
  useEffect(() => {
    const unsub = signaling.on('whiteboard', (data: any) => {
      if (data.drawData) {
        if (data.drawData.type === 'clear') {
          setElements([]);
        } else if (data.drawData.type === 'sync') {
          setElements(data.drawData.elements);
        } else if (data.drawData.element) {
          setElements((prev) => [...prev, data.drawData.element]);
        }
      }
    });

    return () => unsub();
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      renderCanvas();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [renderCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);

    if (activeTool === 'eraser') {
      // Find and remove element nearby
      const newEls = elements.filter((el) => {
        if (el.points) {
          return !el.points.some((p) => Math.hypot(p.x - x, p.y - y) < 20);
        }
        if (el.x !== undefined && el.y !== undefined) {
          return Math.hypot(el.x - x, el.y - y) > 30;
        }
        return true;
      });
      setHistory((prev) => [...prev, elements]);
      setElements(newEls);
      signaling.send({
        type: 'whiteboard',
        drawData: { type: 'sync', elements: newEls },
      });
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentElement({
        id: 'el-' + Date.now(),
        type: 'draw',
        points: [{ x, y }],
        color: activeTool === 'highlighter' ? `${activeColor}80` : activeColor,
        strokeWidth: activeTool === 'highlighter' ? 16 : strokeWidth,
      });
    } else if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      setCurrentElement({
        id: 'el-' + Date.now(),
        type: activeTool,
        x,
        y,
        width: 0,
        height: 0,
        color: activeColor,
        strokeWidth,
      });
    } else if (activeTool === 'note') {
      const newEl: WhiteboardElement = {
        id: 'el-' + Date.now(),
        type: 'note',
        x,
        y,
        color: activeColor,
        strokeWidth: 1,
        text: 'New Meeting Idea',
      };
      setHistory((prev) => [...prev, elements]);
      setElements((prev) => [...prev, newEl]);
      signaling.send({
        type: 'whiteboard',
        drawData: { element: newEl },
      });
      setIsDrawing(false);
    } else if (activeTool === 'text') {
      const newEl: WhiteboardElement = {
        id: 'el-' + Date.now(),
        type: 'text',
        x,
        y,
        color: activeColor,
        strokeWidth: 1,
        text: 'Meeting Agenda & Notes',
      };
      setHistory((prev) => [...prev, elements]);
      setElements((prev) => [...prev, newEl]);
      signaling.send({
        type: 'whiteboard',
        drawData: { element: newEl },
      });
      setIsDrawing(false);
    }
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;
    const { x, y } = getCoordinates(e);

    if (currentElement.type === 'draw') {
      setCurrentElement((prev) => ({
        ...prev!,
        points: [...(prev!.points || []), { x, y }],
      }));
    } else if (
      currentElement.type === 'rect' ||
      currentElement.type === 'circle' ||
      currentElement.type === 'line'
    ) {
      setCurrentElement((prev) => ({
        ...prev!,
        width: x - (prev!.x || 0),
        height: y - (prev!.y || 0),
      }));
    }
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentElement) {
      setHistory((prev) => [...prev, elements]);
      const newElements = [...elements, currentElement];
      setElements(newElements);
      setRedoStack([]);

      // Send to peers
      signaling.send({
        type: 'whiteboard',
        drawData: { element: currentElement },
      });

      setCurrentElement(null);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [...prev, elements]);
    setElements(previous);
    setHistory((prev) => prev.slice(0, -1));

    signaling.send({
      type: 'whiteboard',
      drawData: { type: 'sync', elements: previous },
    });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, elements]);
    setElements(next);
    setRedoStack((prev) => prev.slice(0, -1));

    signaling.send({
      type: 'whiteboard',
      drawData: { type: 'sync', elements: next },
    });
  };

  const clearCanvas = () => {
    setHistory((prev) => [...prev, elements]);
    setElements([]);
    signaling.send({
      type: 'whiteboard',
      drawData: { type: 'clear' },
    });
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = image;
    a.download = `openroom-whiteboard-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 select-none">
      {/* Floating Top Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 shadow-2xl flex items-center gap-1 sm:gap-2">
        {/* Drawing Tools */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'pen'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Pen"
          >
            <PenTool className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'eraser'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'rect'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'circle'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Circle"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'line'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Line"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('note')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'note'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Sticky Note"
          >
            <StickyNote className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'text'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Text Tool"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${
                activeColor === c ? 'scale-125 ring-2 ring-white shadow' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              className={`p-1.5 rounded-lg flex items-center justify-center ${
                strokeWidth === w ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: `${w + 2}px`, height: `${w + 2}px` }}
              />
            </button>
          ))}
        </div>

        {/* Actions (Undo, Redo, Clear, Save, Close) */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={clearCanvas}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={exportPNG}
            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all"
            title="Save PNG"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-all ml-1"
            title="Exit Whiteboard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={drawMove}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        className="w-full h-full cursor-crosshair"
      />
    </div>
  );
};
