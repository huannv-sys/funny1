import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { mikrotikService } from "./services/mikrotik";
import { firewallRuleService } from "./services/firewallRules";
import { WebSocketMessage, DeviceResponse } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket connections
  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
      clients.delete(ws);
    });
    
    // Send initial device list
    storage.getDevices().then(devices => {
      const devicesList: DeviceResponse[] = devices.map(device => ({
        id: device.id,
        name: device.name,
        address: device.address,
        isConnected: device.isConnected
      }));
      
      const message: WebSocketMessage = {
        type: 'DEVICE_STATUS_UPDATE',
        payload: devicesList
      };
      
      ws.send(JSON.stringify(message));
    });
  });
  
  // Helper function to broadcast to all connected WebSocket clients
  const broadcast = (message: WebSocketMessage) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };
  
  // Subscribe to MikroTik events
  const setupMikroTikSubscriptions = async () => {
    const devices = await storage.getDevices();
    
    devices.forEach(device => {
      // Try to connect to device
      mikrotikService.connectToDevice(device).then(connected => {
        if (connected) {
          // Update device status
          storage.updateDevice(device.id, { 
            isConnected: true,
            lastConnected: new Date()
          });
          
          // Subscribe to device events
          mikrotikService.subscribeToUpdates(device.id, (event, data) => {
            if (event === 'rulesUpdate') {
              // Sync firewall rules
              firewallRuleService.syncFirewallRules(device.id).then(rules => {
                // Broadcast updated rules
                const message: WebSocketMessage = {
                  type: 'FIREWALL_RULE_UPDATE',
                  payload: {
                    deviceId: device.id,
                    rules: rules.map(firewallRuleService.convertToResponse)
                  }
                };
                
                broadcast(message);
              });
            } else if (event === 'connected' || event === 'disconnected') {
              // Update device connection status
              storage.updateDevice(device.id, { 
                isConnected: event === 'connected',
                lastConnected: event === 'connected' ? new Date() : device.lastConnected
              }).then(() => {
                // Broadcast updated device list
                storage.getDevices().then(allDevices => {
                  const devicesList: DeviceResponse[] = allDevices.map(d => ({
                    id: d.id,
                    name: d.name,
                    address: d.address,
                    isConnected: d.isConnected
                  }));
                  
                  const message: WebSocketMessage = {
                    type: 'DEVICE_STATUS_UPDATE',
                    payload: devicesList
                  };
                  
                  broadcast(message);
                });
              });
            }
          });
          
          // Initial sync of firewall rules
          firewallRuleService.syncFirewallRules(device.id);
        }
      });
    });
  };
  
  // Initialize MikroTik connections
  setupMikroTikSubscriptions();
  
  // API endpoints
  
  // Devices
  app.get('/api/devices', async (req: Request, res: Response) => {
    try {
      const devices = await storage.getDevices();
      
      const devicesList: DeviceResponse[] = devices.map(device => ({
        id: device.id,
        name: device.name,
        address: device.address,
        isConnected: device.isConnected
      }));
      
      res.json(devicesList);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get devices' });
    }
  });
  
  app.get('/api/devices/:id', async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      res.json({
        id: device.id,
        name: device.name,
        address: device.address,
        isConnected: device.isConnected
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get device' });
    }
  });
  
  // Firewall Rules
  app.get('/api/devices/:id/firewall-rules', async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      // Get filter parameters
      const chain = req.query.chain as string;
      const enabled = req.query.enabled !== undefined 
        ? req.query.enabled === 'true' 
        : undefined;
      const search = req.query.search as string;
      
      // Get firewall rules
      const rules = await firewallRuleService.getFirewallRules(deviceId, {
        chain: chain === 'All Chains' ? undefined : chain,
        enabled,
        search
      });
      
      // Convert to response format
      const response = rules.map(firewallRuleService.convertToResponse);
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get firewall rules' });
    }
  });
  
  app.get('/api/devices/:deviceId/firewall-rules/:id', async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const ruleId = parseInt(req.params.id);
      
      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const rule = await firewallRuleService.getFirewallRule(ruleId);
      if (!rule || rule.deviceId !== deviceId) {
        return res.status(404).json({ error: 'Firewall rule not found' });
      }
      
      // Convert to response format
      const response = firewallRuleService.convertToResponse(rule);
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get firewall rule' });
    }
  });
  
  app.post('/api/devices/:id/sync-firewall-rules', async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      // Sync firewall rules
      const rules = await firewallRuleService.syncFirewallRules(deviceId);
      
      // Convert to response format
      const response = rules.map(firewallRuleService.convertToResponse);
      
      res.json(response);
    } catch (error) {
      console.error('Error syncing firewall rules:', error);
      res.status(500).json({ error: 'Failed to sync firewall rules' });
    }
  });

  return httpServer;
}
