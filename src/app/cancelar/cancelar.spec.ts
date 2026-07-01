// ============================================================
//  TESTS TDD — cancelar.spec.ts
//  RF36: Pantalla de cancelación con datos de la cita
//  RF37: Actualizar estado a Cancelada
//  RF38: Liberar horario al cancelar
// ============================================================
import { describe, it, expect } from 'vitest';

// ── Lógica pura de cancelación ───────────────────────────────

type EstadoCita = 'Pendiente de Confirmacion' | 'Confirmada' | 'Cancelada';

interface Cita {
  id: string;
  nombre: string;
  apellidos: string;
  tipoEvento: string;
  fechaAsignada: string;
  horaAsignada: string;
  estado: EstadoCita;
  correo: string;
}

// Simula buscarReserva() del componente Cancelar
function buscarReserva(id: string, baseDatos: Map<string, Cita>): Cita | null {
  return baseDatos.get(id) ?? null;
}

// Simula confirmarCancelacion() — actualiza estado
function cancelarReserva(id: string, baseDatos: Map<string, Cita>): boolean {
  const cita = baseDatos.get(id);
  if (!cita) return false;
  cita.estado = 'Cancelada';
  return true;
}

// Simula el filtrado del calendario: las Canceladas liberan el horario
function estaHorarioDisponible(
  fecha: string,
  hora: string,
  reservas: Cita[]
): boolean {
  return !reservas.some(
    r => r.fechaAsignada === fecha && r.horaAsignada === hora && r.estado !== 'Cancelada'
  );
}


// ── RF36: Pantalla de cancelación con datos ───────────────────
describe('RF36 — Pantalla de cancelación muestra datos de la cita', () => {

  it('CP01 — ID válido en la URL retorna los datos de la cita', () => {
    // ARRANGE
    const bd = new Map<string, Cita>([
      ['CITA_20-julio-2026_1000', {
        id: 'CITA_20-julio-2026_1000',
        nombre: 'Ana',
        apellidos: 'García',
        tipoEvento: 'Boda',
        fechaAsignada: '20 de julio de 2026',
        horaAsignada: '10:00',
        estado: 'Confirmada',
        correo: 'ana@gmail.com',
      }]
    ]);

    // ACT
    const cita = buscarReserva('CITA_20-julio-2026_1000', bd);

    // ASSERT
    expect(cita).not.toBeNull();
    expect(cita?.tipoEvento).toBe('Boda');
    expect(cita?.nombre).toBe('Ana');
    expect(cita?.estado).not.toBe('Cancelada');
  });

  it('CP01b — ID inválido (enlace corrupto) retorna null', () => {
    // ARRANGE
    const bd = new Map<string, Cita>();

    // ACT
    const cita = buscarReserva('ID_INEXISTENTE', bd);

    // ASSERT
    expect(cita).toBeNull();
  });

  it('CP01c — Cita ya cancelada retorna estado Cancelada', () => {
    // ARRANGE
    const bd = new Map<string, Cita>([
      ['CITA_ya_cancelada', {
        id: 'CITA_ya_cancelada',
        nombre: 'Luis', apellidos: 'Pérez',
        tipoEvento: 'Cumpleaños',
        fechaAsignada: '10 de julio de 2026',
        horaAsignada: '14:00',
        estado: 'Cancelada',
        correo: 'luis@gmail.com',
      }]
    ]);

    // ACT
    const cita = buscarReserva('CITA_ya_cancelada', bd);

    // ASSERT
    expect(cita?.estado).toBe('Cancelada');
  });

});


