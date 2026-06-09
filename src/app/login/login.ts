import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
// ✅ Agregamos FacebookAuthProvider a las importaciones
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, sendPasswordResetEmail, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); 

  correo: string = '';
  contrasena: string = '';
  mostrarClave: boolean = false;
  revisandoSesion: boolean = true; 

  ngOnInit() {
    const unsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.redireccionarSegunRol(user.uid);
      } else {
        this.revisandoSesion = false; 
        this.cdr.detectChanges(); 
      }
      unsubscribe();
    });
  }

  toggleClave() {
    this.mostrarClave = !this.mostrarClave;
  }

  async iniciarSesion() {
    if (!this.correo || !this.contrasena) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Por favor, ingresa tu correo y contraseña.', confirmButtonColor: '#198754' });
      return;
    }

    Swal.fire({ title: 'Iniciando sesión...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, this.correo, this.contrasena);
      this.redireccionarSegunRol(userCredential.user.uid);
    } catch (error: any) {
      if (error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found') {
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'El correo electrónico ingresado no está registrado o el formato es incorrecto.', confirmButtonColor: '#d33' });
      } else if (error.code === 'auth/wrong-password') {
        Swal.fire({ icon: 'error', title: 'Oops...', text: 'La contraseña ingresada es incorrecta. Verifica tus datos de acceso.', confirmButtonColor: '#d33' });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un problema de conexión. Inténtalo de nuevo más tarde.', confirmButtonColor: '#d33' });
      }
    }
  }

  async iniciarSesionGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      Swal.fire({ title: 'Verificando datos...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

      const docRef = doc(this.firestore, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          nombre: user.displayName || 'Usuario Google',
          apellidos: '',
          celular: '',
          correo: user.email,
          rol: 'cliente',
          fechaRegistro: new Date().toISOString()
        });
      }

      this.redireccionarSegunRol(user.uid);

    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo iniciar sesión con Google.', confirmButtonColor: '#d33' });
    }
  }

  // 🔥 NUEVA FUNCIÓN: LOGIN CON FACEBOOK (Requerimiento 8)
  async iniciarSesionFacebook() {
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      Swal.fire({ title: 'Verificando datos de Facebook...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

      const docRef = doc(this.firestore, 'usuarios', user.uid);
      const docSnap = await getDoc(docRef);

      // Requerimiento 9: Guarda automáticamente nombre, correo y lo manda a BD
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          nombre: user.displayName || 'Usuario Facebook',
          apellidos: '',
          celular: '',
          correo: user.email || '', 
          rol: 'cliente',
          fechaRegistro: new Date().toISOString()
        });
      }

      this.redireccionarSegunRol(user.uid);

    } catch (error: any) {
      console.error(error);
      // Firebase protege si el correo de FB ya se usó para Google
      if(error.code === 'auth/account-exists-with-different-credential') {
        Swal.fire({ icon: 'error', title: 'Correo ya registrado', text: 'Este correo ya está asociado a otra cuenta (probablemente Google). Usa ese método para entrar.', confirmButtonColor: '#d33' });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo conectar con Facebook.', confirmButtonColor: '#d33' });
      }
    }
  }

  async redireccionarSegunRol(uid: string) {
    try {
      const docRef = doc(this.firestore, 'usuarios', uid);
      const docSnap = await getDoc(docRef);
      
      Swal.close(); 

      if (docSnap.exists() && docSnap.data()['rol'] === 'admin') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/panel-cliente']);
      }
    } catch (error) {
      Swal.close();
      this.router.navigate(['/panel-cliente']); 
    }
  }

  async recuperarContrasena() {
    const { value: email } = await Swal.fire({
      title: 'Recuperar contraseña',
      input: 'email',
      inputLabel: 'Ingresa tu correo electrónico registrado',
      inputPlaceholder: 'correo@ejemplo.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar enlace',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    });

    if (email) {
      Swal.fire({ title: 'Enviando correo...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
      try {
        await sendPasswordResetEmail(this.auth, email);
        Swal.fire({ icon: 'success', title: '¡Correo enviado!', text: 'Revisa tu bandeja de entrada o spam. Te hemos enviado un enlace para cambiar tu contraseña.', confirmButtonColor: '#198754' });
      } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'No pudimos encontrar ese correo o hubo un problema. Inténtalo de nuevo.', confirmButtonColor: '#d33' });
      }
    }
  }
}