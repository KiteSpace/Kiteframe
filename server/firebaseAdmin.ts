import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;
let isInitialized = false;
let adminSdkAvailable = false;
let initializationError: string | null = null;

export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export function initializeFirebaseAdmin(): admin.app.App | null {
  if (isInitialized) {
    return firebaseApp;
  }
  
  isInitialized = true;

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.DRIFTLINE_FIREBASE_PROJECT;
  
  if (!projectId) {
    initializationError = 'Firebase project ID not configured';
    console.warn('Firebase Admin: No project ID found, Firebase auth sync will be disabled');
    return null;
  }

  // Check if we have service account credentials
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const hasApplicationDefault = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!serviceAccountKey && !hasApplicationDefault) {
    initializationError = 'Firebase service account credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY secret for secure token verification.';
    console.warn('Firebase Admin: No service account credentials found. Cloud project sync requires FIREBASE_SERVICE_ACCOUNT_KEY.');
    return null;
  }

  try {
    // Check if already initialized (e.g., in test environments)
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0];
      adminSdkAvailable = true;
      console.log('Firebase Admin already initialized, reusing existing app');
      return firebaseApp;
    }
    
    if (serviceAccountKey) {
      firebaseApp = admin.initializeApp({
        projectId,
        credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
      });
    } else {
      firebaseApp = admin.initializeApp({
        projectId,
        credential: admin.credential.applicationDefault(),
      });
    }
    
    adminSdkAvailable = true;
    initializationError = null;
    console.log('Firebase Admin initialized with credentials for project:', projectId);
    return firebaseApp;
  } catch (error) {
    initializationError = `Failed to initialize Firebase Admin: ${error}`;
    console.error('Failed to initialize Firebase Admin:', error);
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedFirebaseToken | null> {
  initializeFirebaseAdmin();
  
  if (!adminSdkAvailable || !firebaseApp) {
    console.error('Firebase Admin SDK not available for token verification');
    return null;
  }

  try {
    // Verify token with revocation check for security
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      email_verified: decodedToken.email_verified,
    };
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}

export function getFirebaseAdmin(): admin.app.App | null {
  return firebaseApp;
}

export function isAdminSdkAvailable(): boolean {
  return adminSdkAvailable;
}

export function getInitializationError(): string | null {
  return initializationError;
}
