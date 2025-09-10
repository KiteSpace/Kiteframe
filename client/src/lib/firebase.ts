// Firebase configuration and authentication setup
// Based on firebase_barebones_javascript integration
import { initializeApp } from "firebase/app";
import { getAuth, signInWithRedirect, GoogleAuthProvider, User, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
const provider = new GoogleAuthProvider();

// Authentication functions
export function signInWithGoogle() {
  signInWithRedirect(auth, provider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Workflow data types
export interface SavedWorkflow {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Firestore workflow operations
export async function saveWorkflow(workflow: Omit<SavedWorkflow, 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to save workflows');
  }

  // Validate Firebase environment variables
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID || !import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_APP_ID) {
    throw new Error('Firebase configuration is incomplete. Please check your environment variables.');
  }

  const workflowDoc = {
    ...workflow,
    userId: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Save to user-specific collection for better security
  const userWorkflowsRef = collection(db, 'users', user.uid, 'workflows');
  const docRef = await addDoc(userWorkflowsRef, workflowDoc);
  return docRef.id;
}

export async function loadWorkflow(workflowId: string): Promise<SavedWorkflow | null> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to load workflows');
  }

  // Load from user-specific collection (no need to check ownership)
  const docRef = doc(db, 'users', user.uid, 'workflows', workflowId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      // Handle both Timestamp and Date objects
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    } as SavedWorkflow;
  }

  return null;
}

export async function getUserWorkflows(): Promise<SavedWorkflow[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to get workflows');
  }

  // Query user-specific collection
  const userWorkflowsRef = collection(db, 'users', user.uid, 'workflows');
  const querySnapshot = await getDocs(userWorkflowsRef);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Handle both Timestamp and Date objects
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    } as SavedWorkflow;
  });
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to delete workflows');
  }

  // Delete from user-specific collection
  const docRef = doc(db, 'users', user.uid, 'workflows', workflowId);
  await deleteDoc(docRef);
}

export async function updateWorkflow(workflowId: string, updates: Partial<Pick<SavedWorkflow, 'name' | 'nodes' | 'edges'>>): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated to update workflows');
  }

  // Update in user-specific collection
  const docRef = doc(db, 'users', user.uid, 'workflows', workflowId);
  await setDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}