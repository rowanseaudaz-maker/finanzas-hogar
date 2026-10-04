# SPEC 03 — Control de cuotas de préstamos

> **Estado:** Aprobado
> **Depende de:** SPEC 02
> **Fecha:** 2026-10-04
> **Objetivo:** Agregar un apartado de préstamos con cuotas mensuales registrables y pagables que se incluyan en el disponible de Lisandro y Catriel.

## Alcance

**Dentro:**

- Añadir una sección de préstamos al dashboard de tres áreas de SPEC 02.
- Registrar entidad acreedora como texto libre, con Nación y Naranja como ejemplos.
- Registrar descripción, importe de cada cuota, cuota actual, total de cuotas y próximo vencimiento.
- Asignar cada préstamo a Lisandro, Catriel o ambos con reparto 50/50.
- Registrar quién paga cada cuota: Lisandro, Catriel o una persona externa con nombre.
- Generar las cuotas mensuales desde la cuota actual hasta la última, ajustando los vencimientos al último día del mes cuando el día original no exista.
- Marcar cuotas pendientes como pagadas; conservar las pagadas y avanzar al siguiente número de cuota hasta completar el préstamo.
- Incluir las cuotas personales y compartidas en el disponible mensual de SPEC 02. Las cuotas pagadas por externos no reducen el disponible del hogar.
- Mantener el disponible del mes como proyección: contar todas las cuotas de ese mes, pagadas o pendientes.
- Permitir editar préstamos y cancelar cuotas futuras; conservar el historial de cuotas pagadas.
- Extender el almacenamiento de SPEC 02 a `schemaVersion: 3` en `finanzas-hogar:v3`, copiando el modelo v2 completo y agregando los préstamos sin modificar v2.
- Mantener la exportación e importación JSON para el modelo v3 completo, con validación de versión y confirmación antes del reemplazo.

**Fuera de alcance:**

- Calcular intereses, amortización, capital restante o cargos bancarios.
- Conexión con Nación, Naranja u otros prestamistas.
- Pagos parciales, cancelación anticipada, refinanciación o cambios automáticos del importe de cuota.
- Préstamos en monedas diferentes a la moneda única de SPEC 02.
- Reemplazar o alterar el registro de cuentas por pagar que provee SPEC 02.

## Modelo de datos

Cada préstamo genera registros individuales de cuota para conservar el estado pagado sin quitarlo del cálculo del mes. `responsibility` y `payer` usan las reglas de SPEC 02.

```js
const loan = {
  id: "loan-1",
  lender: "Nación",
  description: "Préstamo personal",
  responsibility: "lisandro",
  payer: { kind: "member", memberId: "lisandro" },
  installments: [
    {
      id: "loan-installment-3",
      number: 3,
      total: 12,
      dueDate: "2026-10-31",
      amountMinor: 48000,
      status: "pending"
    }
  ]
};
```

`lender` es texto editable. `responsibility` admite `lisandro`, `catriel` o `shared`. `payer.kind` admite `member` o `external`; los pagadores externos incluyen `name`. `installments` cubre desde el número actual hasta el total, con cuotas `pending` o `paid`. El importe de cuota se ingresa manualmente y no se calcula interés.

## Plan de implementación

1. Extender `src/lib/storage.js` y `src/lib/storage.test.js` para crear el esquema v3, copiar íntegramente v2 y conservar intacta la clave v2.
2. Crear `src/lib/loans.js` y `src/lib/loans.test.js` para validar préstamos, generar cuotas, avanzar al marcar una pagada y conservar el historial al cancelar cuotas futuras.
3. Extender `src/lib/finance.js` y `src/lib/finance.test.js` para sumar las cuotas de préstamos al disponible mensual según titular, reparto compartido y pagador externo.
4. Actualizar `src/App.jsx` y `src/index.css` con el apartado de préstamos dentro del dashboard de SPEC 02, incluyendo alta, edición, estado de cuotas y cancelación de cuotas futuras.
5. Actualizar `src/lib/backup.js` y `src/lib/backup.test.js` para exportar e importar el modelo v3 completo y rechazar archivos inválidos o incompatibles sin reemplazar el estado actual.

## Criterios de aceptación

- [ ] `npm run dev`, `npm test` y `npm run build` terminan correctamente.
- [ ] Se puede crear un préstamo con entidad libre, importe de cuota, número actual, total y próximo vencimiento.
- [ ] El préstamo puede ser de Lisandro, de Catriel o compartido al 50%; se puede asignar un miembro o un externo como pagador.
- [ ] Se generan las cuotas mensuales desde la actual hasta la última y se ajustan los vencimientos al fin de mes cuando corresponde.
- [ ] Marcar una cuota como pagada conserva su registro y avanza a la siguiente; al pagar la última el préstamo queda completo.
- [ ] Las cuotas del préstamo se incluyen en el disponible mensual de SPEC 02 sin contar dos veces una cuota pagada.
- [ ] Las cuotas pagadas por una persona externa no reducen el disponible de Lisandro ni Catriel.
- [ ] Cancelar cuotas futuras conserva las cuotas pagadas y deja de contar las futuras en el disponible proyectado.
- [ ] La migración de v2 a v3 conserva moneda, ingresos, pagos, categorías y saldos; la clave v2 no se modifica.
- [ ] La exportación contiene el modelo v3 completo; JSON inválido o de otra versión no cambia los datos actuales.
- [ ] Las pruebas cubren creación, avance, vencimientos, reparto, pagadores externos, cálculo mensual y respaldo v3.

## Decisiones

- **Sí:** separar préstamos en SPEC 03, dependiente del control de pagos de SPEC 02.
- **Sí:** entidad acreedora libre y cuotas con importe ingresado; no se estiman intereses ni amortización.
- **Sí:** usar el mismo modelo de responsabilidad, pagador y reparto de SPEC 02.
- **Sí:** mantener las cuotas pagadas en el historial y en el disponible proyectado de su mes.
- **Sí:** versionar v3 por separado y preservar sin cambios el modelo v2.
- **No:** sincronizar con prestamistas o calcular deuda pendiente a partir de capital e intereses.
- **No:** eliminar cuotas pagadas ni recalcularlas al editar las cuotas futuras.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una actualización del modelo podría ocultar datos de pagos existentes. | Copiar v2 íntegra a v3 y dejar intacta la clave v2. |
| Marcar una cuota como pagada podría quitarla del disponible del mes. | Conservar cada cuota y calcular el disponible incluyendo estados pagados y pendientes. |
| El usuario espera que se calculen intereses del préstamo. | Capturar el importe real de cada cuota; excluir cálculos financieros automáticos de esta spec. |

## Qué **no** incluye esta spec

- Cálculo de intereses, capital pendiente, pagos parciales o cancelación anticipada.
- Integración bancaria o con prestamistas.
- Conversión de moneda o reparto distinto de las reglas de SPEC 02.
