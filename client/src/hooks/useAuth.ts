import { useState, useEffect } from 'react';
import { User, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { onAuthStateChange, signInWithGooglePopup, signInWithGoogleRedirect, signOutUser } from '../lib/firebase';
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
          
          // Extract credential and broadcast to iframe (if this is external browser tab)
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.idToken && credential?.accessToken) {
            console.log('📡 Broadcasting auth credential to iframe...');
            const payload = {
              type: 'FIREBASE_AUTH_CREDENTIAL',
              idToken: credential.idToken,
              accessToken: credential.accessToken
            };
            
            try {
              new BroadcastChannel('firebase-auth-sync').postMessage(payload);
            } catch (e) {
              console.log('⚠️ BroadcastChannel not available, trying postMessage fallback');
              // Fallback: try postMessage if BroadcastChannel not supported
              if (window.opener) {
                window.opener.postMessage(payload, window.location.origin);
              }
            }
          }
        } else {
          console.log('ℹ️ No redirect result found');
        }
      })
      .catch((error) => {
        console.error('❌ Auth redirect error:', error);
        setError(error.message);
      });

    // Listen for auth credentials from external browser tab (if this is iframe)
    const broadcastChannel = new BroadcastChannel('firebase-auth-sync');
    broadcastChannel.onmessage = async (event) => {
      if (event.data?.type === 'FIREBASE_AUTH_CREDENTIAL') {
        console.log('📡 Received auth credential from external tab, signing in...');
        try {
          const { idToken, accessToken } = event.data;
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          await signInWithCredential(auth, credential);
          console.log('✅ Successfully signed in via credential sync!');
        } catch (error) {
          console.error('❌ Failed to sign in with credential:', error);
          setError('Failed to sync authentication from external browser');
        }
      } else if (event.data?.type === 'FIREBASE_AUTH_SIGNOUT') {
        console.log('📡 Received sign out signal, signing out...');
        // Don't call our signOut function to avoid infinite loop
        await signOutUser();
        window.location.reload();
      }
    };

    // Fallback: listen for postMessage (same origin check)
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'FIREBASE_AUTH_CREDENTIAL') {
        console.log('📡 Received auth credential via postMessage, signing in...');
        try {
          const { idToken, accessToken } = event.data;
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          await signInWithCredential(auth, credential);
          console.log('✅ Successfully signed in via postMessage credential sync!');
        } catch (error) {
          console.error('❌ Failed to sign in with postMessage credential:', error);
          setError('Failed to sync authentication from external browser');
        }
      } else if (event.data?.type === 'FIREBASE_AUTH_SIGNOUT') {
        console.log('📡 Received sign out signal via postMessage, signing out...');
        // Don't call our signOut function to avoid infinite loop
        await signOutUser();
        window.location.reload();
      }
    };

    window.addEventListener('message', handleMessage);

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChange((user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.displayName || user.email}` : 'No user');
      setUser(user);
      setLoading(false);
      setError(null);
    });

    return () => {
      unsubscribe();
      broadcastChannel.close();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      console.log('🔑 Starting Google sign-in with popup...');
      
      // Try popup first (works better with storage partitioning)
      try {
        const result = await signInWithGooglePopup();
        console.log('✅ Popup sign-in successful:', result.user.displayName || result.user.email);
        
        // Extract and broadcast credential for iframe sync
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.idToken && credential?.accessToken) {
          console.log('📡 Broadcasting auth credential...');
          const payload = {
            type: 'FIREBASE_AUTH_CREDENTIAL',
            idToken: credential.idToken,
            accessToken: credential.accessToken
          };
          
          try {
            new BroadcastChannel('firebase-auth-sync').postMessage(payload);
          } catch (e) {
            // BroadcastChannel may not be available in all browsers
            console.log('⚠️ BroadcastChannel not available');
          }
        }
      } catch (popupError: any) {
        console.log('⚠️ Popup blocked or failed, trying redirect fallback...', popupError.code);
        
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          // Fallback to redirect only if popup fails
          console.log('🔄 Falling back to redirect...');
          await signInWithGoogleRedirect();
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error('❌ Sign-in error:', error);
      setError(error.message);
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      console.log('🔓 Starting complete sign out...');
      
      // 1. Sign out from Firebase
      await signOutUser();
      
      // 2. Clear any cached auth data from browser storage
      try {
        localStorage.removeItem('firebase:authUser:[DEFAULT]');
        localStorage.removeItem('firebase:authUser:' + import.meta.env.VITE_FIREBASE_PROJECT_ID);
        sessionStorage.clear();
        
        // Clear IndexedDB Firebase data (where we store persistence)
        if ('indexedDB' in window) {
          const deleteDB = indexedDB.deleteDatabase('firebase:auth');
          deleteDB.onsuccess = () => console.log('🗑️ Cleared Firebase auth database');
        }
      } catch (storageError) {
        console.log('⚠️ Could not clear some storage:', storageError);
      }
      
      // 3. Broadcast sign out to any other tabs/iframes
      try {
        new BroadcastChannel('firebase-auth-sync').postMessage({
          type: 'FIREBASE_AUTH_SIGNOUT'
        });
      } catch (e) {
        console.log('⚠️ BroadcastChannel not available for signout');
      }
      
      // 4. Force reload to ensure clean state
      console.log('✅ Complete sign out successful, reloading...');
      window.location.reload();
      
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
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