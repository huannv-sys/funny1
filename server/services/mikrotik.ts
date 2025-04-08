import { EventEmitter } from 'events';
import type { Device, FirewallRuleResponse } from '@shared/schema';

// Using Node.js APIs to simulate MikroTik API interaction
// In a real implementation, this would use a proper MikroTik API library
export class MikroTikConnection extends EventEmitter {
  private address: string;
  private username: string;
  private password: string;
  private port: number;
  private isConnected: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private deviceId: number;

  constructor(device: Device) {
    super();
    this.address = device.address;
    this.username = device.username;
    this.password = device.password;
    this.port = device.port;
    this.deviceId = device.id;
  }

  async connect(): Promise<boolean> {
    try {
      // Simulate connection - in a real implementation, this would connect to the MikroTik device
      console.log(`Connecting to MikroTik device at ${this.address}:${this.port}`);
      this.isConnected = true;
      
      // Start sending updates periodically
      this.startUpdates();
      
      this.emit('connected', { deviceId: this.deviceId });
      return true;
    } catch (error) {
      console.error('Error connecting to MikroTik device:', error);
      this.isConnected = false;
      this.emit('error', { deviceId: this.deviceId, error });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected', { deviceId: this.deviceId });
  }

  async getFirewallRules(): Promise<FirewallRuleResponse[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to MikroTik device');
    }

    // Simulate fetching firewall rules - in a real implementation, this would use the MikroTik API
    return this.generateMockFirewallRules();
  }

  private startUpdates(): void {
    // Send rule updates every 5 seconds
    this.intervalId = setInterval(() => {
      if (this.isConnected) {
        const rules = this.generateMockFirewallRules();
        this.emit('rulesUpdate', { deviceId: this.deviceId, rules });
      }
    }, 5000);
  }

  // Generate mock data for simulation purposes
  private generateMockFirewallRules(): FirewallRuleResponse[] {
    // Chains that exist in MikroTik
    const chains = ['input', 'forward', 'output'];
    const actions = ['accept', 'drop', 'reject', 'fasttrack', 'tarpit'];
    const protocols = ['tcp', 'udp', 'icmp', 'any'];
    
    const numRules = 20 + Math.floor(Math.random() * 10); // 20-29 rules
    const rules: FirewallRuleResponse[] = [];
    
    for (let i = 0; i < numRules; i++) {
      const now = new Date();
      const lastHit = new Date(now.getTime() - Math.floor(Math.random() * 86400000)); // Random time within the last 24 hours
      
      // Sometimes create disabled rules
      const enabled = Math.random() > 0.2;
      
      // Generate random hits and bytes based on chain and enabled status
      let hits = 0;
      let bytes = 0;
      
      if (enabled) {
        hits = Math.floor(Math.random() * 50000);
        bytes = hits * (100 + Math.floor(Math.random() * 900)); // 100-1000 bytes per hit on average
      }
      
      const rule: FirewallRuleResponse = {
        id: `*${i+1}`,
        chain: chains[Math.floor(Math.random() * chains.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        srcAddress: Math.random() > 0.2 ? `192.168.${Math.floor(Math.random() * 255)}.0/24` : '0.0.0.0/0',
        dstAddress: Math.random() > 0.2 ? `10.0.${Math.floor(Math.random() * 255)}.0/24` : '0.0.0.0/0',
        protocol: protocols[Math.floor(Math.random() * protocols.length)],
        enabled,
        hits,
        bytes,
        position: i+1,
        comment: this.getRandomComment(),
        lastModified: now.toISOString(),
        lastHit: enabled && hits > 0 ? lastHit.toISOString() : undefined,
      };
      
      // Add port information for TCP/UDP protocols
      if (rule.protocol === 'tcp' || rule.protocol === 'udp') {
        rule.dstPort = this.getRandomPorts();
      }
      
      rules.push(rule);
    }
    
    return rules;
  }

  private getRandomComment(): string | undefined {
    const comments = [
      'Block external access',
      'Allow LAN traffic',
      'Reject SSH access',
      'Allow ICMP',
      'Allow DNS traffic',
      'Block malicious IPs',
      'Permit HTTP/HTTPS',
      'Allow VPN connections',
      'Temporary rule',
      'Custom filtering'
    ];
    
    return Math.random() > 0.3 ? comments[Math.floor(Math.random() * comments.length)] : undefined;
  }

  private getRandomPorts(): string {
    const commonPorts = ['80', '443', '22', '25', '53', '3389', '21', '8080'];
    
    if (Math.random() > 0.6) {
      // Return multiple ports
      const numPorts = 1 + Math.floor(Math.random() * 3);
      const selectedPorts = [];
      
      for (let i = 0; i < numPorts; i++) {
        selectedPorts.push(commonPorts[Math.floor(Math.random() * commonPorts.length)]);
      }
      
      return [...new Set(selectedPorts)].join(',');
    } else {
      // Return a single port
      return commonPorts[Math.floor(Math.random() * commonPorts.length)];
    }
  }
}

// Store active connections
const connections = new Map<number, MikroTikConnection>();

// Service methods
export const mikrotikService = {
  async connectToDevice(device: Device): Promise<boolean> {
    // Check if connection already exists
    if (connections.has(device.id)) {
      return true;
    }
    
    // Create new connection
    const connection = new MikroTikConnection(device);
    const success = await connection.connect();
    
    if (success) {
      connections.set(device.id, connection);
    }
    
    return success;
  },
  
  async disconnectFromDevice(deviceId: number): Promise<void> {
    const connection = connections.get(deviceId);
    if (connection) {
      await connection.disconnect();
      connections.delete(deviceId);
    }
  },
  
  getConnection(deviceId: number): MikroTikConnection | undefined {
    return connections.get(deviceId);
  },
  
  async getFirewallRules(deviceId: number): Promise<FirewallRuleResponse[]> {
    const connection = connections.get(deviceId);
    if (!connection) {
      throw new Error(`No active connection for device ${deviceId}`);
    }
    
    return connection.getFirewallRules();
  },
  
  subscribeToUpdates(deviceId: number, callback: (event: string, data: any) => void): () => void {
    const connection = connections.get(deviceId);
    if (!connection) {
      throw new Error(`No active connection for device ${deviceId}`);
    }
    
    const onConnected = (data: any) => callback('connected', data);
    const onDisconnected = (data: any) => callback('disconnected', data);
    const onRulesUpdate = (data: any) => callback('rulesUpdate', data);
    const onError = (data: any) => callback('error', data);
    
    connection.on('connected', onConnected);
    connection.on('disconnected', onDisconnected);
    connection.on('rulesUpdate', onRulesUpdate);
    connection.on('error', onError);
    
    // Return unsubscribe function
    return () => {
      connection.off('connected', onConnected);
      connection.off('disconnected', onDisconnected);
      connection.off('rulesUpdate', onRulesUpdate);
      connection.off('error', onError);
    };
  },
  
  getAllConnections(): Map<number, MikroTikConnection> {
    return connections;
  }
};
