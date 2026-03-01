'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

interface UserProfile {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
    avatar_url: string;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    isAdmin: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    isAdmin: false,
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const loadingResolved = useRef(false);
    const supabase = getSupabase();

    // Fetch profile via server-side API route (bypasses CORS)
    const fetchProfile = async (userId: string) => {
        try {
            const res = await fetch('/api/profile', {
                headers: { 'x-user-id': userId },
            });
            const json = await res.json();
            if (res.ok && json.profile) {
                setProfile(json.profile as UserProfile);
            }
        } catch {
            // Profile fetch failed - continue without profile
        }
    };

    // Force loading to false - prevents UI from hanging forever
    const resolveLoading = () => {
        if (!loadingResolved.current) {
            loadingResolved.current = true;
            setLoading(false);
        }
    };

    useEffect(() => {
        // SAFETY: Force loading=false after 3 seconds no matter what
        // This prevents the auth from hanging the entire UI if Supabase is unreachable
        const timeout = setTimeout(() => {
            resolveLoading();
        }, 3000);

        // Try to get the initial session
        const initSession = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                setSession(initialSession);
                setUser(initialSession?.user ?? null);
                if (initialSession?.user) {
                    fetchProfile(initialSession.user.id);
                }
            } catch {
                // Session init failed - continue as logged out
            }
            resolveLoading();
        };
        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event: string, newSession: Session | null) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                if (newSession?.user) {
                    await fetchProfile(newSession.user.id);
                } else {
                    setProfile(null);
                }
                resolveLoading();
            }
        );

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            return { error: error?.message ?? null };
        } catch {
            return { error: 'Sign in failed. Please try again.' };
        }
    };

    const signUp = async (email: string, password: string, username: string) => {
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { username } },
            });
            return { error: error?.message ?? null };
        } catch {
            return { error: 'Sign up failed. Please try again.' };
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch {
            // Sign out failed - clear local state anyway
        }
        setUser(null);
        setSession(null);
        setProfile(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            session,
            loading,
            isAdmin: profile?.role === 'admin',
            signIn,
            signUp,
            signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
