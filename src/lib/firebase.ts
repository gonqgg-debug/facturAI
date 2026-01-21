/**
 * Firebase Configuration
 * 
 * Services enabled:
 * - Auth: Email + Google sign-in for store owners
 * - Analytics: Track app usage and events
 * - Cloud Messaging: Push notifications (low stock alerts, etc.)
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification,
    onAuthStateChanged,
    updateProfile,
    deleteUser,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    EmailAuthProvider,
    GoogleAuthProvider,
    type Auth,
    type User
} from 'firebase/auth';
import { getAnalytics, logEvent, type Analytics } from 'firebase/analytics';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { browser } from '$app/environment';
import { writable, derived, type Readable } from 'svelte/store';

// ============================================================
// CONFIGURATION
// ============================================================

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string
};

// ============================================================
// INITIALIZATION
// ============================================================

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;
let messaging: Messaging | null = null;

// ============================================================
// AUTH STATE MANAGEMENT
// ============================================================

export interface FirebaseAuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

const authStateStore = writable<FirebaseAuthState>({
    user: null,
    loading: true,
    error: null
});

export const firebaseAuth: Readable<FirebaseAuthState> = {
    subscribe: authStateStore.subscribe
};

export const isFirebaseAuthenticated = derived(
    firebaseAuth,
    $auth => !!$auth.user && !$auth.loading
);

export const isFirebaseLoading = derived(
    firebaseAuth,
    $auth => $auth.loading
);

export const firebaseUser = derived(
    firebaseAuth,
    $auth => $auth.user
);

export const firebaseUserEmail = derived(
    firebaseAuth,
    $auth => $auth.user?.email || null
);

export const firebaseUserId = derived(
    firebaseAuth,
    $auth => $auth.user?.uid || null
);

/**
 * Initialize Firebase (call once on app startup)
 */
export function initializeFirebase(): void {
    if (!browser) return;
    
    console.log('[Firebase] Initializing Firebase...');
    console.log('[Firebase] Config check - apiKey:', !!firebaseConfig.apiKey);
    console.log('[Firebase] Config check - authDomain:', firebaseConfig.authDomain);
    console.log('[Firebase] Config check - projectId:', !!firebaseConfig.projectId);
    
    // Check if config is available
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error('[Firebase] NOT CONFIGURED! Missing apiKey or projectId');
        console.error('[Firebase] Add VITE_FIREBASE_* variables to .env');
        authStateStore.update(s => ({ ...s, loading: false }));
        return;
    }
    
    try {
        app = initializeApp(firebaseConfig);
        console.log('[Firebase] App initialized successfully');
        
        // Initialize Auth
        auth = getAuth(app);
        console.log('[Firebase] Auth initialized');
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            console.log('[Firebase] Auth state changed:', user?.email || 'signed out');
            authStateStore.set({
                user,
                loading: false,
                error: null
            });
        });
        
        // Initialize Analytics (non-blocking)
        try {
        analytics = getAnalytics(app);
            console.log('[Firebase] Analytics initialized');
        } catch (analyticsError) {
            console.warn('[Firebase] Analytics failed (non-critical):', analyticsError);
        }
        
    } catch (error) {
        console.error('[Firebase] Failed to initialize:', error);
        authStateStore.update(s => ({ 
            ...s, 
            loading: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }));
    }
}

/**
 * Get the Firebase app instance
 */
export function getFirebaseApp(): FirebaseApp | null {
    return app;
}

/**
 * Get the Firebase Auth instance
 */
export function getFirebaseAuth(): Auth | null {
    return auth;
}

/**
 * Get the current Firebase user
 */
export function getCurrentUser(): User | null {
    return auth?.currentUser || null;
}

// ============================================================
// AUTHENTICATION FUNCTIONS
// ============================================================

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    
    authStateStore.update(s => ({ ...s, loading: true, error: null }));
    
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        trackLogin('email');
        return result.user;
    } catch (error) {
        const message = getAuthErrorMessage(error);
        authStateStore.update(s => ({ ...s, loading: false, error: message }));
        throw new Error(message);
    }
}

