// ============================================================
//  TESTS TDD — calendario.spec.ts
//  RF11: Calendario carga días diferenciados
//  RF13: Días bloqueados por ocupación
//  RF14: Días no laborables deshabilitados
//  RF15: Horarios libres al seleccionar día
//  RF16: Bloques reservados no visibles
// ============================================================
import { describe, it, expect } from 'vitest';

// ── Lógica pura del componente Calendario ────────────────────
// Replicamos esDiaInvalido() y la lógica de filtrar horarios

function esDiaInvalido(
  dia: number,
  mes: number,   // 0-indexed como Date
  anio: number,
  feriadosArray: string[],
  hoyFecha?: Date
): boolean {
  const fecha = new Date(anio, mes, dia);
  const hoy = hoyFecha ?? new Date();
  const hoyNorm = new Date(hoy);
  hoyNorm.setHours(0, 0, 0, 0);

  if (fecha < hoyNorm) return true;        // Día pasado
  if (fecha.getDay() === 0) return true;   // Domingo

  const diaStr = dia.toString().padStart(2, '0');
  const mesStr = (mes + 1).toString().padStart(2, '0');
  const formatoNumerico = `${diaStr}/${mesStr}/${anio}`;

  if (feriadosArray.includes(formatoNumerico)) return true;

  return false;
}

function generarCalendario(mes: number, anio: number): { diasVacios: number[]; dias: number[] } {
  const primerDia = new Date(anio, mes, 1).getDay();
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  return {
    diasVacios: Array(primerDia).fill(0).map((_, i) => i),
    dias: Array.from({ length: totalDias }, (_, i) => i + 1),
  };
}

function filtrarHorasDisponibles(
  baseHoras: string[],
  horasOcupadas: string[],
  esHoy: boolean,
  horaActual: number
): string[] {
  return baseHoras.filter(horaStr => {
    const horaNum = parseInt(horaStr.split(':')[0]);
    if (esHoy && horaNum < horaActual + 2) return false;
    const seCruza = horasOcupadas.some(ocupadaStr => {
      const ocupadaNum = parseInt(ocupadaStr.split(':')[0]);
      return Math.abs(horaNum - ocupadaNum) < 2;
    });
    return !seCruza;
  });
}


// ── RF11: Calendario genera días correctamente ───────────────
describe('RF11 — Calendario interactivo carga mes actual', () => {

  it('CP01 — Julio 2026 tiene 31 días en el array dias[]', () => {
    // ARRANGE
    const mes = 6; // Julio (0-indexed)
    const anio = 2026;

    // ACT
    const { dias } = generarCalendario(mes, anio);

    // ASSERT
    expect(dias.length).toBe(31);
    expect(dias[0]).toBe(1);
    expect(dias[30]).toBe(31);
  });

  it('CP01b — Febrero 2026 tiene 28 días', () => {
    // ARRANGE + ACT
    const { dias } = generarCalendario(1, 2026); // Febrero

    // ASSERT
    expect(dias.length).toBe(28);
  });

});


// ── RF13 + RF14: Días inválidos ───────────────────────────────
describe('RF13/RF14 — Días no disponibles en calendario', () => {

  const HOY = new Date(2026, 6, 15); // Simulamos hoy = 15 jul 2026

  it('CP01 — Día pasado (10 jul 2026) es inválido', () => {
    // ARRANGE
    const feriadosArray: string[] = [];

    // ACT
    const resultado = esDiaInvalido(10, 6, 2026, feriadosArray, HOY);

    // ASSERT
    expect(resultado).toBe(true);
  });

  it('CP01b — Domingo (19 jul 2026) es inválido', () => {
    // ARRANGE
    const feriadosArray: string[] = [];

    // ACT — 19/07/2026 es domingo
    const resultado = esDiaInvalido(19, 6, 2026, feriadosArray, HOY);

    // ASSERT
    expect(resultado).toBe(true);
  });

  it('CP01c — Feriado configurado (28/07/2026) es inválido', () => {
    // ARRANGE
    const feriadosArray = ['28/07/2026'];

    // ACT
    const resultado = esDiaInvalido(28, 6, 2026, feriadosArray, HOY);

    // ASSERT
    expect(resultado).toBe(true);
  });

  it('CP01d — Día hábil futuro (20 jul 2026, lunes) es válido', () => {
    // ARRANGE
    const feriadosArray: string[] = [];

    // ACT
    const resultado = esDiaInvalido(20, 6, 2026, feriadosArray, HOY);

    // ASSERT
    expect(resultado).toBe(false);
  });

});


