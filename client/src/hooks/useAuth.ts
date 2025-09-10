import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, signInWithGoogle, signOutUser } from '../lib/firebase';
import { handleAuthRedirect } from '../lib/authRedirect';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle redirect result on page load
    handleAuthRedirect()
      .then((result) => {
        if (result?.user) {
          console.log('User authenticated from redirect');
        }
      })
      .catch((error) => {
        setError(error.message);
      });

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (error: any) {
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