// ── RF37: Actualizar estado a Cancelada ───────────────────────
describe('RF37 — Confirmar cancelación actualiza estado a Cancelada', () => {

  it('CP01 — Estado de cita activa cambia a Cancelada tras confirmar', () => {
    // ARRANGE
    const citaId = 'CITA_20-julio-2026_1000';
    const bd = new Map<string, Cita>([
      [citaId, {
        id: citaId,
        nombre: 'Ana', apellidos: 'García',
        tipoEvento: 'Boda',
        fechaAsignada: '20 de julio de 2026',
        horaAsignada: '10:00',
        estado: 'Confirmada',
        correo: 'ana@gmail.com',
      }]
    ]);

    // ACT
    const exito = cancelarReserva(citaId, bd);

    // ASSERT
    expect(exito).toBe(true);
    expect(bd.get(citaId)?.estado).toBe('Cancelada');
  });

  it('CP01b — Cancelar un ID inexistente retorna false sin errores', () => {
    // ARRANGE
    const bd = new Map<string, Cita>();

    // ACT
    const exito = cancelarReserva('NO_EXISTE', bd);

    // ASSERT
    expect(exito).toBe(false);
  });

});


// ── RF38: Liberar horario al cancelar ─────────────────────────
describe('RF38 — Horario queda disponible tras cancelar cita', () => {

  it('CP01 — Horario de cita Cancelada aparece disponible en el calendario', () => {
    // ARRANGE
    const reservas: Cita[] = [{
      id: 'CITA_21-julio-2026_1400',
      nombre: 'Carlos', apellidos: 'Ríos',
      tipoEvento: 'Quinceañero',
      fechaAsignada: '21 de julio de 2026',
      horaAsignada: '14:00',
      estado: 'Cancelada', // Ya fue cancelada
      correo: 'carlos@gmail.com',
    }];

    // ACT
    const disponible = estaHorarioDisponible('21 de julio de 2026', '14:00', reservas);

    // ASSERT — horario libre porque está Cancelada
    expect(disponible).toBe(true);
  });

  it('CP01b — Horario de cita Confirmada NO está disponible', () => {
    // ARRANGE
    const reservas: Cita[] = [{
      id: 'CITA_21-julio-2026_1400',
      nombre: 'Carlos', apellidos: 'Ríos',
      tipoEvento: 'Quinceañero',
      fechaAsignada: '21 de julio de 2026',
      horaAsignada: '14:00',
      estado: 'Confirmada',
      correo: 'carlos@gmail.com',
    }];

    // ACT
    const disponible = estaHorarioDisponible('21 de julio de 2026', '14:00', reservas);

    // ASSERT — horario bloqueado
    expect(disponible).toBe(false);
  });

  it('CP01c — Tras cancelar, el mismo horario pasa de bloqueado a disponible', () => {
    // ARRANGE
    const citaId = 'CITA_22-julio-2026_1600';
    const bd = new Map<string, Cita>([
      [citaId, {
        id: citaId,
        nombre: 'María', apellidos: 'López',
        tipoEvento: 'Baby Shower',
        fechaAsignada: '22 de julio de 2026',
        horaAsignada: '16:00',
        estado: 'Confirmada',
        correo: 'maria@gmail.com',
      }]
    ]);

    // PRE-ASSERT: bloqueado antes de cancelar
    const reservasAntes = Array.from(bd.values());
    expect(estaHorarioDisponible('22 de julio de 2026', '16:00', reservasAntes)).toBe(false);

    // ACT: cancelar
    cancelarReserva(citaId, bd);

    // ASSERT: disponible después de cancelar
    const reservasDespues = Array.from(bd.values());
    expect(estaHorarioDisponible('22 de julio de 2026', '16:00', reservasDespues)).toBe(true);
  });

});


// ══════════════════════════════════════════════════════════════
//  CP02 — CASOS FALLIDOS / FLUJOS DE ERROR
// ══════════════════════════════════════════════════════════════

