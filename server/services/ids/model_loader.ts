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
      // Try multiple possible paths for the model
      const possiblePaths = [
        join(process.cwd(), 'rf_model.joblib'),
        join(process.cwd(), 'attached_assets', 'rf_model.joblib')
      ];
      
      // Using dynamic import for fs
      const fs = await import('fs');
      let modelFound = false;
      let foundPath = '';
      
      for (const modelPath of possiblePaths) {
        if (fs.existsSync(modelPath)) {
          logger.info(`Model file found at ${modelPath}`);
          this.modelReady = true;
          modelFound = true;
          foundPath = modelPath;
          // Create a symlink to ensure predict.py can find it
          if (modelPath !== join(process.cwd(), 'rf_model.joblib')) {
            try {
              // Remove existing symlink if it exists
              if (fs.existsSync(join(process.cwd(), 'rf_model.joblib'))) {
                fs.unlinkSync(join(process.cwd(), 'rf_model.joblib'));
              }
              // Create the symlink
              fs.symlinkSync(modelPath, join(process.cwd(), 'rf_model.joblib'));
              logger.info(`Created symlink from ${modelPath} to ${join(process.cwd(), 'rf_model.joblib')}`);
            } catch (symlinkError) {
              logger.warn(`Failed to create symlink for model: ${symlinkError}`);
              // If symlink fails, try copying the file
              try {
                fs.copyFileSync(modelPath, join(process.cwd(), 'rf_model.joblib'));
                logger.info(`Copied model from ${modelPath} to ${join(process.cwd(), 'rf_model.joblib')}`);
              } catch (copyError) {
                logger.error(`Failed to copy model file: ${copyError}`);
              }
            }
          }
          break;
        }
      }
      
      if (!modelFound) {
        logger.error(`Model file not found in any of the expected locations`);
        this.modelReady = false;
      } else {
        // Test model with a simple prediction to ensure it's valid
        try {
          const testFeatures = this.getTestFeatures();
          await this.predict(testFeatures);
          logger.info("Model successfully tested with sample data");
        } catch (testError) {
          logger.error(`Model testing failed: ${testError}`);
          this.modelReady = false;
        }
      }
    } catch (error) {
      logger.error(`Error initializing model loader: ${error}`);
      this.modelReady = false;
    }
  }

  /**
   * Generate test features for model verification
   */
  private getTestFeatures(): Record<string, number> {
    return {
      'Destination Port': 80,
      'Flow Duration': 1000,
      'Total Fwd Packets': 10,
      'Total Backward Packets': 10,
      'Total Length of Fwd Packets': 1000,
      'Total Length of Bwd Packets': 1000,
      'Fwd Packet Length Max': 1500,
      'Fwd Packet Length Min': 64,
      'Fwd Packet Length Mean': 100,
      'Fwd Packet Length Std': 200,
      'Bwd Packet Length Max': 1500,
      'Bwd Packet Length Min': 64,
      'Bwd Packet Length Mean': 100,
      'Bwd Packet Length Std': 200,
      'Flow Bytes/s': 1000,
      'Flow Packets/s': 10,
      'Flow IAT Mean': 100,
      'Flow IAT Std': 100,
      'Flow IAT Max': 1000,
      'Flow IAT Min': 1,
      'Fwd IAT Total': 500,
      'Fwd IAT Mean': 100,
      'Fwd IAT Std': 50,
      'Fwd IAT Max': 500,
      'Fwd IAT Min': 1,
      'Bwd IAT Total': 500,
      'Bwd IAT Mean': 100,
      'Bwd IAT Std': 50,
      'Bwd IAT Max': 500,
      'Bwd IAT Min': 1,
      'Fwd PSH Flags': 1,
      'Bwd PSH Flags': 1,
      'Fwd URG Flags': 0,
      'Bwd URG Flags': 0,
      'Fwd Header Length': 200,
      'Bwd Header Length': 200,
      'Fwd Packets/s': 5,
      'Bwd Packets/s': 5,
      'Min Packet Length': 64,
      'Max Packet Length': 1500,
      'Packet Length Mean': 100,
      'Packet Length Std': 300,
      'Packet Length Variance': 90000,
      'FIN Flag Count': 1,
      'SYN Flag Count': 1,
      'RST Flag Count': 0,
      'PSH Flag Count': 2,
      'ACK Flag Count': 18,
      'URG Flag Count': 0,
      'CWE Flag Count': 0,
      'ECE Flag Count': 0,
      'Down/Up Ratio': 1,
      'Average Packet Size': 100,
      'Avg Fwd Segment Size': 100,
      'Avg Bwd Segment Size': 100
    };
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