import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  private auth = inject(Auth);

  // Variables para saber quién nos visita
  usuarioLogueado: boolean = false;
  esAdmin: boolean = false;

  ngOnInit() {
    // El vigilante revisa silenciosamente si hay alguien conectado
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.usuarioLogueado = true;
        // Si es tu correo, sabe que eres la jefa
        this.esAdmin = user.email === 'admin@inara.com';
      } else {
        this.usuarioLogueado = false;
        this.esAdmin = false;
      }
    });
  }
}