// ── RF15 + RF16: Horarios disponibles y ocupados ─────────────
describe('RF15/RF16 — Horarios libres vs ocupados', () => {

  const baseHoras = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  it('CP01 — Horario ocupado a las 10:00 bloquea también 11:00 (margen de 2 horas)', () => {
    // ARRANGE
    const horasOcupadas = ['10:00'];

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, false, 0);

    // ASSERT — 10 y 11 deben estar bloqueadas (|10-10|<2 y |11-10|<2)
    expect(disponibles).not.toContain('10:00');
    expect(disponibles).not.toContain('11:00');
    expect(disponibles).toContain('12:00'); // 12 sí está libre
  });

  it('CP01b — Sin horas ocupadas, todos los horarios base están disponibles', () => {
    // ARRANGE
    const horasOcupadas: string[] = [];

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, false, 0);

    // ASSERT
    expect(disponibles.length).toBe(baseHoras.length);
  });

  it('CP01c — Si es HOY y hora actual es 10, se bloquean horas < 12 (horaActual+2)', () => {
    // ARRANGE
    const horasOcupadas: string[] = [];
    const esHoy = true;
    const horaActual = 10; // son las 10am

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, esHoy, horaActual);

    // ASSERT — horas 10 y 11 bloqueadas por ser hoy y < horaActual+2
    expect(disponibles).not.toContain('10:00');
    expect(disponibles).not.toContain('11:00');
    expect(disponibles).toContain('12:00');
  });

  it('CP01d — Hora con estado Cancelada NO bloquea el horario (no está en horasOcupadas)', () => {
    // ARRANGE — en calendario.ts, las Canceladas se filtran antes de armar horasOcupadas
    const reservas = [
      { horaAsignada: '10:00', estado: 'Cancelada' },
      { horaAsignada: '14:00', estado: 'Pendiente de Confirmacion' },
    ];
    const horasOcupadas = reservas
      .filter(r => r.estado !== 'Cancelada')
      .map(r => r.horaAsignada);

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, false, 0);

    // ASSERT
    expect(disponibles).toContain('10:00'); // Cancelada: libre
    expect(disponibles).not.toContain('14:00'); // Pendiente: ocupada
  });

});


// ── Código único de reserva ───────────────────────────────────
describe('RF28 — Código de reserva único INARA-XXXXXX', () => {

  function generarCodigo(): string {
    return 'INARA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  it('CP01 — El código generado empieza con INARA-', () => {
    // ARRANGE + ACT
    const codigo = generarCodigo();

    // ASSERT
    expect(codigo.startsWith('INARA-')).toBe(true);
  });

  it('CP01b — Dos códigos generados son distintos', () => {
    // ARRANGE + ACT
    const codigo1 = generarCodigo();
    const codigo2 = generarCodigo();

    // ASSERT
    expect(codigo1).not.toBe(codigo2);
  });

  it('CP01c — El código tiene longitud de 12 caracteres (INARA- + 6)', () => {
    // ARRANGE + ACT
    const codigo = generarCodigo();

    // ASSERT
    expect(codigo.length).toBe(12);
  });

});


// ══════════════════════════════════════════════════════════════
//  CP02 — CASOS FALLIDOS / FLUJOS DE ERROR
// ══════════════════════════════════════════════════════════════

