import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Sparkles, TrendingUp, Zap, Bot, BarChart3, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  workflow_generation: "Workflow Generation",
  prd_generation: "PRD Generation",
  vision_analysis: "Vision Analysis",
  image_upload: "Image Upload",
  project_summary: "Project Summary",
};

const FEATURE_COLORS: Record<string, string> = {
  chat: "#3b82f6",
  workflow_generation: "#22c55e",
  prd_generation: "#f59e0b",
  vision_analysis: "#8b5cf6",
  image_upload: "#ec4899",
  project_summary: "#14b8a6",
};

const MODEL_COLORS: Record<string, string> = {
  "gpt-4o": "#10b981",
  "gpt-4o-mini": "#6366f1",
  "gpt-3.5-turbo": "#f97316",
};

type TimeRange = "24h" | "7d" | "30d" | "90d";

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (range) {
    case "24h":
      start.setTime(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      start.setTime(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      start.setTime(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      start.setTime(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
  }
  
  return { start, end };
}

function formatDate(timestamp: string, bucket: string): string {
  const date = new Date(timestamp);
  if (bucket === "hour") {
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
  } else if (bucket === "week") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCard({ 
  title, 
  value, 
  subtext, 
  icon: Icon,
  tooltip
}: { 
  title: string; 
  value: string | number; 
  subtext?: string; 
  icon: any;
  tooltip?: string;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {title}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function UsageChart({ 
  data, 
  bucket,
  showBreakdown 
}: { 
  data: Array<{ timestamp: string; units: number; breakdown: Record<string, number> }>; 
  bucket: string;
  showBreakdown: boolean;
}) {
  if (showBreakdown) {
    const features = Object.keys(FEATURE_COLORS);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(v) => formatDate(v, bucket)}
            className="text-xs"
          />
          <YAxis className="text-xs" />
          <RechartsTooltip 
            content={({ active, payload, label }) => {
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
            }}
          />
          {features.map((feature) => (
            <Bar 
              key={feature} 
              dataKey={`breakdown.${feature}`} 
              stackId="a"
              fill={FEATURE_COLORS[feature]} 
              name={feature}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="timestamp" 
          tickFormatter={(v) => formatDate(v, bucket)}
          className="text-xs"
        />
        <YAxis className="text-xs" />
        <RechartsTooltip 
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-popover border rounded-lg p-3 shadow-lg">
                  <p className="font-medium">{formatDate(label, bucket)}</p>
                  <p className="text-sm text-primary">Total: {payload[0]?.value} units</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="units" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FeatureBreakdownChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value, label: FEATURE_LABELS[name] || name }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No usage data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical">
        <XAxis type="number" className="text-xs" />
        <YAxis 
          type="category" 
          dataKey="label" 
          width={120} 
          className="text-xs"
        />
        <RechartsTooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-popover border rounded-lg p-2 shadow-lg">
                  <p className="text-sm">{payload[0]?.payload.label}: {payload[0]?.value} units</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar 
          dataKey="value" 
          fill="hsl(var(--primary))"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ModelMixChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (chartData.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No usage data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={MODEL_COLORS[entry.name] || "#6b7280"} />
          ))}
        </Pie>
        <RechartsTooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const pct = ((payload[0]?.value as number) / total * 100).toFixed(1);
              return (
                <div className="bg-popover border rounded-lg p-2 shadow-lg">
                  <p className="text-sm">{payload[0]?.name}: {payload[0]?.value} units ({pct}%)</p>
                </div>
              );
            }
            return null;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EventsTable({ events, isLoading }: { events: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No usage events yet</p>;
  }

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
              <td className="py-3 px-2">
                {new Date(event.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </td>
              <td className="py-3 px-2">
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
              <td className="py-3 px-2 font-mono text-xs">{event.model}</td>
              <td className="py-3 px-2 text-right font-medium">{event.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Usage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [visionOnly, setVisionOnly] = useState(false);

  const { start, end } = getDateRange(timeRange);

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/usage/summary", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      });
      const res = await fetch(`/api/usage/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ["/api/usage/timeseries", timeRange, visionOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      });
      if (visionOnly) params.set("visionOnly", "true");
      const res = await fetch(`/api/usage/timeseries?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time series");
      return res.json();
    },
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/usage/events", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        limit: "25",
      });
      const res = await fetch(`/api/usage/events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const summary = summaryData?.summary;
  const timeSeries = timeSeriesData?.timeSeries || [];
  const bucket = timeSeriesData?.bucket || "day";
  const events = eventsData?.events || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account">
            <Button variant="ghost" size="icon" data-testid="back-button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">AI Usage</h1>
            <p className="text-muted-foreground">
              Track how KiteAI is being used across workflows, PRDs, and vision analysis.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Unlimited during Beta</span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
            AI usage is unlimited during Beta. These metrics help us improve performance and reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summaryLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-16 mt-2" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                title="Total AI Usage"
                value={summary?.totalFinalUnits || 0}
                subtext="Since first use"
                icon={Zap}
                tooltip="1 unit ≈ internal normalized token cost"
              />
              <StatCard
                title="Usage (Selected Range)"
                value={summary?.periodUnits || 0}
                subtext={`Last ${timeRange === "24h" ? "24 hours" : timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : "90 days"}`}
                icon={TrendingUp}
              />
              <StatCard
                title="Avg / Day"
                value={summary?.avgDailyUnits || 0}
                subtext="Daily average"
                icon={BarChart3}
              />
              <StatCard
                title="Top Feature"
                value={summary?.topFeature ? (FEATURE_LABELS[summary.topFeature] || summary.topFeature) : "—"}
                subtext={summary?.topFeature ? `Most used` : "No usage yet"}
                icon={Bot}
              />
            </>
          )}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>AI Usage Over Time</CardTitle>
              <div className="flex flex-wrap items-center gap-4">
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="w-[140px]" data-testid="time-range-select">
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
                  <Checkbox 
                    id="breakdown" 
                    checked={showBreakdown}
                    onCheckedChange={(v) => setShowBreakdown(v as boolean)}
                    data-testid="breakdown-checkbox"
                  />
                  <label htmlFor="breakdown" className="text-sm cursor-pointer">
                    Breakdown by feature
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="vision" 
                    checked={visionOnly}
                    onCheckedChange={(v) => setVisionOnly(v as boolean)}
                    data-testid="vision-checkbox"
                  />
                  <label htmlFor="vision" className="text-sm cursor-pointer">
                    Vision only
                  </label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {timeSeriesLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : timeSeries.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No usage data yet. Start by generating a workflow or chatting with KiteAI.
              </div>
            ) : (
              <UsageChart data={timeSeries} bucket={bucket} showBreakdown={showBreakdown} />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Feature</CardTitle>
              <CardDescription>Total units consumed per feature</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <FeatureBreakdownChart data={summary?.featureBreakdown || {}} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Model Usage Mix</CardTitle>
              <CardDescription>Distribution across AI models</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ModelMixChart data={summary?.modelBreakdown || {}} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Usage</CardTitle>
            <CardDescription>Detailed log of AI requests</CardDescription>
          </CardHeader>
          <CardContent>
            <EventsTable events={events} isLoading={eventsLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
