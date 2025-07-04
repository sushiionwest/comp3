import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ClickResult {
  success: boolean;
  coordinates: { x: number; y: number };
  timestamp: number;
}

export interface TypeResult {
  success: boolean;
  text: string;
  timestamp: number;
}

export interface ScrollResult {
  success: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
  amount: number;
  timestamp: number;
}

export interface NavigateResult {
  success: boolean;
  url: string;
  timestamp: number;
}

export class ActionExecutor {
  private isInitialized = false;
  private mouseController: any = null;
  private keyboardController: any = null;

  async initialize(): Promise<void> {
    try {
      // Try to initialize platform-specific controllers
      if (process.platform === 'win32') {
        await this.initializeWindows();
      } else if (process.platform === 'darwin') {
        await this.initializeMac();
      } else {
        await this.initializeLinux();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize native input control, using fallback:', error);
      this.isInitialized = true; // Use mock mode
    }
  }

  private async initializeWindows(): Promise<void> {
    try {
      // For Windows, we'd use native Windows APIs
      // For now, use PowerShell commands as fallback
      this.mouseController = {
        click: async (x: number, y: number) => {
          await execAsync(`powershell "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 100; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo); }'; [Mouse]::mouse_event(0x02, 0, 0, 0, 0); [Mouse]::mouse_event(0x04, 0, 0, 0, 0)"`);
        }
      };
      
      this.keyboardController = {
        type: async (text: string) => {
          const escapedText = text.replace(/"/g, '""');
          await execAsync(`powershell "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`);
        }
      };
    } catch (error) {
      throw new Error('Failed to initialize Windows input control');
    }
  }

  private async initializeMac(): Promise<void> {
    try {
      this.mouseController = {
        click: async (x: number, y: number) => {
          await execAsync(`osascript -e "tell application \\"System Events\\" to click at {${x}, ${y}}"`);
        }
      };
      
      this.keyboardController = {
        type: async (text: string) => {
          const escapedText = text.replace(/"/g, '\\"');
          await execAsync(`osascript -e "tell application \\"System Events\\" to keystroke \\"${escapedText}\\""`);
        }
      };
    } catch (error) {
      throw new Error('Failed to initialize macOS input control');
    }
  }

  private async initializeLinux(): Promise<void> {
    try {
      // Check if xdotool is available
      await execAsync('which xdotool');
      
      this.mouseController = {
        click: async (x: number, y: number) => {
          await execAsync(`xdotool mousemove ${x} ${y}`);
          await execAsync(`xdotool click 1`);
        }
      };
      
      this.keyboardController = {
        type: async (text: string) => {
          await execAsync(`xdotool type "${text}"`);
        }
      };
    } catch (error) {
      throw new Error('Failed to initialize Linux input control (xdotool not found)');
    }
  }

  async click(coordinates: { x: number; y: number }): Promise<ClickResult> {
    try {
      if (this.mouseController) {
        await this.mouseController.click(coordinates.x, coordinates.y);
      } else {
        console.log(`Mock click at (${coordinates.x}, ${coordinates.y})`);
      }
      
      return {
        success: true,
        coordinates,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Click failed:', error);
      return {
        success: false,
        coordinates,
        timestamp: Date.now()
      };
    }
  }

  async doubleClick(coordinates: { x: number; y: number }): Promise<ClickResult> {
    try {
      if (this.mouseController) {
        await this.mouseController.click(coordinates.x, coordinates.y);
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.mouseController.click(coordinates.x, coordinates.y);
      } else {
        console.log(`Mock double click at (${coordinates.x}, ${coordinates.y})`);
      }
      
      return {
        success: true,
        coordinates,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Double click failed:', error);
      return {
        success: false,
        coordinates,
        timestamp: Date.now()
      };
    }
  }

  async rightClick(coordinates: { x: number; y: number }): Promise<ClickResult> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`xdotool mousemove ${coordinates.x} ${coordinates.y}`);
        await execAsync(`xdotool click 3`);
      } else if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \\"System Events\\" to right click at {${coordinates.x}, ${coordinates.y}}"`);
      } else {
        // Windows right click implementation would go here
        console.log(`Mock right click at (${coordinates.x}, ${coordinates.y})`);
      }
      
      return {
        success: true,
        coordinates,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Right click failed:', error);
      return {
        success: false,
        coordinates,
        timestamp: Date.now()
      };
    }
  }

  async type(text: string): Promise<TypeResult> {
    try {
      if (this.keyboardController) {
        await this.keyboardController.type(text);
      } else {
        console.log(`Mock typing: "${text}"`);
      }
      
      return {
        success: true,
        text,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Typing failed:', error);
      return {
        success: false,
        text,
        timestamp: Date.now()
      };
    }
  }

  async keyPress(key: string): Promise<{ success: boolean; key: string; timestamp: number }> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`xdotool key ${key}`);
      } else if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \\"System Events\\" to key code ${this.getKeyCode(key)}"`);
      } else {
        // Windows key press implementation
        console.log(`Mock key press: ${key}`);
      }
      
      return {
        success: true,
        key,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Key press failed:', error);
      return {
        success: false,
        key,
        timestamp: Date.now()
      };
    }
  }

  private getKeyCode(key: string): number {
    // Map common keys to macOS key codes
    const keyMap: { [key: string]: number } = {
      'Return': 36,
      'Enter': 36,
      'Space': 49,
      'Tab': 48,
      'Escape': 53,
      'Backspace': 51,
      'Delete': 117,
      'Up': 126,
      'Down': 125,
      'Left': 123,
      'Right': 124
    };
    
    return keyMap[key] || 0;
  }

  async scroll(coordinates: { x: number; y: number }, direction: 'up' | 'down' | 'left' | 'right', amount: number = 3): Promise<ScrollResult> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`xdotool mousemove ${coordinates.x} ${coordinates.y}`);
        
        const scrollMap = {
          'up': '4',
          'down': '5',
          'left': '6',
          'right': '7'
        };
        
        for (let i = 0; i < amount; i++) {
          await execAsync(`xdotool click ${scrollMap[direction]}`);
        }
      } else if (process.platform === 'darwin') {
        const scrollDirection = direction === 'up' ? 'up' : direction === 'down' ? 'down' : direction;
        await execAsync(`osascript -e "tell application \\"System Events\\" to scroll at {${coordinates.x}, ${coordinates.y}} in direction \\"${scrollDirection}\\" for ${amount} units"`);
      } else {
        console.log(`Mock scroll ${direction} at (${coordinates.x}, ${coordinates.y}) amount: ${amount}`);
      }
      
      return {
        success: true,
        direction,
        amount,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Scroll failed:', error);
      return {
        success: false,
        direction,
        amount,
        timestamp: Date.now()
      };
    }
  }

  async drag(start: { x: number; y: number }, end: { x: number; y: number }): Promise<{ success: boolean; start: any; end: any; timestamp: number }> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`xdotool mousemove ${start.x} ${start.y}`);
        await execAsync(`xdotool mousedown 1`);
        await execAsync(`xdotool mousemove ${end.x} ${end.y}`);
        await execAsync(`xdotool mouseup 1`);
      } else if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \\"System Events\\" to drag from {${start.x}, ${start.y}} to {${end.x}, ${end.y}}"`);
      } else {
        console.log(`Mock drag from (${start.x}, ${start.y}) to (${end.x}, ${end.y})`);
      }
      
      return {
        success: true,
        start,
        end,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Drag failed:', error);
      return {
        success: false,
        start,
        end,
        timestamp: Date.now()
      };
    }
  }

  async navigate(url: string): Promise<NavigateResult> {
    try {
      // Open URL in default browser
      let command: string;
      
      if (process.platform === 'win32') {
        command = `start "${url}"`;
      } else if (process.platform === 'darwin') {
        command = `open "${url}"`;
      } else {
        command = `xdg-open "${url}"`;
      }
      
      await execAsync(command);
      
      return {
        success: true,
        url,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Navigation failed:', error);
      return {
        success: false,
        url,
        timestamp: Date.now()
      };
    }
  }

  async moveMouse(coordinates: { x: number; y: number }): Promise<{ success: boolean; coordinates: any; timestamp: number }> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`xdotool mousemove ${coordinates.x} ${coordinates.y}`);
      } else if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \\"System Events\\" to set mouse location to {${coordinates.x}, ${coordinates.y}}"`);
      } else {
        console.log(`Mock mouse move to (${coordinates.x}, ${coordinates.y})`);
      }
      
      return {
        success: true,
        coordinates,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Mouse move failed:', error);
      return {
        success: false,
        coordinates,
        timestamp: Date.now()
      };
    }
  }

  async wait(milliseconds: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}