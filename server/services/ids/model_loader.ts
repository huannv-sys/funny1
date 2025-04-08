/**
 * Model Loader for IDS Service
 * Loads the trained ML model for intrusion detection
 */

import { spawn } from 'child_process';
import { join } from 'path';

// Create a simple logger interface if the main logger is not available
const logger = (() => {
  try {
    const { logger } = require('../../logger');
    return logger;
  } catch (error) {
    return {
      info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
      debug: (message: string, ...args: any[]) => {
        if (process.env.DEBUG === 'true') {
          console.debug(`[DEBUG] ${message}`, ...args);
        }
      }
    };
  }
})();

// Interface for prediction results
export interface PredictionResult {
  isAnomaly: boolean;
  probability: number;
  timestamp: Date;
  features?: Record<string, any>;
}

class ModelLoader {
  private modelReady: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the model loader
   */
  private async initialize(): Promise<void> {
    // Check if model file exists
    try {
      const modelPath = join(process.cwd(), 'rf_model.joblib');
      
      // Using dynamic import for fs
      const fs = await import('fs');
      
      if (fs.existsSync(modelPath)) {
        logger.info(`Model file found at ${modelPath}`);
        this.modelReady = true;
      } else {
        logger.error(`Model file not found at ${modelPath}`);
        this.modelReady = false;
      }
    } catch (error) {
      logger.error(`Error initializing model loader: ${error}`);
      this.modelReady = false;
    }
  }

  /**
   * Check if the model is ready
   */
  public isModelReady(): boolean {
    return this.modelReady;
  }

  /**
   * Make a prediction using the ML model
   * @param features The features to use for prediction
   */
  public async predict(features: Record<string, number>): Promise<PredictionResult> {
    return new Promise((resolve, reject) => {
      try {
        // Use Python script for prediction
        const pythonProcess = spawn('python3', [
          join(process.cwd(), 'server/services/ids/predict.py'),
          JSON.stringify(features)
        ]);

        let result = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
          result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          logger.error(`Python error: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            logger.error(`Python process exited with code ${code}: ${errorOutput}`);
            reject(new Error(`Prediction failed with code ${code}: ${errorOutput}`));
            return;
          }

          try {
            const prediction = JSON.parse(result);
            resolve({
              isAnomaly: prediction.is_anomaly,
              probability: prediction.probability,
              timestamp: new Date(),
              features: features
            });
          } catch (error) {
            logger.error(`Error parsing prediction result: ${error}`);
            reject(error);
          }
        });
      } catch (error) {
        logger.error(`Error running prediction: ${error}`);
        reject(error);
      }
    });
  }
}

// Export a singleton instance
export const modelLoader = new ModelLoader();