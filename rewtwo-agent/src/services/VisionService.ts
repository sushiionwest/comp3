import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js';

export interface VisionAnalysisResult {
  description: string;
  tags: string[];
  objects: Array<{
    name: string;
    confidence: number;
    bounds: { x: number; y: number; width: number; height: number };
    text?: string;
  }>;
  text?: Array<{
    content: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

export class VisionService {
  private client: ComputerVisionClient | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // For demo purposes, we'll use a mock implementation
      // In production, you would use actual Azure credentials
      const subscriptionKey = process.env.AZURE_COMPUTER_VISION_KEY || 'demo-key';
      const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT || 'https://demo.cognitiveservices.azure.com/';
      
      if (subscriptionKey === 'demo-key') {
        console.warn('Using mock Vision Service - set AZURE_COMPUTER_VISION_KEY for real implementation');
        this.isInitialized = true;
        return;
      }

      const cognitiveServicesCredentials = new CognitiveServicesCredentials(subscriptionKey);
      this.client = new ComputerVisionClient(cognitiveServicesCredentials, endpoint);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Vision Service:', error);
      // Fall back to mock mode
      this.isInitialized = true;
    }
  }

  async analyzeScreen(imageDataUrl: string): Promise<VisionAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Vision Service not initialized');
    }

    try {
      if (!this.client) {
        return this.mockAnalysis();
      }

      // Convert data URL to buffer
      const buffer = this.dataUrlToBuffer(imageDataUrl);
      
      // Analyze image
      const [analysis, objects, text] = await Promise.all([
        this.client.analyzeImageInStream(buffer, {
          visualFeatures: ['Description', 'Tags', 'Objects']
        }),
        this.client.detectObjectsInStream(buffer),
        this.client.recognizePrintedTextInStream(true, buffer)
      ]);

      return {
        description: analysis.description?.captions?.[0]?.text || 'No description available',
        tags: analysis.tags?.map(tag => tag.name || '').filter(Boolean) || [],
        objects: objects.objects?.map(obj => ({
          name: obj.object || 'unknown',
          confidence: obj.confidence || 0,
          bounds: {
            x: obj.rectangle?.x || 0,
            y: obj.rectangle?.y || 0,
            width: obj.rectangle?.w || 0,
            height: obj.rectangle?.h || 0
          }
        })) || [],
        text: this.extractTextBlocks(text)
      };
    } catch (error) {
      console.warn('Vision analysis failed, using mock data:', error);
      return this.mockAnalysis();
    }
  }

  private extractTextBlocks(textResult: any): Array<{ content: string; bounds: any }> {
    if (!textResult?.recognitionResult?.lines) {
      return [];
    }

    return textResult.recognitionResult.lines.map((line: any) => ({
      content: line.text,
      bounds: {
        x: Math.min(...line.words.map((w: any) => w.boundingBox[0])),
        y: Math.min(...line.words.map((w: any) => w.boundingBox[1])),
        width: Math.max(...line.words.map((w: any) => w.boundingBox[2])) - Math.min(...line.words.map((w: any) => w.boundingBox[0])),
        height: Math.max(...line.words.map((w: any) => w.boundingBox[3])) - Math.min(...line.words.map((w: any) => w.boundingBox[1]))
      }
    }));
  }

  private mockAnalysis(): VisionAnalysisResult {
    return {
      description: 'Computer screen with various UI elements',
      tags: ['computer', 'screen', 'interface', 'window', 'button'],
      objects: [
        {
          name: 'button',
          confidence: 0.85,
          bounds: { x: 100, y: 200, width: 80, height: 30 }
        },
        {
          name: 'text_input',
          confidence: 0.90,
          bounds: { x: 200, y: 150, width: 200, height: 25 }
        },
        {
          name: 'window',
          confidence: 0.95,
          bounds: { x: 50, y: 50, width: 800, height: 600 }
        }
      ],
      text: [
        {
          content: 'Click here',
          bounds: { x: 100, y: 200, width: 80, height: 30 }
        }
      ]
    };
  }

  private dataUrlToBuffer(dataUrl: string): Buffer {
    const base64Data = dataUrl.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }

  async analyzeImage(imageUrl: string): Promise<VisionAnalysisResult> {
    if (!this.isInitialized) {
      throw new Error('Vision Service not initialized');
    }

    try {
      if (!this.client) {
        return this.mockAnalysis();
      }

      const [analysis, objects] = await Promise.all([
        this.client.analyzeImage(imageUrl, {
          visualFeatures: ['Description', 'Tags', 'Objects']
        }),
        this.client.detectObjects(imageUrl)
      ]);

      return {
        description: analysis.description?.captions?.[0]?.text || 'No description available',
        tags: analysis.tags?.map(tag => tag.name || '').filter(Boolean) || [],
        objects: objects.objects?.map(obj => ({
          name: obj.object || 'unknown',
          confidence: obj.confidence || 0,
          bounds: {
            x: obj.rectangle?.x || 0,
            y: obj.rectangle?.y || 0,
            width: obj.rectangle?.w || 0,
            height: obj.rectangle?.h || 0
          }
        })) || []
      };
    } catch (error) {
      console.warn('Image analysis failed, using mock data:', error);
      return this.mockAnalysis();
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}