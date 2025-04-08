import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart, 
  Pie,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Colors for visualization
const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", 
  "#82CA9D", "#FFC658", "#8DD1E1", "#A4DE6C", "#D0ED57"
];

interface TrafficVisualizationsProps {
  deviceId: number;
  startDate?: string;
  endDate?: string;
  refreshInterval?: number;
}

interface TrafficDataPoint {
  timestamp: string;
  download: number;
  upload: number;
  total: number;
}

interface Protocol {
  name: string;
  value: number;
  percent: number;
}

interface SourceIP {
  ip: string;
  count: number;
  bytes: number;
}

interface AnomalyData {
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  probability: number;
  anomaly_type: string;
}

const TrafficVisualizations: React.FC<TrafficVisualizationsProps> = ({
  deviceId,
  startDate,
  endDate,
  refreshInterval = 60000,
}) => {
  const [activeTab, setActiveTab] = useState("bandwidth");
  const [timeRange, setTimeRange] = useState<"hour" | "day" | "week" | "month">("hour");

  // Fetch traffic data
  const { data: trafficData, isLoading: trafficLoading } = useQuery({
    queryKey: ['/api/devices', deviceId, 'traffic', timeRange],
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: true,
  });

  // Fetch protocol distribution data
  const { data: protocolData, isLoading: protocolLoading } = useQuery({
    queryKey: ['/api/devices', deviceId, 'protocols', timeRange],
    refetchInterval: refreshInterval,
  });

  // Fetch top sources data
  const { data: sourceData, isLoading: sourceLoading } = useQuery({
    queryKey: ['/api/devices', deviceId, 'sources', timeRange],
    refetchInterval: refreshInterval,
  });

  // Fetch anomaly data
  const { data: anomalyData, isLoading: anomalyLoading } = useQuery({
    queryKey: ['/api/security/anomalies', {startTime: startDate, endTime: endDate}],
    refetchInterval: refreshInterval,
  });

  // Format the bandwidth data for visualization
  const formatBandwidthData = (): TrafficDataPoint[] => {
    if (!trafficData || !trafficData.data) return [];
    
    return trafficData.data.map((item: any) => ({
      timestamp: new Date(item.timestamp).toLocaleTimeString(),
      download: (item.download / (1024 * 1024)).toFixed(2), // Convert to MB
      upload: (item.upload / (1024 * 1024)).toFixed(2), // Convert to MB
      total: ((item.download + item.upload) / (1024 * 1024)).toFixed(2), // Convert to MB
    }));
  };

  // Format protocol data for visualization
  const formatProtocolData = (): Protocol[] => {
    if (!protocolData || !protocolData.data) return [];
    
    return protocolData.data.map((item: any, index: number) => ({
      name: item.protocol,
      value: item.count,
      percent: item.percentage,
    }));
  };

  // Format source IP data for visualization
  const formatSourceData = (): SourceIP[] => {
    if (!sourceData || !sourceData.data) return [];
    
    return sourceData.data.map((item: any) => ({
      ip: item.ip,
      count: item.connections,
      bytes: item.bytes,
    }));
  };

  // Format anomaly data for visualization
  const formatAnomalyData = (): AnomalyData[] => {
    if (!anomalyData || !anomalyData.data) return [];
    
    return anomalyData.data.map((item: any) => ({
      timestamp: new Date(item.timestamp).toLocaleString(),
      source_ip: item.sourceIp,
      destination_ip: item.destinationIp,
      probability: item.probability,
      anomaly_type: item.anomalyType || "Unknown",
    }));
  };

  // Handle time range change
  const handleTimeRangeChange = (range: "hour" | "day" | "week" | "month") => {
    setTimeRange(range);
  };

  // Calculate summary statistics
  const getStatistics = () => {
    if (!trafficData || !trafficData.data) {
      return {
        totalDownload: 0,
        totalUpload: 0,
        peakDownload: 0,
        peakUpload: 0,
        avgDownload: 0,
        avgUpload: 0,
      };
    }

    const data = trafficData.data;
    let totalDownload = 0;
    let totalUpload = 0;
    let peakDownload = 0;
    let peakUpload = 0;

    data.forEach((item: any) => {
      totalDownload += item.download;
      totalUpload += item.upload;
      peakDownload = Math.max(peakDownload, item.download);
      peakUpload = Math.max(peakUpload, item.upload);
    });

    return {
      totalDownload: (totalDownload / (1024 * 1024 * 1024)).toFixed(2), // GB
      totalUpload: (totalUpload / (1024 * 1024 * 1024)).toFixed(2), // GB
      peakDownload: (peakDownload / (1024 * 1024)).toFixed(2), // MB
      peakUpload: (peakUpload / (1024 * 1024)).toFixed(2), // MB
      avgDownload: (totalDownload / data.length / (1024 * 1024)).toFixed(2), // MB
      avgUpload: (totalUpload / data.length / (1024 * 1024)).toFixed(2), // MB
    };
  };

  const stats = getStatistics();

  // Get the anomaly detection count and latest anomalies
  const getAnomalyStats = () => {
    if (!anomalyData || !anomalyData.data) {
      return {
        count: 0,
        latestAnomalies: [],
      };
    }

    const sortedAnomalies = [...anomalyData.data].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      count: anomalyData.data.length,
      latestAnomalies: sortedAnomalies.slice(0, 5),
    };
  };

  const anomalyStats = getAnomalyStats();

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="bandwidth">Băng Thông</TabsTrigger>
          <TabsTrigger value="protocols">Giao Thức</TabsTrigger>
          <TabsTrigger value="source">Nguồn & Đích</TabsTrigger>
          <TabsTrigger value="anomalies">Phát Hiện Xâm Nhập</TabsTrigger>
        </TabsList>

        {/* Time Range Selector */}
        <div className="flex justify-end mt-4 space-x-2">
          <Button 
            variant={timeRange === "hour" ? "default" : "outline"} 
            size="sm"
            onClick={() => handleTimeRangeChange("hour")}
          >
            1 Giờ
          </Button>
          <Button 
            variant={timeRange === "day" ? "default" : "outline"} 
            size="sm"
            onClick={() => handleTimeRangeChange("day")}
          >
            1 Ngày
          </Button>
          <Button 
            variant={timeRange === "week" ? "default" : "outline"} 
            size="sm"
            onClick={() => handleTimeRangeChange("week")}
          >
            1 Tuần
          </Button>
          <Button 
            variant={timeRange === "month" ? "default" : "outline"} 
            size="sm"
            onClick={() => handleTimeRangeChange("month")}
          >
            1 Tháng
          </Button>
        </div>

        {/* Bandwidth Tab */}
        <TabsContent value="bandwidth">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.totalDownload} GB</div>
                <p className="text-sm text-gray-500">Tổng tải xuống</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.totalUpload} GB</div>
                <p className="text-sm text-gray-500">Tổng tải lên</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.peakDownload} MB/s</div>
                <p className="text-sm text-gray-500">Tốc độ tải xuống cao nhất</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.peakUpload} MB/s</div>
                <p className="text-sm text-gray-500">Tốc độ tải lên cao nhất</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Băng Thông Theo Thời Gian</CardTitle>
                <CardDescription>Lưu lượng tải lên và tải xuống (MB/s)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart
                    data={formatBandwidthData()}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="download"
                      stackId="1"
                      stroke="#0088FE"
                      fill="#0088FE"
                      name="Tải xuống (MB/s)"
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      stackId="1"
                      stroke="#00C49F"
                      fill="#00C49F"
                      name="Tải lên (MB/s)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Protocols Tab */}
        <TabsContent value="protocols">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân Bố Giao Thức</CardTitle>
                <CardDescription>Tỷ lệ sử dụng của các giao thức</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={formatProtocolData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={125}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {formatProtocolData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`${value} kết nối`, props.payload.name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Số Kết Nối Theo Giao Thức</CardTitle>
                <CardDescription>Tổng số kết nối cho mỗi giao thức</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={formatProtocolData()}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value} kết nối`, 'Số kết nối']} />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Số kết nối"
                      fill="#8884d8"
                    >
                      {formatProtocolData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="source">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Địa Chỉ IP Nguồn</CardTitle>
                <CardDescription>Địa chỉ IP với số lượng kết nối cao nhất</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={formatSourceData().slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 50, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="ip" />
                    <Tooltip formatter={(value, name) => [`${value}`, name === 'count' ? 'Kết nối' : 'Bytes']} />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="Số kết nối"
                      fill="#0088FE"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lưu Lượng Theo IP</CardTitle>
                <CardDescription>Dung lượng dữ liệu (MB) theo IP</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={formatSourceData().slice(0, 10).map(item => ({
                      ...item,
                      bytes: (item.bytes / (1024 * 1024)).toFixed(2) // Convert to MB
                    }))}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 50, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="ip" />
                    <Tooltip formatter={(value) => [`${value} MB`, 'Dung lượng']} />
                    <Legend />
                    <Bar
                      dataKey="bytes"
                      name="Dung lượng (MB)"
                      fill="#00C49F"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{anomalyStats.count}</div>
                <p className="text-sm text-gray-500">Tổng số xâm nhập phát hiện</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {anomalyStats.latestAnomalies[0]?.source_ip || "N/A"}
                </div>
                <p className="text-sm text-gray-500">Nguồn xâm nhập gần nhất</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-500">
                  {anomalyStats.latestAnomalies[0]?.probability ? 
                    `${(anomalyStats.latestAnomalies[0].probability * 100).toFixed(1)}%` : 
                    "N/A"}
                </div>
                <p className="text-sm text-gray-500">Độ tin cậy của phát hiện gần nhất</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Phát Hiện Xâm Nhập (IDS)</CardTitle>
                <CardDescription>Các cuộc tấn công tiềm năng được phát hiện bởi AI</CardDescription>
              </CardHeader>
              <CardContent>
                {anomalyData && anomalyData.data && anomalyData.data.length > 0 ? (
                  <div className="space-y-4">
                    {formatAnomalyData().map((anomaly, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between">
                          <div className="font-medium">{anomaly.timestamp}</div>
                          <div className={`font-bold ${anomaly.probability > 0.7 ? 'text-red-500' : anomaly.probability > 0.5 ? 'text-orange-500' : 'text-yellow-500'}`}>
                            {(anomaly.probability * 100).toFixed(1)}% 
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-500">Nguồn:</span> {anomaly.source_ip}
                            </div>
                            <div>
                              <span className="text-gray-500">Đích:</span> {anomaly.destination_ip}
                            </div>
                          </div>
                          <div className="mt-1">
                            <span className="text-gray-500">Loại:</span> {anomaly.anomaly_type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p>Không có dữ liệu xâm nhập nào được phát hiện trong khoảng thời gian này.</p>
                    <p className="text-sm text-gray-500 mt-2">Mô hình AI đang theo dõi các mẫu lưu lượng bất thường.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Mô Phỏng Kiểm Tra Xâm Nhập</CardTitle>
                <CardDescription>Tạo dữ liệu lưu lượng bất thường để kiểm tra hệ thống</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          Chú ý: Tính năng này sẽ gửi dữ liệu lưu lượng mạng giả định đến API để kiểm tra hệ thống phát hiện xâm nhập.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => apiRequest("/api/security/test-scan-detection", {
                        method: "POST",
                        data: { deviceId, type: "port_scan" }
                      })}
                    >
                      Mô Phỏng Port Scan
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => apiRequest("/api/security/test-scan-detection", {
                        method: "POST",
                        data: { deviceId, type: "dos_attack" }
                      })}
                    >
                      Mô Phỏng DoS Attack
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => apiRequest("/api/security/test-scan-detection", {
                        method: "POST",
                        data: { deviceId, type: "bruteforce" }
                      })}
                    >
                      Mô Phỏng Brute Force
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrafficVisualizations;