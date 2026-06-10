import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Importaciones de Firebase para Angular
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';

// ¡Tus credenciales reales con la llave de reCAPTCHA incluida!
const firebaseConfig = {
  apiKey: "AIzaSyDuxAlKWNuw2skCDynjPX-qj0tRl3kvEKw",
  authDomain: "inara-bd18d.firebaseapp.com",
  projectId: "inara-bd18d",
  storageBucket: "inara-bd18d.firebasestorage.app",
  messagingSenderId: "780526722537",
  appId: "1:780526722537:web:c3470669a4b1a60bdeff78",
  measurementId: "G-DHVG2VM541",
  recaptchaKey: "6LeAsBUtAAAAAPoyy8QGsbOJ5n2zrrwXoTBMVNvR" // 👈 Llave agregada
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Conectamos todos los servicios de Firebase a tu aplicación
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()) 
  ]
};