/**
 * Create a new account with email and password
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    
    authStateStore.update(s => ({ ...s, loading: true, error: null }));
    
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        // Send email verification
        await sendEmailVerification(result.user);
        
        trackEvent('sign_up', { method: 'email' });
        return result.user;
    } catch (error) {
        const message = getAuthErrorMessage(error);
        authStateStore.update(s => ({ ...s, loading: false, error: message }));
        throw new Error(message);
    }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<User> {
    console.log('[Firebase] signInWithGoogle called');
    
    if (!auth) {
        console.error('[Firebase] Auth not initialized!');
        throw new Error('Firebase Auth not initialized');
    }
    
    console.log('[Firebase] Auth is initialized, starting Google sign-in...');
    authStateStore.update(s => ({ ...s, loading: true, error: null }));
    
    try {
        const provider = new GoogleAuthProvider();
        console.log('[Firebase] GoogleAuthProvider created, opening popup...');
        const result = await signInWithPopup(auth, provider);
        console.log('[Firebase] Google sign-in successful:', result.user.email);
        trackLogin('google');
        return result.user;
    } catch (error) {
        console.error('[Firebase] Google sign-in error:', error);
        console.error('[Firebase] Error code:', (error as { code?: string })?.code);
        console.error('[Firebase] Error message:', (error as Error)?.message);
        const message = getAuthErrorMessage(error);
        authStateStore.update(s => ({ ...s, loading: false, error: message }));
        throw new Error(message);
    }
}

/**
 * Sign out the current user
 */
export async function firebaseSignOut(): Promise<void> {
    if (!auth) return;
    
    try {
        await signOut(auth);
        trackEvent('sign_out');
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    
    try {
        await sendPasswordResetEmail(auth, email);
        trackEvent('password_reset_sent');
    } catch (error) {
        const message = getAuthErrorMessage(error);
        throw new Error(message);
    }
}

/**
 * Send a password reset email to the current user
 */
export async function sendPasswordResetToCurrentUser(): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No email available for this account');
    await sendPasswordResetEmail(auth, user.email);
    trackEvent('password_reset_sent');
}

/**
 * Update the current user's display name
 */
export async function updateFirebaseDisplayName(displayName: string): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await updateProfile(user, { displayName });
    trackEvent('profile_updated', { field: 'displayName' });
}

/**
 * Reauthenticate with email/password for sensitive actions
 */
export async function reauthenticateWithPassword(password: string): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No email available for this account');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
}

/**
 * Reauthenticate with Google popup for sensitive actions
 */
export async function reauthenticateWithGoogle(): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const provider = new GoogleAuthProvider();
    await reauthenticateWithPopup(user, provider);
}

/**
 * Delete the current Firebase user
 */
export async function deleteCurrentUser(): Promise<void> {
    if (!auth) throw new Error('Firebase Auth not initialized');
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    await deleteUser(user);
    trackEvent('account_deleted');
}

/**
 * Convert Firebase auth errors to user-friendly messages
 */
function getAuthErrorMessage(error: unknown): string {
    const code = (error as { code?: string })?.code || '';
    
    switch (code) {
        case 'auth/email-already-in-use':
            return 'Este email ya está registrado. Intenta iniciar sesión.';
        case 'auth/invalid-email':
            return 'Email inválido.';
        case 'auth/operation-not-allowed':
            return 'Operación no permitida.';
        case 'auth/weak-password':
            return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
        case 'auth/user-disabled':
            return 'Esta cuenta ha sido deshabilitada.';
        case 'auth/user-not-found':
            return 'No existe una cuenta con este email.';
        case 'auth/wrong-password':
            return 'Contraseña incorrecta.';
        case 'auth/invalid-credential':
            return 'Credenciales inválidas. Verifica tu email y contraseña.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos. Intenta de nuevo más tarde.';
        case 'auth/popup-closed-by-user':
            return 'Inicio de sesión cancelado.';
        case 'auth/network-request-failed':
            return 'Error de conexión. Verifica tu internet.';
        default:
            return (error as Error)?.message || 'Error de autenticación.';
    }
}

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
    if (!analytics) return;
    
    try {
        logEvent(analytics, eventName, params);
    } catch (error) {
        console.warn('Failed to track event:', error);
    }
}

