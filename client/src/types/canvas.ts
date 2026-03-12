export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  userId: string;
  userName: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser' | 'highlighter';
  timestamp: number;
}

export interface DrawingTool {
  type: 'pen' | 'eraser' | 'highlighter' | 'text';
  color: string;
  width: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
}

export interface RemoteStrokeMessage {
  type: 'stroke';
  stroke: Stroke;
}

export interface UserJoinedMessage {
  type: 'user_joined';
  user: User;
}

export interface UserLeftMessage {
  type: 'user_left';
  userId: string;
}

export interface CursorUpdateMessage {
  type: 'cursor_update';
  userId: string;
  cursor: Point;
}

export type WebSocketMessage =
  | RemoteStrokeMessage
  | UserJoinedMessage
  | UserLeftMessage
  | CursorUpdateMessage;

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];

    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;

    if (i === 1) {
      path += ` L ${midX} ${midY}`;
    } else {
      path += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
    }
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export const HIGHLIGHTER_OPACITY = 0.4;
export const DEFAULT_COLORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FFA500',
  '#800080',
  '#FFC0CB',
  '#A52A2A',
  '#808080',
  '#FFD700',
  '#4B0082',
  '#00CED1',
];
