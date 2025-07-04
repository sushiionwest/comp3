import * as sharp from 'sharp';

export interface CaptureResult {
  dataUrl: string;
  buffer: Buffer;
  width: number;
  height: number;
  timestamp: number;
}

export class ScreenCaptureService {
  private isInitialized = false;
  private captureFunction: (() => Promise<Buffer>) | null = null;

  async initialize(): Promise<void> {
    try {
      // Try to initialize platform-specific screen capture
      if (process.platform === 'win32') {
        await this.initializeWindows();
      } else if (process.platform === 'darwin') {
        await this.initializeMac();
      } else {
        await this.initializeLinux();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize native screen capture, using fallback:', error);
      // Fallback to mock capture for demo
      this.captureFunction = this.mockCapture;
      this.isInitialized = true;
    }
  }

  private async initializeWindows(): Promise<void> {
    try {
      // Try to use screenshot-desktop for Windows
      const screenshotDesktop = await import('screenshot-desktop');
      this.captureFunction = async () => {
        const buffer = await screenshotDesktop.default();
        return buffer;
      };
    } catch (error) {
      throw new Error('Failed to initialize Windows screen capture');
    }
  }

  private async initializeMac(): Promise<void> {
    try {
      // Use screencapture command on macOS
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs/promises');
      
      this.captureFunction = async () => {
        const tempFile = `/tmp/screenshot_${Date.now()}.png`;
        await execAsync(`screencapture -x ${tempFile}`);
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile); // Clean up
        return buffer;
      };
    } catch (error) {
      throw new Error('Failed to initialize macOS screen capture');
    }
  }

  private async initializeLinux(): Promise<void> {
    try {
      // Try different Linux screen capture methods
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs/promises');
      
      // Test available tools
      const tools = ['gnome-screenshot', 'scrot', 'import', 'xwd'];
      let workingTool: string | null = null;
      
      for (const tool of tools) {
        try {
          await execAsync(`which ${tool}`);
          workingTool = tool;
          break;
        } catch {
          continue;
        }
      }
      
      if (!workingTool) {
        throw new Error('No screen capture tool found');
      }
      
      this.captureFunction = async () => {
        const tempFile = `/tmp/screenshot_${Date.now()}.png`;
        
        switch (workingTool) {
          case 'gnome-screenshot':
            await execAsync(`gnome-screenshot -f ${tempFile}`);
            break;
          case 'scrot':
            await execAsync(`scrot ${tempFile}`);
            break;
          case 'import':
            await execAsync(`import -window root ${tempFile}`);
            break;
          case 'xwd':
            await execAsync(`xwd -root -out ${tempFile}.xwd && convert ${tempFile}.xwd ${tempFile}`);
            break;
        }
        
        const buffer = await fs.readFile(tempFile);
        await fs.unlink(tempFile); // Clean up
        return buffer;
      };
    } catch (error) {
      throw new Error('Failed to initialize Linux screen capture');
    }
  }

  private async mockCapture(): Promise<Buffer> {
    // Create a mock screenshot using Sharp
    const mockImage = sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 240, g: 240, b: 240 }
      }
    });

    // Add some mock UI elements
    const mockUI = Buffer.from(`
      <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <rect width="1920" height="1080" fill="#f0f0f0"/>
        <rect x="100" y="100" width="1720" height="80" fill="#2563eb" rx="8"/>
        <text x="120" y="150" font-family="Arial" font-size="24" fill="white">Mock Desktop - Computer Use Agent</text>
        
        <rect x="200" y="250" width="200" height="40" fill="#10b981" rx="4"/>
        <text x="220" y="275" font-family="Arial" font-size="16" fill="white">Button 1</text>
        
        <rect x="450" y="250" width="200" height="40" fill="#f59e0b" rx="4"/>
        <text x="470" y="275" font-family="Arial" font-size="16" fill="white">Button 2</text>
        
        <rect x="200" y="320" width="400" height="30" fill="white" stroke="#d1d5db" stroke-width="1" rx="4"/>
        <text x="210" y="340" font-family="Arial" font-size="14" fill="#6b7280">Text input field</text>
        
        <rect x="200" y="400" width="800" height="400" fill="white" stroke="#d1d5db" stroke-width="1" rx="8"/>
        <text x="220" y="430" font-family="Arial" font-size="18" fill="#111827">Mock Application Window</text>
        <text x="220" y="460" font-family="Arial" font-size="14" fill="#6b7280">This is a simulated desktop for demonstration purposes.</text>
        <text x="220" y="490" font-family="Arial" font-size="14" fill="#6b7280">The agent can interact with these mock UI elements.</text>
        
        <circle cx="1800" cy="150" r="30" fill="#ef4444"/>
        <text x="1785" y="160" font-family="Arial" font-size="16" fill="white">X</text>
      </svg>
    `);

    return await mockImage
      .composite([{ input: mockUI, top: 0, left: 0 }])
      .png()
      .toBuffer();
  }

  async capture(): Promise<CaptureResult> {
    if (!this.isInitialized || !this.captureFunction) {
      throw new Error('ScreenCaptureService not initialized');
    }

    try {
      const buffer = await this.captureFunction();
      
      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 1920;
      const height = metadata.height || 1080;
      
      // Convert to data URL
      const base64 = buffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      
      return {
        dataUrl,
        buffer,
        width,
        height,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Screen capture failed:', error);
      throw error;
    }
  }

  async captureRegion(x: number, y: number, width: number, height: number): Promise<CaptureResult> {
    const fullCapture = await this.capture();
    
    try {
      // Crop the captured image
      const croppedBuffer = await sharp(fullCapture.buffer)
        .extract({ left: x, top: y, width, height })
        .png()
        .toBuffer();
      
      const base64 = croppedBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      
      return {
        dataUrl,
        buffer: croppedBuffer,
        width,
        height,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Region capture failed:', error);
      throw error;
    }
  }

  async captureWindow(windowId: string): Promise<CaptureResult> {
    // For now, return a full screen capture
    // In a real implementation, you would capture specific windows
    return this.capture();
  }

  async startRecording(outputPath: string, fps: number = 30): Promise<void> {
    // This would start a screen recording
    // Implementation depends on platform and requirements
    console.warn('Screen recording not implemented yet');
  }

  async stopRecording(): Promise<void> {
    // Stop the screen recording
    console.warn('Screen recording not implemented yet');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    try {
      const capture = await this.capture();
      return { width: capture.width, height: capture.height };
    } catch (error) {
      console.warn('Failed to get screen size, using default:', error);
      return { width: 1920, height: 1080 };
    }
  }
}