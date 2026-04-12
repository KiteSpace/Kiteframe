import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, Activity, Globe, Key, TrendingUp, Zap, Bot, BarChart3, Info, Sparkles, Search, ChevronLeft, ChevronRight, ClipboardList, Eye, Monitor, Smartphone, Tablet } from 'lucide-react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface OverviewStats {
  totalAIRequests: number;
  totalCreditAlerts: number;
  totalCountries: number;
}

interface GeoActivity {
  country: string;
  totalRequests: number;
  aiRequests: number;
  uniqueUsers: number;
  lastActivity: string;
}

interface CodeUsage {
  code: string;
  totalRedemptions: number;
  countries: string[];
  lastUsed: string;
}

interface CreditAlert {
  id: string;
  userIdentifier: string;
  country: string | null;
  createdAt: string;
}

// AI Usage constants — feature names must match AiFeature / CreditCostType
const FEATURE_LABELS: Record<string, string> = {
  general_chat: "General Chat",
  vision_ingestion: "Vision Ingestion",
  workflow_reasoning: "Workflow Reasoning",
  workflow_experiments: "Workflow Experiments",
  prd_generation: "PRD Generation",
};

const FEATURE_COLORS: Record<string, string> = {
  general_chat: "#3b82f6",
  vision_ingestion: "#8b5cf6",
  workflow_reasoning: "#22c55e",
  workflow_experiments: "#14b8a6",
  prd_generation: "#f59e0b",
};

const MODEL_COLORS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "#10b981",
  "claude-sonnet-4-5-20250929": "#6366f1",
  "claude-opus-4-5-20251101": "#f97316",
};

type TimeRange = "24h" | "7d" | "30d" | "90d";

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case "24h": start.setTime(end.getTime() - 24 * 60 * 60 * 1000); break;
    case "7d": start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case "30d": start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case "90d": start.setTime(end.getTime() - 90 * 24 * 60 * 60 * 1000); break;
  }
  return { start, end };
}