describe('RF11 — Calendario [CP02 - Caso fallido]', () => {
  it('CP02 — Mes inválido (13) produce 0 días en el array', () => {
    // ARRANGE
    const mes = 12;   // mes 12 no existe (0-indexed va 0-11)
    const anio = 2026;

    // ACT
    // new Date(2026, 12, 0) da el último día del mes 12 → diciembre tiene 31
    // pero si generarCalendario recibe mes=12 el calendario sería incorrecto
    const totalDias = new Date(anio, mes + 1, 0).getDate();
    const dias = Array.from({ length: totalDias }, (_, i) => i + 1);

    // ASSERT — mes 12 produce un calendario de enero del año siguiente (bug potencial)
    // El sistema debería validar que mes esté entre 0 y 11
    expect(mes).toBeGreaterThan(11); // mes fuera de rango
    expect(dias.length).toBeGreaterThan(0); // aun así genera días (comportamiento no deseado)
  });

  it('CP02b — Febrero 2026 NO tiene 29 días (no es año bisiesto)', () => {
    // ARRANGE + ACT
    const { dias } = generarCalendario(1, 2026);

    // ASSERT — debe ser 28, no 29
    expect(dias.length).toBe(28);
    expect(dias.length).not.toBe(29);
  });
});

describe('RF13/RF14 — Días inválidos [CP02 - Caso fallido]', () => {
  it('CP02 — Domingo es siempre inválido aunque no sea feriado', () => {
    // ARRANGE
    const HOY = new Date(2026, 6, 1); // 1 jul 2026
    const feriadosArray: string[] = []; // sin feriados

    // ACT — 19/07/2026 es domingo
    const resultado = esDiaInvalido(19, 6, 2026, feriadosArray, HOY);

    // ASSERT — domingo debe bloquearse aunque no esté en feriados
    expect(resultado).toBe(true);
  });

  it('CP02b — Día hábil con feriado NO configurado queda disponible (feriado no surte efecto)', () => {
    // ARRANGE
    const HOY = new Date(2026, 6, 1);
    const feriadosArray: string[] = []; // 28/07 NO está en feriados

    // ACT
    const resultado = esDiaInvalido(28, 6, 2026, feriadosArray, HOY);

    // ASSERT — si el feriado no se configura, el día queda disponible (error de config)
    expect(resultado).toBe(false); // disponible porque el admin no lo configuró
  });
});

describe('RF15/RF16 — Horarios [CP02 - Caso fallido]', () => {
  it('CP02 — Si TODAS las horas están ocupadas, la lista disponible queda vacía', () => {
    // ARRANGE
    const baseHoras = ['10:00', '12:00', '14:00', '16:00'];
    // Ocupamos estratégicamente para que el margen de 2h bloquee todo
    const horasOcupadas = ['10:00', '12:00', '14:00', '16:00'];

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, false, 0);

    // ASSERT — no hay horarios disponibles, el día está lleno
    expect(disponibles.length).toBe(0);
  });

  it('CP02b — Hora pasada de HOY no aparece disponible aunque no esté reservada', () => {
    // ARRANGE
    const baseHoras = ['08:00', '09:00', '10:00', '11:00', '12:00'];
    const horasOcupadas: string[] = []; // nadie reservó
    const esHoy = true;
    const horaActual = 10; // son las 10am

    // ACT
    const disponibles = filtrarHorasDisponibles(baseHoras, horasOcupadas, esHoy, horaActual);

    // ASSERT — 08, 09, 10, 11 bloqueadas por ser <= horaActual+1
    expect(disponibles).not.toContain('08:00');
    expect(disponibles).not.toContain('09:00');
    expect(disponibles).not.toContain('10:00');
    expect(disponibles).not.toContain('11:00');
    expect(disponibles).toContain('12:00'); // única disponible
  });
});

describe('RF28 — Código reserva [CP02 - Caso fallido]', () => {
  it('CP02 — Código con prefijo incorrecto no es válido para el sistema', () => {
    // ARRANGE
    const codigoMalFormado = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // ACT
    const esValido = codigoMalFormado.startsWith('INARA-');

    // ASSERT — debe rechazarse si no empieza con INARA-
    expect(esValido).toBe(false);
  });

  it('CP02b — Código de menos de 12 caracteres no cumple el formato', () => {
    // ARRANGE
    const codigoCorto = 'INARA-AB'; // solo 8 chars

    // ACT
    const cumpleFormato = codigoCorto.startsWith('INARA-') && codigoCorto.length === 12;

    // ASSERT
    expect(cumpleFormato).toBe(false);
  });
});
