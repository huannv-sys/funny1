import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// MikroTik Device model
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  port: integer("port").default(8728),
  isConnected: boolean("is_connected").default(false),
  lastConnected: timestamp("last_connected"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devices).pick({
  name: true,
  address: true,
  username: true,
  password: true,
  port: true,
});

// Firewall Rule model
export const firewallRules = pgTable("firewall_rules", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  ruleId: text("rule_id").notNull(), // The original MikroTik rule ID
  chain: text("chain").notNull(),
  action: text("action").notNull(),
  enabled: boolean("enabled").default(true),
  srcAddress: text("src_address"),
  dstAddress: text("dst_address"),
  protocol: text("protocol"),
  srcPort: text("src_port"),
  dstPort: text("dst_port"),
  hits: integer("hits").default(0),
  bytes: integer("bytes").default(0),
  comment: text("comment"),
  position: integer("position"),
  connectionState: text("connection_state"),
  lastModified: timestamp("last_modified"),
  lastHit: timestamp("last_hit"),
  details: jsonb("details"), // Any additional fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFirewallRuleSchema = createInsertSchema(firewallRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHit: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type FirewallRule = typeof firewallRules.$inferSelect;
export type InsertFirewallRule = z.infer<typeof insertFirewallRuleSchema>;

// API response types
export type FirewallRuleResponse = {
  id: string;
  chain: string;
  action: string;
  srcAddress?: string;
  dstAddress?: string;
  protocol?: string;
  srcPort?: string;
  dstPort?: string;
  enabled: boolean;
  hits: number;
  bytes: number;
  comment?: string;
  position: number;
  connectionState?: string;
  lastModified?: string;
  lastHit?: string;
  details?: Record<string, any>;
};

export type DeviceResponse = {
  id: number;
  name: string;
  address: string;
  isConnected: boolean;
};

// WebSocket message types
export type WebSocketMessage = {
  type: 'FIREWALL_RULE_UPDATE' | 'DEVICE_STATUS_UPDATE' | 'ERROR';
  payload: any;
};
