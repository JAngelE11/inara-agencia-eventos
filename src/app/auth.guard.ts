import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

// 🛡️ VIGILANTE PARA CLIENTES (Solo pide estar logueado)
export const authGuard = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Apagamos el escuchador para que no se repita
      if (user) {
        resolve(true); // ¡Adelante, puedes pasar!
      } else {
        router.navigate(['/login']); // Sin cuenta, al login
        resolve(false);
      }
    });
  });
};

// 👑 VIGILANTE VIP PARA ADMINISTRADORA (Pide estar logueado y ser Admin)
export const adminGuard = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          // Revisamos su rol en la base de datos
          const docRef = doc(firestore, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data()['rol'] === 'admin') {
            resolve(true); // ¡Pase usted, jefa!
          } else {
            router.navigate(['/panel-cliente']); // Si es cliente, lo mandamos a su panel
            resolve(false);
          }
        } catch (e) {
          router.navigate(['/login']);
          resolve(false);
        }
      } else {
        router.navigate(['/login']);
        resolve(false);
      }
    });
  });
};