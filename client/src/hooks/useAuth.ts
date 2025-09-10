import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, signInWithGoogle, signOutUser } from '../lib/firebase';
import { getRedirectResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔐 useAuth: Component mounted, checking auth state...');
    
    // Check for redirect result when component mounts
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log('✅ User authenticated from redirect:', result.user.displayName || result.user.email);
        } else {
          console.log('ℹ️ No redirect result found');
        }
      })
      .catch((error) => {
        console.error('❌ Auth redirect error:', error);
        setError(error.message);
      });

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChange((user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.displayName || user.email}` : 'No user');
      setUser(user);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      console.log('🔑 Starting Google sign-in with redirect...');
      await signInWithGoogle(); // This will redirect to Google
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      setError(error.message);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await signOutUser();
    } catch (error: any) {
      setError(error.message);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };
}