function formatDate(timestamp: string, bucket: string): string {
  const date = new Date(timestamp);
  if (bucket === "hour") return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function UsageStatCard({ title, value, subtext, icon: Icon, tooltip }: { title: string; value: string | number; subtext?: string; icon: any; tooltip?: string }) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {title}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground/60" /></TooltipTrigger>
              <TooltipContent><p className="max-w-xs text-xs">{tooltip}</p></TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function UsageLineChart({ data, bucket, showBreakdown }: { data: any[]; bucket: string; showBreakdown: boolean }) {
  if (showBreakdown) {
    const features = Object.keys(FEATURE_COLORS);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="timestamp" tickFormatter={(v) => formatDate(v, bucket)} className="text-xs" />
          <YAxis className="text-xs" />
          <RechartsTooltip content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-popover border rounded-lg p-3 shadow-lg">
                  <p className="font-medium mb-2">{formatDate(label, bucket)}</p>
                  {payload.map((entry: any) => (
                    <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
                      {FEATURE_LABELS[entry.name] || entry.name}: {entry.value} units
                    </p>
                  ))}
                </div>
              );
            }
            return null;
          }} />
          {features.map((feature) => (
            <Bar key={feature} dataKey={`breakdown.${feature}`} stackId="a" fill={FEATURE_COLORS[feature]} name={feature} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="timestamp" tickFormatter={(v) => formatDate(v, bucket)} className="text-xs" />
        <YAxis className="text-xs" />
        <RechartsTooltip content={({ active, payload, label }) => {
          if (active && payload && payload.length) {
            return (
              <div className="bg-popover border rounded-lg p-3 shadow-lg">
                <p className="font-medium">{formatDate(label, bucket)}</p>
                <p className="text-sm text-primary">Total: {payload[0]?.value} units</p>
              </div>
            );
          }
          return null;
        }} />
        <Line type="monotone" dataKey="units" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FeatureBreakdownChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value, label: FEATURE_LABELS[name] || name })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  if (chartData.length === 0) return <p className="text-muted-foreground text-sm text-center py-8">No usage data</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical">
        <XAxis type="number" className="text-xs" />
        <YAxis type="category" dataKey="label" width={120} className="text-xs" />
        <RechartsTooltip content={({ active, payload }) => {
          if (active && payload && payload.length) return <div className="bg-popover border rounded-lg p-2 shadow-lg"><p className="text-sm">{payload[0]?.payload.label}: {payload[0]?.value} units</p></div>;
          return null;
        }} />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ModelMixChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  if (chartData.length === 0) return <p className="text-muted-foreground text-sm text-center py-8">No usage data</p>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
          {chartData.map((entry) => <Cell key={entry.name} fill={MODEL_COLORS[entry.name] || "#6b7280"} />)}
        </Pie>
        <RechartsTooltip content={({ active, payload }) => {
          if (active && payload && payload.length) {
            const pct = ((payload[0]?.value as number) / total * 100).toFixed(1);
            return <div className="bg-popover border rounded-lg p-2 shadow-lg"><p className="text-sm">{payload[0]?.name}: {payload[0]?.value} units ({pct}%)</p></div>;
          }
          return null;
        }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function UsageEventsTable({ events, isLoading }: { events: any[]; isLoading: boolean }) {
  if (isLoading) return <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (events.length === 0) return <p className="text-muted-foreground text-sm text-center py-8">No usage events yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="usage-events-table">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Feature</th>
            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Model</th>
            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Units</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event: any) => (
            <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-3 px-2">{new Date(event.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
              <td className="py-3 px-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${FEATURE_COLORS[event.feature]}20`, color: FEATURE_COLORS[event.feature] }}>
                  {FEATURE_LABELS[event.feature] || event.feature}
                </span>
              </td>
              <td className="py-3 px-2 font-mono text-xs">{event.model}</td>
              <td className="py-3 px-2 text-right font-medium">{event.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAnalytics({ authHeader }: { authHeader: string }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [usageTimeRange, setUsageTimeRange] = useState<TimeRange>("30d");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [visionOnly, setVisionOnly] = useState(false);
  
  // Activity log state
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const activityLimit = 50;

  const { start: usageStart, end: usageEnd } = getDateRange(usageTimeRange);

  const { data: overviewData } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/internal/x9k7m2p4/analytics/overview', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      const json = await response.json();
      return json.data as OverviewStats;
    },
    refetchInterval: 30000,
  });

  const { data: geoData } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/geographic'],
    queryFn: async () => {
      const response = await fetch('/internal/x9k7m2p4/analytics/geographic', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch geographic data');
      const json = await response.json();
      return json.data as GeoActivity[];
    },
    refetchInterval: 30000,
  });

  const { data: codeUsageData } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/code-usage'],
    queryFn: async () => {
      const response = await fetch('/internal/x9k7m2p4/analytics/code-usage', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch code usage');
      const json = await response.json();
      return json.data as CodeUsage[];
    },
    refetchInterval: 30000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/alerts'],
    queryFn: async () => {
      const response = await fetch('/internal/x9k7m2p4/analytics/alerts', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const json = await response.json();
      return json.data as CreditAlert[];
    },
    refetchInterval: 30000,
  });

  // AI Usage queries (internal admin endpoints)
  const { data: usageSummaryData, isLoading: usageSummaryLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/ai-usage/summary', usageTimeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: usageStart.toISOString(),
        periodEnd: usageEnd.toISOString(),
      });
      const response = await fetch(`/internal/x9k7m2p4/analytics/ai-usage/summary?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch usage summary');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: usageTimeSeriesData, isLoading: usageTimeSeriesLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/ai-usage/timeseries', usageTimeRange, visionOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: usageStart.toISOString(),
        periodEnd: usageEnd.toISOString(),
      });
      if (visionOnly) params.set("visionOnly", "true");
      const response = await fetch(`/internal/x9k7m2p4/analytics/ai-usage/timeseries?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch usage time series');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: usageEventsData, isLoading: usageEventsLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/ai-usage/events', usageTimeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: usageStart.toISOString(),
        periodEnd: usageEnd.toISOString(),
        limit: "25",
      });
      const response = await fetch(`/internal/x9k7m2p4/analytics/ai-usage/events?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch usage events');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const usageSummary = usageSummaryData?.summary;
  const usageTimeSeries = usageTimeSeriesData?.timeSeries || [];
  const usageBucket = usageTimeSeriesData?.bucket || "day";
  const usageEvents = usageEventsData?.events || [];

  // Activity log query (all AI usage events with pagination and search)
  const { data: activityLogData, isLoading: activityLogLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/activity-log', activityPage, activitySearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: activityPage.toString(),
        limit: activityLimit.toString(),
      });
      if (activitySearch) params.set("search", activitySearch);
      const response = await fetch(`/internal/x9k7m2p4/analytics/activity-log?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch activity log');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const activityEvents = activityLogData?.events || [];
  const activityTotal = activityLogData?.total || 0;
  const activityTotalPages = Math.ceil(activityTotal / activityLimit);

  // Page view analytics queries
  const { data: pageViewsSummaryData, isLoading: pageViewsLoading } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/pageviews/summary', usageTimeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: usageStart.toISOString(),
        periodEnd: usageEnd.toISOString(),
      });
      const response = await fetch(`/internal/x9k7m2p4/analytics/pageviews/summary?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch page views summary');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: pageViewsTimeSeriesData } = useQuery({
    queryKey: ['/internal/x9k7m2p4/analytics/pageviews/timeseries', usageTimeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: usageStart.toISOString(),
        periodEnd: usageEnd.toISOString(),
      });
      const response = await fetch(`/internal/x9k7m2p4/analytics/pageviews/timeseries?${params}`, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch page views time series');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const pageViewsSummary = pageViewsSummaryData?.summary;
  const pageViewsTimeSeries = pageViewsTimeSeriesData?.timeSeries || [];
  const pageViewsBucket = pageViewsTimeSeriesData?.bucket || 'day';

  const getCountryColor = (countryCode: string) => {
    const activity = geoData?.find(d => d.country === countryCode);
    if (!activity) return '#E5E7EB';
    
    const requests = activity.aiRequests;
    if (requests === 0) return '#E5E7EB';
    if (requests < 10) return '#86EFAC';
    if (requests < 50) return '#FDE047';
    return '#F87171';
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Admin Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor usage, activity, and system health
            </p>
          </div>
          {alertsData && alertsData.length > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {alertsData.length} Alerts
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="traffic" data-testid="tab-traffic">
              <Eye className="w-4 h-4 mr-2" />
              Site Traffic
            </TabsTrigger>
            <TabsTrigger value="ai-usage" data-testid="tab-ai-usage">
              <Zap className="w-4 h-4 mr-2" />
              AI Usage
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <ClipboardList className="w-4 h-4 mr-2" />
              Activity Log
            </TabsTrigger>
            <TabsTrigger value="map" data-testid="tab-map">
              <Globe className="w-4 h-4 mr-2" />
              Geographic Map
            </TabsTrigger>
            <TabsTrigger value="codes" data-testid="tab-codes">
              <Key className="w-4 h-4 mr-2" />
              Code Usage
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertCircle className="w-4 h-4 mr-2" />
              Alerts {alertsData && alertsData.length > 0 && `(${alertsData.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card data-testid="card-ai-requests">
                <CardHeader>
                  <CardTitle>Total AI Requests</CardTitle>
                  <CardDescription>Lifetime requests processed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {overviewData?.totalAIRequests?.toLocaleString() ?? '0'}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-countries">
                <CardHeader>
                  <CardTitle>Countries Served</CardTitle>
                  <CardDescription>Unique countries accessing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {overviewData?.totalCountries ?? 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-credit-alerts">
                <CardHeader>
                  <CardTitle>Credit Limit Hits</CardTitle>
                  <CardDescription>Users who ran out of credits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-destructive">
                    {overviewData?.totalCreditAlerts ?? 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-top-countries">
              <CardHeader>
                <CardTitle>Top Countries by Activity</CardTitle>
                <CardDescription>Countries with highest AI request volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(geoData ?? [])
                    .slice(0, 10)
                    .sort((a, b) => b.aiRequests - a.aiRequests)
                    .map((geo) => (
                      <div key={geo.country} className="flex items-center justify-between p-2 border rounded" data-testid={`country-${geo.country}`}>
                        <div>
                          <span className="font-semibold">{geo.country}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {geo.uniqueUsers} users
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{geo.aiRequests} AI requests</div>
                          <div className="text-sm text-muted-foreground">
                            Last: {geo.lastActivity ? new Date(geo.lastActivity).toLocaleDateString() : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  {(!geoData || geoData.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No geographic data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Site Traffic Tab */}
          <TabsContent value="traffic" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Site Traffic Analytics</h2>
              <Select value={usageTimeRange} onValueChange={(v: TimeRange) => setUsageTimeRange(v)}>
                <SelectTrigger className="w-32" data-testid="traffic-time-range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-total-views">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Page Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pageViewsSummary?.totalViews?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-unique-visitors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Unique Visitors</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pageViewsSummary?.uniqueVisitors?.toLocaleString() || 0}</div>
                </CardContent>
              </Card>
              <Card data-testid="card-bounce-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Views per Visitor</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {pageViewsSummary?.uniqueVisitors ? (pageViewsSummary.totalViews / pageViewsSummary.uniqueVisitors).toFixed(1) : '0'}
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-countries">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Countries</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pageViewsSummary?.countryBreakdown?.length || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Traffic Time Series Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Over Time</CardTitle>
                <CardDescription>Page views and unique visitors</CardDescription>
              </CardHeader>
              <CardContent>
                {pageViewsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : pageViewsTimeSeries.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No traffic data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={pageViewsTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(v) => formatDate(v, pageViewsBucket)} 
                        className="text-xs" 
                      />
                      <YAxis className="text-xs" />
                      <RechartsTooltip content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium mb-1">{formatDate(label, pageViewsBucket)}</p>
                              <p className="text-sm text-blue-500">Views: {payload[0]?.value}</p>
                              <p className="text-sm text-green-500">Visitors: {payload[1]?.value}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} name="Views" />
                      <Line type="monotone" dataKey="uniqueVisitors" stroke="#22c55e" strokeWidth={2} dot={false} name="Visitors" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Top Pages & Referrers */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Pages</CardTitle>
                  <CardDescription>Most visited routes</CardDescription>
                </CardHeader>
                <CardContent>
                  {pageViewsLoading ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : !pageViewsSummary?.topPages?.length ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {pageViewsSummary.topPages.map((page: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm font-mono truncate max-w-[200px]">{page.route}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{page.views} views</span>
                            <span className="text-muted-foreground">{page.uniqueVisitors} visitors</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Referrers</CardTitle>
                  <CardDescription>Where traffic comes from</CardDescription>
                </CardHeader>
                <CardContent>
                  {pageViewsLoading ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : !pageViewsSummary?.topReferrers?.length ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No referrer data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {pageViewsSummary.topReferrers.map((ref: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm truncate max-w-[200px]">{ref.domain || 'Direct'}</span>
                          <span className="text-sm text-muted-foreground">{ref.views} views</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Device & Country Breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Devices</CardTitle>
                  <CardDescription>Traffic by device type</CardDescription>
                </CardHeader>
                <CardContent>
                  {pageViewsLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : !pageViewsSummary?.deviceBreakdown?.length ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {pageViewsSummary.deviceBreakdown.map((device: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {device.deviceType === 'desktop' && <Monitor className="h-4 w-4 text-muted-foreground" />}
                            {device.deviceType === 'mobile' && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                            {device.deviceType === 'tablet' && <Tablet className="h-4 w-4 text-muted-foreground" />}
                            <span className="text-sm capitalize">{device.deviceType}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{device.views} views</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Countries</CardTitle>
                  <CardDescription>Traffic by country</CardDescription>
                </CardHeader>
                <CardContent>
                  {pageViewsLoading ? (
                    <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                  ) : !pageViewsSummary?.countryBreakdown?.length ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {pageViewsSummary.countryBreakdown.slice(0, 10).map((country: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm">{country.country || 'Unknown'}</span>
                          <span className="text-sm text-muted-foreground">{country.views} views</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-usage" className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Beta: Tracking Only</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                AI usage is unlimited during Beta. These metrics are for monitoring and optimization purposes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {usageSummaryLoading ? (
                [...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                    <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-16 mt-2" /></CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <UsageStatCard title="Total AI Units" value={usageSummary?.totalFinalUnits || 0} subtext="All users combined" icon={Zap} tooltip="1 unit ≈ normalized token cost" />
                  <UsageStatCard title="Period Usage" value={usageSummary?.periodUnits || 0} subtext={`Last ${usageTimeRange === "24h" ? "24 hours" : usageTimeRange === "7d" ? "7 days" : usageTimeRange === "30d" ? "30 days" : "90 days"}`} icon={TrendingUp} />
                  <UsageStatCard title="Avg / Day" value={usageSummary?.avgDailyUnits || 0} subtext="System-wide" icon={BarChart3} />
                  <UsageStatCard title="Top Feature" value={usageSummary?.topFeature ? (FEATURE_LABELS[usageSummary.topFeature] || usageSummary.topFeature) : "—"} subtext={usageSummary?.topFeature ? "Most used" : "No usage yet"} icon={Bot} />
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle>AI Usage Over Time</CardTitle>
                  <div className="flex flex-wrap items-center gap-4">
                    <Select value={usageTimeRange} onValueChange={(v) => setUsageTimeRange(v as TimeRange)}>
                      <SelectTrigger className="w-[140px]" data-testid="usage-time-range-select">
                        <SelectValue placeholder="Time range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox id="admin-breakdown" checked={showBreakdown} onCheckedChange={(v) => setShowBreakdown(v as boolean)} data-testid="admin-breakdown-checkbox" />
                      <label htmlFor="admin-breakdown" className="text-sm cursor-pointer">Breakdown</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="admin-vision" checked={visionOnly} onCheckedChange={(v) => setVisionOnly(v as boolean)} data-testid="admin-vision-checkbox" />
                      <label htmlFor="admin-vision" className="text-sm cursor-pointer">Vision only</label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {usageTimeSeriesLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : usageTimeSeries.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No usage data yet.
                  </div>
                ) : (
                  <UsageLineChart data={usageTimeSeries} bucket={usageBucket} showBreakdown={showBreakdown} />
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Usage by Feature</CardTitle>
                  <CardDescription>Total units consumed per feature</CardDescription>
                </CardHeader>
                <CardContent>
                  {usageSummaryLoading ? <Skeleton className="h-[200px] w-full" /> : <FeatureBreakdownChart data={usageSummary?.featureBreakdown || {}} />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Model Usage Mix</CardTitle>
                  <CardDescription>Distribution across AI models</CardDescription>
                </CardHeader>
                <CardContent>
                  {usageSummaryLoading ? <Skeleton className="h-[200px] w-full" /> : <ModelMixChart data={usageSummary?.modelBreakdown || {}} />}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Usage Events</CardTitle>
                <CardDescription>Latest AI requests across all users</CardDescription>
              </CardHeader>
              <CardContent>
                <UsageEventsTable events={usageEvents} isLoading={usageEventsLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card data-testid="card-activity-log">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Activity Log
                </CardTitle>
                <CardDescription>
                  All AI usage events with searchable user profiles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user ID, email, feature, or model..."
                      value={activitySearch}
                      onChange={(e) => {
                        setActivitySearch(e.target.value);
                        setActivityPage(1);
                      }}
                      className="pl-10"
                      data-testid="input-activity-search"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activityTotal} total events
                  </div>
                </div>

                {activityLogLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : activityEvents.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    {activitySearch ? 'No events match your search.' : 'No activity events recorded yet.'}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm" data-testid="activity-log-table">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feature</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityEvents.map((event: any) => (
                          <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`activity-row-${event.id}`}>
                            <td className="py-3 px-4 text-muted-foreground">
                              {new Date(event.createdAt).toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="py-3 px-4">
                              {event.userId ? (
                                <Link href={`/internal/x9k7m2p4/users/${event.userId}`}>
                                  <span className="text-primary hover:underline cursor-pointer font-medium">
                                    {event.userEmail || event.userId.slice(0, 8) + '...'}
                                  </span>
                                </Link>
                              ) : (
                                <span className="text-muted-foreground font-mono text-xs">
                                  {event.userIdentifier?.slice(0, 12) || 'anonymous'}...
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span 
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ 
                                  backgroundColor: `${FEATURE_COLORS[event.feature]}20`, 
                                  color: FEATURE_COLORS[event.feature] 
                                }}
                              >
                                {FEATURE_LABELS[event.feature] || event.feature}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">{event.model}</td>
                            <td className="py-3 px-4 text-right font-medium">{event.units}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activityTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-muted-foreground">
                      Page {activityPage} of {activityTotalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                        disabled={activityPage <= 1 || activityLogLoading}
                        data-testid="button-activity-prev"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActivityPage(p => Math.min(activityTotalPages, p + 1))}
                        disabled={activityPage >= activityTotalPages || activityLogLoading}
                        data-testid="button-activity-next"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card data-testid="card-world-map">
              <CardHeader>
                <CardTitle>Global Activity Heatmap</CardTitle>
                <CardDescription>
                  Geographic distribution of AI requests
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E5E7EB' }}></div>
                      <span>No Activity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#86EFAC' }}></div>
                      <span>Low (1-9)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FDE047' }}></div>
                      <span>Medium (10-49)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F87171' }}></div>
                      <span>High (50+)</span>
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ComposableMap projection="geoMercator" data-testid="world-map">
                  <Geographies geography={geoUrl}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const countryCode = geo.properties.ISO_A2;
                        const activity = geoData?.find(d => d.country === countryCode);
                        
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getCountryColor(countryCode)}
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: 'none' },
                              hover: { outline: 'none', fill: '#6366F1' },
                              pressed: { outline: 'none' },
                            }}
                            title={activity ? `${countryCode}: ${activity.aiRequests} requests` : countryCode}
                            data-testid={`map-country-${countryCode}`}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="codes" className="space-y-4">
            <Card data-testid="card-code-usage">
              <CardHeader>
                <CardTitle>Unlock Code Usage</CardTitle>
                <CardDescription>Redemption statistics per code</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(codeUsageData ?? []).map((usage) => (
                    <div key={usage.code} className="flex items-center justify-between p-3 border rounded" data-testid={`code-usage-${usage.code}`}>
                      <div>
                        <code className="font-mono font-bold">{usage.code}</code>
                        <div className="text-sm text-muted-foreground mt-1">
                          Used in: {usage.countries?.filter(c => c).join(', ') || 'Unknown'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{usage.totalRedemptions} redemptions</div>
                        <div className="text-sm text-muted-foreground">
                          Last: {usage.lastUsed ? new Date(usage.lastUsed).toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!codeUsageData || codeUsageData.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No codes have been redeemed yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {alertsData && alertsData.length > 0 ? (
              <Alert variant="destructive" data-testid="alert-credit-limits">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Credit Limit Alerts</AlertTitle>
                <AlertDescription>
                  {alertsData.length} users have hit their credit limits recently
                </AlertDescription>
              </Alert>
            ) : (
              <Alert data-testid="alert-no-alerts">
                <Activity className="h-4 w-4" />
                <AlertTitle>All Clear</AlertTitle>
                <AlertDescription>
                  No credit limit alerts at this time
                </AlertDescription>
              </Alert>
            )}

            <Card data-testid="card-recent-alerts">
              <CardHeader>
                <CardTitle>Recent Credit Limit Hits</CardTitle>
                <CardDescription>Last 50 users who ran out of credits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(alertsData ?? []).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded" data-testid={`alert-${alert.id}`}>
                      <div>
                        <div className="font-mono text-sm">{alert.userIdentifier}</div>
                        <div className="text-sm text-muted-foreground">
                          {alert.country || 'Unknown location'}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '—'}
                      </div>
                    </div>
                  ))}
                  {(!alertsData || alertsData.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No credit alerts recorded
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
