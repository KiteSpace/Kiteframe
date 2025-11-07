import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Activity, Globe, Key, TrendingUp } from 'lucide-react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

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

export default function AdminAnalytics({ authHeader }: { authHeader: string }) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: overviewData } = useQuery({
    queryKey: ['/internal/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/internal/analytics/overview', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      const json = await response.json();
      return json.data as OverviewStats;
    },
    refetchInterval: 30000,
  });

  const { data: geoData } = useQuery({
    queryKey: ['/internal/analytics/geographic'],
    queryFn: async () => {
      const response = await fetch('/internal/analytics/geographic', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch geographic data');
      const json = await response.json();
      return json.data as GeoActivity[];
    },
    refetchInterval: 30000,
  });

  const { data: codeUsageData } = useQuery({
    queryKey: ['/internal/analytics/code-usage'],
    queryFn: async () => {
      const response = await fetch('/internal/analytics/code-usage', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch code usage');
      const json = await response.json();
      return json.data as CodeUsage[];
    },
    refetchInterval: 30000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['/internal/analytics/alerts'],
    queryFn: async () => {
      const response = await fetch('/internal/analytics/alerts', {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const json = await response.json();
      return json.data as CreditAlert[];
    },
    refetchInterval: 30000,
  });

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <TrendingUp className="w-4 h-4 mr-2" />
              Overview
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
