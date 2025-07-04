import { WindowInfo } from '../types/agent';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WindowManager {
  private isInitialized = false;
  private windows: WindowInfo[] = [];

  async initialize(): Promise<void> {
    try {
      this.isInitialized = true;
      await this.refreshWindows();
    } catch (error) {
      console.error('Failed to initialize WindowManager:', error);
      throw error;
    }
  }

  async getWindows(): Promise<WindowInfo[]> {
    await this.refreshWindows();
    return [...this.windows];
  }

  async getActiveWindow(): Promise<WindowInfo | null> {
    try {
      if (process.platform === 'win32') {
        return this.getActiveWindowWindows();
      } else if (process.platform === 'darwin') {
        return this.getActiveWindowMac();
      } else {
        return this.getActiveWindowLinux();
      }
    } catch (error) {
      console.error('Failed to get active window:', error);
      return null;
    }
  }

  private async getActiveWindowWindows(): Promise<WindowInfo | null> {
    try {
      const { stdout } = await execAsync('powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \\"\\""} | Select-Object ProcessName,MainWindowTitle,Id | ConvertTo-Json"');
      const processes = JSON.parse(stdout);
      
      if (processes && processes.length > 0) {
        const activeProcess = processes[0];
        return {
          id: `win_${activeProcess.Id}`,
          title: activeProcess.MainWindowTitle,
          processName: activeProcess.ProcessName,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // Mock bounds
          isVisible: true,
          isActive: true,
          pid: activeProcess.Id
        };
      }
    } catch (error) {
      console.warn('Failed to get Windows active window:', error);
    }
    return null;
  }

  private async getActiveWindowMac(): Promise<WindowInfo | null> {
    try {
      const { stdout } = await execAsync('osascript -e "tell application \\"System Events\\" to get name of first application process whose frontmost is true"');
      const processName = stdout.trim();
      
      return {
        id: `mac_${Date.now()}`,
        title: processName,
        processName,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // Mock bounds
        isVisible: true,
        isActive: true,
        pid: 0
      };
    } catch (error) {
      console.warn('Failed to get Mac active window:', error);
    }
    return null;
  }

  private async getActiveWindowLinux(): Promise<WindowInfo | null> {
    try {
      const { stdout } = await execAsync('xdotool getactivewindow getwindowname');
      const title = stdout.trim();
      
      const { stdout: pidOut } = await execAsync('xdotool getactivewindow getwindowpid');
      const pid = parseInt(pidOut.trim());
      
      return {
        id: `linux_${pid}`,
        title,
        processName: 'unknown',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }, // Mock bounds
        isVisible: true,
        isActive: true,
        pid
      };
    } catch (error) {
      console.warn('Failed to get Linux active window, using mock data:', error);
      return {
        id: 'mock_active_window',
        title: 'Active Window',
        processName: 'mock-process',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        isVisible: true,
        isActive: true,
        pid: 1234
      };
    }
  }

  private async refreshWindows(): Promise<void> {
    try {
      if (process.platform === 'win32') {
        await this.refreshWindowsWindows();
      } else if (process.platform === 'darwin') {
        await this.refreshWindowsMac();
      } else {
        await this.refreshWindowsLinux();
      }
    } catch (error) {
      console.warn('Failed to refresh windows, using mock data:', error);
      this.windows = this.getMockWindows();
    }
  }

  private async refreshWindowsWindows(): Promise<void> {
    try {
      const { stdout } = await execAsync('powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \\"\\""} | Select-Object ProcessName,MainWindowTitle,Id | ConvertTo-Json"');
      const processes = JSON.parse(stdout);
      
      this.windows = (Array.isArray(processes) ? processes : [processes]).map((proc: any, index: number) => ({
        id: `win_${proc.Id}`,
        title: proc.MainWindowTitle,
        processName: proc.ProcessName,
        bounds: { x: index * 50, y: index * 50, width: 800, height: 600 },
        isVisible: true,
        isActive: index === 0,
        pid: proc.Id
      }));
    } catch (error) {
      throw error;
    }
  }

  private async refreshWindowsMac(): Promise<void> {
    try {
      const { stdout } = await execAsync('osascript -e "tell application \\"System Events\\" to get name of every application process whose visible is true"');
      const processNames = stdout.split(', ').map(name => name.replace(/"/g, ''));
      
      this.windows = processNames.map((name, index) => ({
        id: `mac_${index}`,
        title: name,
        processName: name,
        bounds: { x: index * 50, y: index * 50, width: 800, height: 600 },
        isVisible: true,
        isActive: index === 0,
        pid: index + 1000
      }));
    } catch (error) {
      throw error;
    }
  }

  private async refreshWindowsLinux(): Promise<void> {
    try {
      const { stdout } = await execAsync('wmctrl -l');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      this.windows = lines.map((line, index) => {
        const parts = line.split(/\s+/);
        const windowId = parts[0];
        const title = parts.slice(3).join(' ');
        
        return {
          id: `linux_${windowId}`,
          title,
          processName: 'unknown',
          bounds: { x: index * 50, y: index * 50, width: 800, height: 600 },
          isVisible: true,
          isActive: index === 0,
          pid: parseInt(windowId, 16)
        };
      });
    } catch (error) {
      throw error;
    }
  }

  private getMockWindows(): WindowInfo[] {
    return [
      {
        id: 'mock_1',
        title: 'Browser Window',
        processName: 'chrome',
        bounds: { x: 100, y: 100, width: 1200, height: 800 },
        isVisible: true,
        isActive: true,
        pid: 1234
      },
      {
        id: 'mock_2',
        title: 'Text Editor',
        processName: 'code',
        bounds: { x: 200, y: 200, width: 1000, height: 700 },
        isVisible: true,
        isActive: false,
        pid: 5678
      },
      {
        id: 'mock_3',
        title: 'Terminal',
        processName: 'terminal',
        bounds: { x: 300, y: 300, width: 800, height: 600 },
        isVisible: true,
        isActive: false,
        pid: 9012
      }
    ];
  }

  async focusWindow(windowId: string): Promise<boolean> {
    try {
      const window = this.windows.find(w => w.id === windowId);
      if (!window) {
        throw new Error(`Window ${windowId} not found`);
      }

      if (process.platform === 'win32') {
        await execAsync(`powershell "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport(\\"user32.dll\\")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); }'; [Win32]::SetForegroundWindow([Win32]::FindWindow($null, '${window.title}'))"`);
      } else if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \\"${window.processName}\\" to activate"`);
      } else {
        await execAsync(`wmctrl -a "${window.title}"`);
      }

      return true;
    } catch (error) {
      console.error('Failed to focus window:', error);
      return false;
    }
  }

  async closeWindow(windowId: string): Promise<boolean> {
    try {
      const window = this.windows.find(w => w.id === windowId);
      if (!window) {
        throw new Error(`Window ${windowId} not found`);
      }

      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${window.pid} /F`);
      } else {
        await execAsync(`kill ${window.pid}`);
      }

      // Remove from local cache
      this.windows = this.windows.filter(w => w.id !== windowId);
      return true;
    } catch (error) {
      console.error('Failed to close window:', error);
      return false;
    }
  }

  async installPackage(packageName: string): Promise<{ success: boolean; message: string; logs?: string[] }> {
    try {
      console.log(`Installing package: ${packageName}`);
      
      // Determine package manager and installation command
      let installCommand: string;
      
      if (process.platform === 'win32') {
        // Try Chocolatey, then Winget, then npm
        installCommand = `choco install ${packageName} -y || winget install ${packageName} || npm install -g ${packageName}`;
      } else if (process.platform === 'darwin') {
        // Try Homebrew, then npm
        installCommand = `brew install ${packageName} || npm install -g ${packageName}`;
      } else {
        // Try various Linux package managers
        installCommand = `apt-get install -y ${packageName} || yum install -y ${packageName} || pacman -S ${packageName} --noconfirm || snap install ${packageName} || npm install -g ${packageName}`;
      }

      const { stdout, stderr } = await execAsync(installCommand);
      
      return {
        success: true,
        message: `Successfully installed ${packageName}`,
        logs: [stdout, stderr].filter(Boolean)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to install ${packageName}: ${errorMessage}`,
        logs: [errorMessage]
      };
    }
  }

  async uninstallPackage(packageName: string): Promise<{ success: boolean; message: string; logs?: string[] }> {
    try {
      console.log(`Uninstalling package: ${packageName}`);
      
      let uninstallCommand: string;
      
      if (process.platform === 'win32') {
        uninstallCommand = `choco uninstall ${packageName} -y || winget uninstall ${packageName} || npm uninstall -g ${packageName}`;
      } else if (process.platform === 'darwin') {
        uninstallCommand = `brew uninstall ${packageName} || npm uninstall -g ${packageName}`;
      } else {
        uninstallCommand = `apt-get remove -y ${packageName} || yum remove -y ${packageName} || pacman -R ${packageName} --noconfirm || snap remove ${packageName} || npm uninstall -g ${packageName}`;
      }

      const { stdout, stderr } = await execAsync(uninstallCommand);
      
      return {
        success: true,
        message: `Successfully uninstalled ${packageName}`,
        logs: [stdout, stderr].filter(Boolean)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to uninstall ${packageName}: ${errorMessage}`,
        logs: [errorMessage]
      };
    }
  }

  async searchPackages(query: string): Promise<Array<{ name: string; description: string; version?: string }>> {
    try {
      const results: Array<{ name: string; description: string; version?: string }> = [];
      
      if (process.platform === 'win32') {
        try {
          const { stdout } = await execAsync(`winget search ${query}`);
          // Parse winget output (simplified)
          const lines = stdout.split('\n').slice(2); // Skip header
          lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
              results.push({
                name: parts[0],
                description: parts.slice(1).join(' '),
                version: parts[1]
              });
            }
          });
        } catch (wingetError) {
          console.warn('Winget search failed:', wingetError);
        }
      }
      
      // Also search npm packages
      try {
        const { stdout } = await execAsync(`npm search ${query} --json`);
        const npmResults = JSON.parse(stdout);
        npmResults.forEach((pkg: any) => {
          results.push({
            name: pkg.name,
            description: pkg.description || 'No description',
            version: pkg.version
          });
        });
      } catch (npmError) {
        console.warn('NPM search failed:', npmError);
      }
      
      return results.slice(0, 20); // Limit results
    } catch (error) {
      console.error('Failed to search packages:', error);
      return [];
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}