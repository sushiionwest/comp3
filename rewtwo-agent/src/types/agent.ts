export interface AgentAction {
  id: string;
  type: 'click' | 'type' | 'scroll' | 'screenshot' | 'navigate' | 'social_post' | 'window_install';
  target?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ScreenCapture {
  id: string;
  dataUrl: string;
  timestamp: number;
  width: number;
  height: number;
  elements?: ElementInfo[];
}

export interface ElementInfo {
  id: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  text?: string;
  clickable: boolean;
  visible: boolean;
}

export interface AgentState {
  isRunning: boolean;
  currentTask?: string;
  lastAction?: AgentAction;
  actionsQueue: AgentAction[];
  completedActions: AgentAction[];
  errorCount: number;
  startTime?: number;
  performance: {
    actionsPerMinute: number;
    successRate: number;
    averageActionTime: number;
  };
}

export interface WindowInfo {
  id: string;
  title: string;
  processName: string;
  bounds: { x: number; y: number; width: number; height: number };
  isVisible: boolean;
  isActive: boolean;
  pid: number;
}

export interface SocialMediaTask {
  id: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin';
  action: 'post' | 'comment' | 'like' | 'share' | 'follow';
  content?: string;
  targetUrl?: string;
  imageUrl?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: string;
}

export interface VisionAnalysis {
  id: string;
  imageUrl: string;
  analysis: {
    description: string;
    tags: string[];
    objects: Array<{
      name: string;
      confidence: number;
      bounds: { x: number; y: number; width: number; height: number };
    }>;
    text?: Array<{
      content: string;
      bounds: { x: number; y: number; width: number; height: number };
    }>;
  };
  timestamp: number;
}