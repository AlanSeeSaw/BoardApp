import { useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const { uid, email, displayName } = firebaseUser;
        
        setUser({
          id: uid,
          email: email || '',
          name: displayName || email || '',
        });
      } else {
        setUser(null);
      }
      
      setLoading(false);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [auth]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { uid, email: userEmail, displayName } = userCredential.user;
      
      setUser({
        id: uid,
        email: userEmail || '',
        name: displayName || userEmail || '',
      });
    } catch (err: any) {
      console.error('Sign in error:', err);
      let errorMessage = 'Failed to sign in';
      
      // Provide more specific error messages
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many unsuccessful login attempts. Please try again later.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(firebaseUser, { displayName });
      }
      
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: displayName || firebaseUser.email || '',
      });
    } catch (err: any) {
      console.error('Sign up error:', err);
      let errorMessage = 'Failed to create account';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out');
    }
  };

  return {
    user,
    loading,
    error,
    authChecked,
    signIn,
    signUp,
    signOut,
  };
};