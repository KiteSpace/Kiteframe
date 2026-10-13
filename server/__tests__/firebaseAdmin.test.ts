import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  applicationDefault: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  verifyIdToken: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  applicationDefault: sdk.applicationDefault,
  cert: sdk.cert,
  getApps: sdk.getApps,
  initializeApp: sdk.initializeApp,
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: sdk.getAuth }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('DRIFTLINE_FIREBASE_PROJECT', '');
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '{"project_id":"test-project"}');
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '');
  sdk.getApps.mockReturnValue([]);
  sdk.cert.mockReturnValue({ source: 'certificate' });
  sdk.applicationDefault.mockReturnValue({ source: 'application-default' });
  sdk.initializeApp.mockReturnValue({ name: '[DEFAULT]' });
  sdk.getAuth.mockReturnValue({ verifyIdToken: sdk.verifyIdToken });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Firebase Admin modular SDK compatibility', () => {
  it('initializes once with certificate credentials', async () => {
    const admin = await import('../firebaseAdmin');
    const app = admin.initializeFirebaseAdmin();
    expect(admin.initializeFirebaseAdmin()).toBe(app);
    expect(sdk.cert).toHaveBeenCalledWith({ project_id: 'test-project' });
    expect(sdk.initializeApp).toHaveBeenCalledExactlyOnceWith({
      projectId: 'test-project',
      credential: { source: 'certificate' },
    });
    expect(admin.isAdminSdkAvailable()).toBe(true);
  });

  it('reuses an existing application', async () => {
    const existing = { name: '[DEFAULT]' };
    sdk.getApps.mockReturnValue([existing]);
    const admin = await import('../firebaseAdmin');
    expect(admin.initializeFirebaseAdmin()).toBe(existing);
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it('supports application-default credentials', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/test-only/credentials.json');
    const admin = await import('../firebaseAdmin');
    admin.initializeFirebaseAdmin();
    expect(sdk.applicationDefault).toHaveBeenCalledOnce();
    expect(sdk.cert).not.toHaveBeenCalled();
  });

  it('keeps revocation checking enabled on the initialized app', async () => {
    sdk.verifyIdToken.mockResolvedValue({
      uid: 'test-user', email_verified: true, email: 'test@example.invalid',
    });
    const admin = await import('../firebaseAdmin');
    expect(await admin.verifyFirebaseIdToken('test-token')).toMatchObject({
      uid: 'test-user', email_verified: true,
    });
    expect(sdk.getAuth).toHaveBeenCalledWith(admin.getFirebaseAdmin());
    expect(sdk.verifyIdToken).toHaveBeenCalledExactlyOnceWith('test-token', true);
  });

  it('fails closed without credentials', async () => {
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT_KEY', '');
    const admin = await import('../firebaseAdmin');
    expect(await admin.verifyFirebaseIdToken('test-token')).toBeNull();
    expect(admin.isAdminSdkAvailable()).toBe(false);
    expect(sdk.verifyIdToken).not.toHaveBeenCalled();
  });

  it('fails closed when token verification rejects', async () => {
    sdk.verifyIdToken.mockRejectedValue(new Error('Token revoked'));
    const admin = await import('../firebaseAdmin');
    expect(await admin.verifyFirebaseIdToken('test-token')).toBeNull();
  });
});
