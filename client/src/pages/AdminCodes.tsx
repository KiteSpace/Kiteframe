import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Key, Shield } from 'lucide-react';

interface UnlockCode {
  id: string;
  code: string;
  creditsToAdd: number;
  grantsUnlimited: boolean;
  notes: string | null;
  isUsed: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

export default function AdminCodes() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authHeader, setAuthHeader] = useState('');
  const [grantsUnlimited, setGrantsUnlimited] = useState(false);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const { data: codesData, isLoading } = useQuery({
    queryKey: ['/internal/ops-codes/list'],
    queryFn: async () => {
      const response = await fetch('/internal/ops-codes/list', {
        headers: {
          'Authorization': authHeader,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch codes');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (data: { grantsUnlimited: boolean; notes: string }) => {
      const response = await fetch('/internal/ops-codes/generate', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate code');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/internal/ops-codes/list'] });
      toast({
        title: 'Code Generated',
        description: `Code: ${data.code.code}`,
      });
      setNotes('');
      setGrantsUnlimited(false);
      
      navigator.clipboard.writeText(data.code.code);
      toast({
        title: 'Copied to clipboard',
        description: `Code ${data.code.code} copied to clipboard`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate code',
        variant: 'destructive',
      });
    },
  });

  const handleLogin = async () => {
    const auth = btoa(`${username}:${password}`);
    const header = `Basic ${auth}`;
    
    try {
      const response = await fetch('/internal/ops-codes/list', {
        headers: {
          'Authorization': header,
        },
      });
      
      if (response.ok) {
        setAuthHeader(header);
        setIsAuthenticated(true);
        toast({
          title: 'Login Successful',
          description: 'Welcome to admin panel',
        });
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid username or password',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Login Failed',
        description: 'Unable to connect to server',
        variant: 'destructive',
      });
    }
  };

  const handleGenerate = () => {
    generateCodeMutation.mutate({
      grantsUnlimited,
      notes: notes.trim() || '',
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copied',
      description: `Code ${code} copied to clipboard`,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Admin Authentication
            </CardTitle>
            <CardDescription>
              Enter admin credentials to access code management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                data-testid="input-admin-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                data-testid="input-admin-password"
              />
            </div>
            <Button 
              onClick={handleLogin} 
              className="w-full"
              disabled={!username || !password}
              data-testid="button-admin-login"
            >
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8" />
            Unlock Code Management
          </h1>
          <Button
            variant="outline"
            onClick={() => {
              setIsAuthenticated(false);
              setAuthHeader('');
            }}
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate New Code</CardTitle>
            <CardDescription>
              Create a new unlock code for users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="unlimited"
                checked={grantsUnlimited}
                onCheckedChange={(checked) => setGrantsUnlimited(checked as boolean)}
                data-testid="checkbox-unlimited"
              />
              <Label htmlFor="unlimited" className="cursor-pointer">
                Grant Unlimited Credits (for trusted users)
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., For VIP user John Doe"
                data-testid="input-code-notes"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generateCodeMutation.isPending}
              data-testid="button-generate-code"
            >
              {generateCodeMutation.isPending ? 'Generating...' : 'Generate Code'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Unlock Codes</CardTitle>
            <CardDescription>
              {codesData?.codes?.length || 0} codes generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-2">
                {codesData?.codes?.map((code: UnlockCode) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`code-item-${code.id}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-lg">
                          {code.code}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyCode(code.code)}
                          data-testid={`button-copy-${code.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {code.grantsUnlimited ? (
                          <Badge variant="default" data-testid={`badge-unlimited-${code.id}`}>
                            Unlimited Credits
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`badge-credits-${code.id}`}>
                            {code.creditsToAdd} Credits
                          </Badge>
                        )}
                        {code.isUsed ? (
                          <Badge variant="destructive" data-testid={`badge-used-${code.id}`}>
                            Used by {code.usedBy}
                          </Badge>
                        ) : (
                          <Badge variant="outline" data-testid={`badge-available-${code.id}`}>
                            Available
                          </Badge>
                        )}
                      </div>
                      {code.notes && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-notes-${code.id}`}>
                          {code.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground" data-testid={`text-created-${code.id}`}>
                        Created: {new Date(code.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
