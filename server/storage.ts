import { 
  users, type User, type InsertUser,
  devices, type Device, type InsertDevice,
  firewallRules, type FirewallRule, type InsertFirewallRule
} from "@shared/schema";

// Interface for storage operations
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Devices
  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined>;
  deleteDevice(id: number): Promise<boolean>;
  
  // Firewall Rules
  getFirewallRules(deviceId: number, filters?: {
    chain?: string;
    enabled?: boolean;
    search?: string;
  }): Promise<FirewallRule[]>;
  getFirewallRule(id: number): Promise<FirewallRule | undefined>;
  getFirewallRuleByRuleId(deviceId: number, ruleId: string): Promise<FirewallRule | undefined>;
  createFirewallRule(rule: InsertFirewallRule): Promise<FirewallRule>;
  updateFirewallRule(id: number, updates: Partial<FirewallRule>): Promise<FirewallRule | undefined>;
  updateFirewallRuleByRuleId(deviceId: number, ruleId: string, updates: Partial<FirewallRule>): Promise<FirewallRule | undefined>;
  deleteFirewallRule(id: number): Promise<boolean>;
  deleteFirewallRulesByDeviceId(deviceId: number): Promise<boolean>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private devices: Map<number, Device>;
  private firewallRules: Map<number, FirewallRule>;
  private userIdCounter: number;
  private deviceIdCounter: number;
  private firewallRuleIdCounter: number;

  constructor() {
    this.users = new Map();
    this.devices = new Map();
    this.firewallRules = new Map();
    this.userIdCounter = 1;
    this.deviceIdCounter = 1;
    this.firewallRuleIdCounter = 1;
    
    // Add a default admin user
    this.createUser({
      username: 'admin',
      password: 'admin'
    });
    
    // Add some sample devices
    this.createDevice({
      name: 'Router-1',
      address: '192.168.1.1',
      username: 'admin',
      password: '',
      port: 8728
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  async getDevice(id: number): Promise<Device | undefined> {
    return this.devices.get(id);
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const id = this.deviceIdCounter++;
    const now = new Date();
    const device: Device = { 
      ...insertDevice, 
      id, 
      isConnected: false,
      lastConnected: null,
      createdAt: now,
      updatedAt: now
    };
    this.devices.set(id, device);
    return device;
  }

  async updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined> {
    const device = this.devices.get(id);
    if (!device) return undefined;
    
    const updated: Device = { 
      ...device, 
      ...updates,
      updatedAt: new Date()
    };
    this.devices.set(id, updated);
    return updated;
  }

  async deleteDevice(id: number): Promise<boolean> {
    // Delete all firewall rules for this device
    await this.deleteFirewallRulesByDeviceId(id);
    return this.devices.delete(id);
  }

  // Firewall Rule methods
  async getFirewallRules(deviceId: number, filters?: {
    chain?: string;
    enabled?: boolean;
    search?: string;
  }): Promise<FirewallRule[]> {
    let rules = Array.from(this.firewallRules.values()).filter(
      rule => rule.deviceId === deviceId
    );
    
    if (filters) {
      if (filters.chain && filters.chain !== 'All Chains') {
        rules = rules.filter(rule => rule.chain === filters.chain);
      }
      
      if (filters.enabled !== undefined) {
        rules = rules.filter(rule => rule.enabled === filters.enabled);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        rules = rules.filter(rule => 
          rule.chain.toLowerCase().includes(search) ||
          rule.action.toLowerCase().includes(search) ||
          (rule.srcAddress && rule.srcAddress.toLowerCase().includes(search)) ||
          (rule.dstAddress && rule.dstAddress.toLowerCase().includes(search)) ||
          (rule.protocol && rule.protocol.toLowerCase().includes(search)) ||
          (rule.comment && rule.comment.toLowerCase().includes(search))
        );
      }
    }
    
    // Sort by position
    return rules.sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  async getFirewallRule(id: number): Promise<FirewallRule | undefined> {
    return this.firewallRules.get(id);
  }

  async getFirewallRuleByRuleId(deviceId: number, ruleId: string): Promise<FirewallRule | undefined> {
    return Array.from(this.firewallRules.values()).find(
      rule => rule.deviceId === deviceId && rule.ruleId === ruleId
    );
  }

  async createFirewallRule(insertRule: InsertFirewallRule): Promise<FirewallRule> {
    const id = this.firewallRuleIdCounter++;
    const now = new Date();
    const rule: FirewallRule = { 
      ...insertRule, 
      id,
      createdAt: now,
      updatedAt: now,
      lastHit: null,
    };
    this.firewallRules.set(id, rule);
    return rule;
  }

  async updateFirewallRule(id: number, updates: Partial<FirewallRule>): Promise<FirewallRule | undefined> {
    const rule = this.firewallRules.get(id);
    if (!rule) return undefined;
    
    const updated: FirewallRule = { 
      ...rule, 
      ...updates,
      updatedAt: new Date()
    };
    this.firewallRules.set(id, updated);
    return updated;
  }

  async updateFirewallRuleByRuleId(deviceId: number, ruleId: string, updates: Partial<FirewallRule>): Promise<FirewallRule | undefined> {
    const rule = await this.getFirewallRuleByRuleId(deviceId, ruleId);
    if (!rule) return undefined;
    
    return this.updateFirewallRule(rule.id, updates);
  }

  async deleteFirewallRule(id: number): Promise<boolean> {
    return this.firewallRules.delete(id);
  }

  async deleteFirewallRulesByDeviceId(deviceId: number): Promise<boolean> {
    const rules = Array.from(this.firewallRules.values());
    
    for (const rule of rules) {
      if (rule.deviceId === deviceId) {
        this.firewallRules.delete(rule.id);
      }
    }
    
    return true;
  }
}

// Export storage instance
export const storage = new MemStorage();
