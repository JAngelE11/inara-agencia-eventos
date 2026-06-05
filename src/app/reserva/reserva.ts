import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-reserva',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reserva.html',
  styleUrl: './reserva.css'
})
export class Reserva implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  nombre: string = '';
  apellidos: string = '';
  celular: string = '';
  correo: string = '';
  tipoEvento: string = '';

  cargandoDatos: boolean = true; 

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        try {
          this.correo = user.email || '';
          
          const usuarioRef = doc(this.firestore, 'usuarios', user.uid);
          const usuarioSnap = await getDoc(usuarioRef);

          if (usuarioSnap.exists()) {
            const datos = usuarioSnap.data();
            this.nombre = datos['nombre'] || '';
            this.apellidos = datos['apellidos'] || '';
            this.celular = datos['celular'] || '';
          }
        } catch (error) {
          console.error("Error obteniendo datos:", error);
        } finally {
          this.cargandoDatos = false;
          this.cdr.detectChanges(); 
        }
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  // Nueva función para cerrar sesión
  async cerrarSesion() {
    try {
      await signOut(this.auth);
      this.router.navigate(['/inicio']);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }

  continuar() {
    if (!this.tipoEvento) {
      alert('Por favor selecciona el Tipo de Evento para continuar.');
      return;
    }

    const reservaTemp = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      celular: this.celular,
      correo: this.correo,
      tipoEvento: this.tipoEvento
    };
    
    localStorage.setItem('reservaPendiente', JSON.stringify(reservaTemp));
    this.router.navigate(['/calendario']);
  }
}