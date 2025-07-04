import { AgentAction, AgentState, ScreenCapture, ElementInfo, WindowInfo } from '../types/agent';
import { VisionService } from '../services/VisionService';
import { WindowManager } from '../services/WindowManager';
import { ScreenCaptureService } from '../services/ScreenCaptureService';
import { ActionExecutor } from '../services/ActionExecutor';

export class ComputerUseAgent {
  private state: AgentState;
  private visionService: VisionService;
  private windowManager: WindowManager;
  private screenCapture: ScreenCaptureService;
  private actionExecutor: ActionExecutor;
  private eventListeners: Map<string, Function[]> = new Map();
  private actionQueue: AgentAction[] = [];
  private isProcessing = false;

  constructor() {
    this.state = {
      isRunning: false,
      actionsQueue: [],
      completedActions: [],
      errorCount: 0,
      performance: {
        actionsPerMinute: 0,
        successRate: 0,
        averageActionTime: 0
      }
    };

    this.visionService = new VisionService();
    this.windowManager = new WindowManager();
    this.screenCapture = new ScreenCaptureService();
    this.actionExecutor = new ActionExecutor();

    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.visionService.initialize();
      await this.windowManager.initialize();
      await this.screenCapture.initialize();
      await this.actionExecutor.initialize();
      
      this.emit('agent:initialized');
    } catch (error) {
      this.emit('agent:error', { error: 'Failed to initialize services', details: error });
    }
  }

  public async start(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Agent is already running');
    }

    this.state.isRunning = true;
    this.state.startTime = Date.now();
    this.state.errorCount = 0;
    
    this.emit('agent:started');
    
    // Start processing queue
    this.processActionQueue();
    
    // Start monitoring loop
    this.startMonitoring();
  }

  public async stop(): Promise<void> {
    this.state.isRunning = false;
    this.isProcessing = false;
    
    // Cancel any pending actions
    this.actionQueue.forEach(action => {
      action.status = 'failed';
      action.error = 'Agent stopped';
    });
    
    this.emit('agent:stopped');
  }

  public async takeScreenshot(): Promise<ScreenCapture> {
    try {
      const screenshot = await this.screenCapture.capture();
      const elements = await this.analyzeScreenElements(screenshot);
      
      const capture: ScreenCapture = {
        id: `screenshot_${Date.now()}`,
        dataUrl: screenshot.dataUrl,
        timestamp: Date.now(),
        width: screenshot.width,
        height: screenshot.height,
        elements
      };

      this.emit('screenshot:captured', capture);
      return capture;
    } catch (error) {
      this.handleError('Failed to take screenshot', error);
      throw error;
    }
  }

  private async analyzeScreenElements(screenshot: any): Promise<ElementInfo[]> {
    try {
      const analysis = await this.visionService.analyzeScreen(screenshot.dataUrl);
      
      return analysis.objects.map((obj, index) => ({
        id: `element_${index}`,
        type: obj.name,
        bounds: obj.bounds,
        text: obj.text,
        clickable: this.isClickableElement(obj.name),
        visible: true
      }));
    } catch (error) {
      console.warn('Failed to analyze screen elements:', error);
      return [];
    }
  }

  private isClickableElement(elementType: string): boolean {
    const clickableTypes = ['button', 'link', 'input', 'select', 'checkbox', 'radio'];
    return clickableTypes.some(type => elementType.toLowerCase().includes(type));
  }

  public async queueAction(action: Omit<AgentAction, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const agentAction: AgentAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.actionQueue.push(agentAction);
    this.state.actionsQueue.push(agentAction);
    
    this.emit('action:queued', agentAction);
    
    if (!this.isProcessing && this.state.isRunning) {
      this.processActionQueue();
    }

    return agentAction.id;
  }

  private async processActionQueue(): Promise<void> {
    if (this.isProcessing || !this.state.isRunning || this.actionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.actionQueue.length > 0 && this.state.isRunning) {
      const action = this.actionQueue.shift()!;
      await this.executeAction(action);
      
      // Small delay between actions
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  private async executeAction(action: AgentAction): Promise<void> {
    const startTime = Date.now();
    
    try {
      action.status = 'executing';
      this.state.lastAction = action;
      this.emit('action:executing', action);

      let result: any;

      switch (action.type) {
        case 'click':
          result = await this.actionExecutor.click(action.coordinates!);
          break;
        
        case 'type':
          result = await this.actionExecutor.type(action.text!);
          break;
        
        case 'scroll':
          result = await this.actionExecutor.scroll(action.coordinates!, action.text as any);
          break;
        
        case 'screenshot':
          result = await this.takeScreenshot();
          break;
        
        case 'navigate':
          result = await this.actionExecutor.navigate(action.target!);
          break;
        
        case 'window_install':
          result = await this.installWindow(action.target!);
          break;
        
        case 'social_post':
          result = await this.handleSocialPost(action);
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      action.status = 'completed';
      action.result = result;
      
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(true, executionTime);
      
      this.state.completedActions.push(action);
      this.removeFromQueue(action);
      
      this.emit('action:completed', action);
      
    } catch (error) {
      action.status = 'failed';
      action.error = error instanceof Error ? error.message : String(error);
      
      this.state.errorCount++;
      this.updatePerformanceMetrics(false, Date.now() - startTime);
      this.handleError(`Action ${action.type} failed`, error);
      
      this.removeFromQueue(action);
      this.emit('action:failed', action);
    }
  }

  private async installWindow(packageName: string): Promise<any> {
    return this.windowManager.installPackage(packageName);
  }

  private async handleSocialPost(action: AgentAction): Promise<any> {
    // This will be implemented in the social media service
    return { success: true, message: 'Social post queued' };
  }

  private removeFromQueue(action: AgentAction): void {
    const index = this.state.actionsQueue.findIndex(a => a.id === action.id);
    if (index !== -1) {
      this.state.actionsQueue.splice(index, 1);
    }
  }

  private updatePerformanceMetrics(success: boolean, executionTime: number): void {
    const completed = this.state.completedActions.length;
    const failed = this.state.errorCount;
    const total = completed + failed;
    
    if (total > 0) {
      this.state.performance.successRate = (completed / total) * 100;
    }
    
    const runtime = this.state.startTime ? (Date.now() - this.state.startTime) / 60000 : 1;
    this.state.performance.actionsPerMinute = total / runtime;
    
    const avgTime = this.state.performance.averageActionTime;
    this.state.performance.averageActionTime = avgTime 
      ? (avgTime + executionTime) / 2 
      : executionTime;
  }

  private startMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (!this.state.isRunning) {
        clearInterval(monitorInterval);
        return;
      }
      
      this.emit('agent:status', this.getState());
    }, 1000);
  }

  public getState(): AgentState {
    return { ...this.state };
  }

  public async getWindows(): Promise<WindowInfo[]> {
    return this.windowManager.getWindows();
  }

  public async getActiveWindow(): Promise<WindowInfo | null> {
    return this.windowManager.getActiveWindow();
  }

  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.emit('agent:error', { message, error });
  }

  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  public destroy(): void {
    this.stop();
    this.eventListeners.clear();
    this.actionQueue = [];
  }
}