describe('RF36 — Pantalla cancelación [CP02 - Caso fallido]', () => {
  it('CP02 — Enlace con ID inexistente retorna null (enlace corrupto)', () => {
    // ARRANGE
    const bd = new Map<string, Cita>(); // BD vacía

    // ACT
    const cita = buscarReserva('ID_QUE_NO_EXISTE', bd);

    // ASSERT — no se encuentra la reserva → pantalla de error
    expect(cita).toBeNull();
  });

  it('CP02b — Cita ya cancelada muestra estado Cancelada (no permite cancelar de nuevo)', () => {
    // ARRANGE
    const bd = new Map<string, Cita>([
      ['CITA_ya_cancelada', {
        id: 'CITA_ya_cancelada',
        nombre: 'Luis', apellidos: 'Pérez',
        tipoEvento: 'Cumpleaños',
        fechaAsignada: '10 de julio de 2026',
        horaAsignada: '14:00',
        estado: 'Cancelada',
        correo: 'luis@gmail.com',
      }]
    ]);

    // ACT
    const cita = buscarReserva('CITA_ya_cancelada', bd);

    // ASSERT — existe pero ya está cancelada → UI muestra "Ya Cancelada"
    expect(cita).not.toBeNull();
    expect(cita?.estado).toBe('Cancelada');
    // El sistema NO debe mostrar el botón de cancelar nuevamente
    const puedeVolverACancelar = cita?.estado !== 'Cancelada';
    expect(puedeVolverACancelar).toBe(false);
  });
});

describe('RF37 — Confirmar cancelación [CP02 - Caso fallido]', () => {
  it('CP02 — Intentar cancelar ID inexistente retorna false sin lanzar excepción', () => {
    // ARRANGE
    const bd = new Map<string, Cita>(); // BD vacía

    // ACT
    const exito = cancelarReserva('ID_FANTASMA', bd);

    // ASSERT — debe fallar silenciosamente, no romper la app
    expect(exito).toBe(false);
  });

  it('CP02b — Cita con estado Cancelada no cambia al intentar cancelar de nuevo', () => {
    // ARRANGE
    const citaId = 'CITA_doble_cancelacion';
    const bd = new Map<string, Cita>([
      [citaId, {
        id: citaId, nombre: 'Test', apellidos: '',
        tipoEvento: 'Boda',
        fechaAsignada: '20 de julio de 2026',
        horaAsignada: '10:00',
        estado: 'Cancelada', // ya estaba cancelada
        correo: 'test@gmail.com',
      }]
    ]);

    // ACT — intentamos cancelar de nuevo
    cancelarReserva(citaId, bd);

    // ASSERT — sigue en Cancelada (no hay cambio de estado inesperado)
    expect(bd.get(citaId)?.estado).toBe('Cancelada');
  });
});

describe('RF38 — Liberar horario [CP02 - Caso fallido]', () => {
  it('CP02 — Cita Confirmada mantiene el horario bloqueado (no se libera sin cancelar)', () => {
    // ARRANGE
    const reservas: Cita[] = [{
      id: 'CITA_confirmada',
      nombre: 'Pedro', apellidos: 'Salas',
      tipoEvento: 'Graduacion',
      fechaAsignada: '25 de julio de 2026',
      horaAsignada: '09:00',
      estado: 'Confirmada', // no cancelada
      correo: 'pedro@gmail.com',
    }];

    // ACT — verificamos disponibilidad SIN cancelar
    const disponible = estaHorarioDisponible('25 de julio de 2026', '09:00', reservas);

    // ASSERT — sigue bloqueado porque no se canceló
    expect(disponible).toBe(false);
  });

  it('CP02b — Horario de fecha diferente no se ve afectado por la cancelación', () => {
    // ARRANGE — cancelamos cita del día 22, pero el día 23 tiene otra cita activa
    const reservas: Cita[] = [
      {
        id: 'CITA_22_cancelada',
        nombre: 'Ana', apellidos: 'García', tipoEvento: 'Boda',
        fechaAsignada: '22 de julio de 2026', horaAsignada: '16:00',
        estado: 'Cancelada', correo: 'ana@gmail.com',
      },
      {
        id: 'CITA_23_activa',
        nombre: 'Luis', apellidos: 'Ríos', tipoEvento: 'Quinceañero',
        fechaAsignada: '23 de julio de 2026', horaAsignada: '16:00',
        estado: 'Confirmada', correo: 'luis@gmail.com',
      }
    ];

    // ACT
    const disponible22 = estaHorarioDisponible('22 de julio de 2026', '16:00', reservas);
    const disponible23 = estaHorarioDisponible('23 de julio de 2026', '16:00', reservas);

    // ASSERT — día 22 libre (cancelada), día 23 bloqueado (confirmada)
    expect(disponible22).toBe(true);
    expect(disponible23).toBe(false);
  });
});