/**
 * Track a sale event
 */
export function trackSale(saleData: {
    total: number;
    itemCount: number;
    paymentMethod: string;
}): void {
    trackEvent('sale_completed', {
        value: saleData.total,
        currency: 'DOP',
        items: saleData.itemCount,
        payment_method: saleData.paymentMethod
    });
}

/**
 * Track a product view
 */
export function trackProductView(productId: string, productName: string): void {
    trackEvent('view_item', {
        item_id: productId,
        item_name: productName
    });
}

/**
 * Track user login
 */
export function trackLogin(method: string = 'pin'): void {
    trackEvent('login', { method });
}

/**
 * Track screen/page view
 */
export function trackScreenView(screenName: string): void {
    trackEvent('screen_view', {
        screen_name: screenName
    });
}

/**
 * Track feature usage
 */
export function trackFeatureUsed(featureName: string): void {
    trackEvent('feature_used', {
        feature_name: featureName
    });
}

// ============================================================
// PUSH NOTIFICATIONS (CLOUD MESSAGING)
// ============================================================

// VAPID key from Firebase Console > Project Settings > Cloud Messaging
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

/**
 * Initialize push notifications
 * Returns the FCM token if successful
 */
export async function initializePushNotifications(): Promise<string | null> {
    if (!browser || !app) return null;
    
    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return null;
        }
        
        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission denied');
            return null;
        }
        
        // Initialize messaging
        messaging = getMessaging(app);
        
        // Get FCM token
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY
        });
        
        console.log('FCM Token:', token);
        return token;
        
    } catch (error) {
        console.error('Failed to initialize push notifications:', error);
        return null;
    }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: unknown) => void): void {
    if (!messaging) return;
    
    onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
    });
}

/**
 * Show a local notification (when app is in foreground)
 */
export function showLocalNotification(title: string, body: string, icon?: string): void {
    if (!browser || Notification.permission !== 'granted') return;
    
    new Notification(title, {
        body,
        icon: icon || '/favicon.png',
        badge: '/favicon.png'
    });
}

// ============================================================
// NOTIFICATION HELPERS FOR POS
// ============================================================

/**
 * Send low stock alert (to be called from stock management)
 */
export function alertLowStock(productName: string, currentStock: number, reorderPoint: number): void {
    showLocalNotification(
        '⚠️ Stock Bajo',
        `${productName}: ${currentStock} unidades (mínimo: ${reorderPoint})`,
        '/favicon.png'
    );
    
    trackEvent('low_stock_alert', {
        product_name: productName,
        current_stock: currentStock,
        reorder_point: reorderPoint
    });
}

/**
 * Send shift reminder notification
 */
export function alertShiftEnding(minutesRemaining: number): void {
    showLocalNotification(
        '⏰ Fin de Turno',
        `Tu turno termina en ${minutesRemaining} minutos`,
        '/favicon.png'
    );
    
    trackEvent('shift_ending_alert', {
        minutes_remaining: minutesRemaining
    });
}

/**
 * Send daily summary notification
 */
export function alertDailySummary(totalSales: number, transactionCount: number): void {
    showLocalNotification(
        '📊 Resumen del Día',
        `Ventas: DOP ${totalSales.toLocaleString()} (${transactionCount} transacciones)`,
        '/favicon.png'
    );
    
    trackEvent('daily_summary_viewed', {
        total_sales: totalSales,
        transaction_count: transactionCount
    });
}

