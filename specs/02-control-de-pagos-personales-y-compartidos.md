# SPEC 02 — Control de pagos personales y compartidos

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-04
> **Objetivo:** Extender el dashboard para controlar ingresos y cuotas pendientes de Lisandro y Catriel, distribuir los pagos compartidos por mitades y mostrar el disponible mensual de cada uno.

## Alcance

**Dentro:**

- Mantener SPEC 01 como registro implementado y construir la nueva experiencia sobre la aplicación existente.
- Mostrar tres áreas en la misma pantalla: Lisandro a la izquierda, pagos compartidos en el centro y Catriel a la derecha.
- En móvil, apilar las áreas en este orden: Lisandro, compartido y Catriel.
- Registrar ingresos con fecha, descripción, importe y titular; un ingreso pertenece a Lisandro o Catriel.
- Controlar cuentas por pagar y cuotas, no compras cotidianas ni egresos generales.
- Crear pagos personales o compartidos. Un pago compartido se asigna 50% a cada persona.
- Registrar por separado quién es responsable del pago, quién lo paga y quién compró. El pagador puede ser Lisandro, Catriel o una persona externa identificada por nombre.
- No descontar del disponible del hogar una cuota cuyo pagador sea externo.
- Si el pago es compartido y se usa tarjeta, registrar la tarjeta de la persona compradora. Si no se usa tarjeta, pedir una persona compradora principal para resolver el resto de centavos.
- Mantener estas listas fijas de tarjetas:
  - **Lisandro:** Nación MasterCard, Naranja, Mercado Pago y Mercado Pagos S/Tarjeta.
  - **Catriel:** Nación Visa, Nación MasterCard, Macro Visa, Macro AMEX, Naranja, Mercado Pago y Mercado Pago S/Tarjeta.
- Al crear una compra en cuotas, capturar el importe de cada cuota, la cuota actual, el total de cuotas y la fecha de vencimiento inicial. Generar cuotas mensuales desde la actual hasta la última.
- Si un vencimiento cae en un día que no existe en el mes siguiente, usar el último día de ese mes.
- Marcar cada cuota como pendiente o pagada. El estado pagada no cambia el disponible proyectado del mes.
- Al editar un plan, actualizar la cuota actual y las cuotas futuras pendientes; conservar las cuotas ya pagadas.
- Al eliminar un plan sin cuotas pagadas, pedir confirmación. Si existen cuotas pagadas, cancelar las futuras pendientes y conservar el historial pagado.
- Mantener las categorías editables de SPEC 01 para ingresos y planes de pago.
- Mantener los saldos de ahorro y deuda por persona, separados y fuera de la fórmula de disponible mensual.
- Calcular, para el mes seleccionado, el disponible de cada persona como sus ingresos menos sus obligaciones personales y la mitad de las compartidas, estén pagadas o pendientes. Excluir las obligaciones pagadas por externos.
- Actualizar ese cálculo al navegar entre meses.
- Guardar el nuevo modelo en `finanzas-hogar:v2` con `schemaVersion: 2`. Si existe el modelo v1, conservarlo sin modificar y copiar únicamente su moneda a v2; no migrar ingresos, gastos ni saldos agregados. Si no existe una moneda anterior, solicitarla.
- Mantener exportación e importación JSON del conjunto v2 completo; validar el esquema y confirmar antes de reemplazar los datos.

**Fuera de alcance:**

- Apartado de préstamos; se define en SPEC 03.
- Registro de gastos diarios que no representen cuentas por pagar.
- Conexión bancaria, conversión de moneda o más integrantes.
- Edición de las listas fijas de tarjetas o porcentajes de reparto distintos de 50/50.
- Migración automática de movimientos, gastos o saldos agregados de SPEC 01 al nuevo modelo.

## Modelo de datos

Todos los importes son enteros en unidades menores de la moneda seleccionada. `responsibility` determina a quién se imputa el disponible. `payer` identifica quién paga realmente. Los pagos compartidos usan `buyerMemberId` para identificar a quien realizó la compra y asignarle cualquier centavo restante del reparto.

```js
const householdDataV2 = {
  schemaVersion: 2,
  settings: { currencyCode: "EUR" },
  members: [
    { id: "lisandro", name: "Lisandro" },
    { id: "catriel", name: "Catriel" }
  ],
  categories: [
    { id: "income-other", kind: "income", name: "Otros ingresos" },
    { id: "home", kind: "payment", name: "Hogar" }
  ],
  incomeEntries: [
    {
      id: "income-1",
      memberId: "lisandro",
      date: "2026-10-01",
      description: "Sueldo",
      amountMinor: 250000,
      categoryId: "income-other"
    }
  ],
  paymentPlans: [
    {
      id: "plan-1",
      description: "Compra compartida",
      categoryId: "home",
      responsibility: "shared",
      buyerMemberId: "catriel",
      cardName: "Nación Visa",
      payer: { kind: "member", memberId: "lisandro" },
      installments: [
        {
          id: "installment-1",
          number: 2,
          total: 6,
          dueDate: "2026-10-31",
          amountMinor: 12345,
          status: "pending"
        }
      ]
    }
  ],
  balances: {
    lisandro: { savingsMinor: 0, debtMinor: 0 },
    catriel: { savingsMinor: 0, debtMinor: 0 }
  }
};
```

`responsibility` admite `lisandro`, `catriel` o `shared`. `payer.kind` admite `member` o `external`; el segundo guarda un nombre. La tarjeta se selecciona únicamente de la lista de `buyerMemberId`, o queda vacía si no se usa tarjeta. Las cuotas se guardan individualmente con estado `pending` o `paid`.

El disponible mensual de cada persona se calcula a partir de sus ingresos y las cuotas vencidas en el mes seleccionado. Una obligación personal se imputa a su responsable; una compartida se divide en dos partes enteras y el centavo impar se asigna a `buyerMemberId`. Un pagador externo excluye la cuota del disponible de ambas personas. El estado pagado se conserva para el historial, pero no altera el cálculo proyectado.

## Plan de implementación

1. Extender `src/lib/storage.js` y `src/lib/storage.test.js` para crear y validar el modelo v2 bajo `finanzas-hogar:v2`. Conservar la clave v1 y copiar solamente su moneda.
2. Crear `src/lib/payments.js` y `src/lib/payments.test.js` para validar pagos, generar cuotas mensuales, editar solo cuotas pendientes y cancelar planes sin borrar cuotas pagadas.
3. Extender `src/lib/finance.js` y `src/lib/finance.test.js` con sumas de ingresos, obligaciones y disponible mensual por persona, incluida la división de pagos compartidos.
4. Actualizar `src/App.jsx` y `src/index.css` con las tres áreas, captura de ingresos y pagos, listas fijas de tarjetas, pagador externo, edición, estado de cuotas y saldos separados por persona.
5. Actualizar `src/lib/backup.js` y `src/lib/backup.test.js` para exportar e importar datos v2 completos; rechazar versiones incompatibles antes de pedir confirmación o reemplazar datos.

## Criterios de aceptación

- [x] `npm run dev`, `npm test` y `npm run build` terminan correctamente.
- [x] En escritorio aparecen Lisandro a la izquierda, compartido al centro y Catriel a la derecha; en móvil se apilan en ese orden sin desbordamiento horizontal.
- [x] Un ingreso requiere titular, fecha, descripción e importe y se suma solo a esa persona en el mes de su fecha.
- [x] Cada ingreso requiere una categoría de tipo `income` y cada plan una categoría de tipo `payment`.
- [x] Las tarjetas ofrecidas corresponden exactamente a la lista fija de la persona compradora.
- [x] Cada pago permite elegir responsable, comprador/tarjeta, pagador, cuota actual, cantidad total, importe por cuota y vencimiento inicial.
- [x] Un pago compartido imputa 50% a cada integrante y asigna el centavo impar a la persona compradora.
- [x] Un pago a cargo de una persona externa no reduce el disponible de Lisandro ni Catriel.
- [x] El plan genera cuotas mensuales desde la actual hasta la última y ajusta al fin de mes los días de vencimiento inexistentes.
- [x] Marcar una cuota como pagada conserva su registro y no cambia el disponible proyectado del mes.
- [x] Editar un plan cambia la cuota actual y las futuras pendientes, sin alterar cuotas pagadas.
- [x] Eliminar un plan con cuotas pagadas conserva el historial y cancela únicamente las futuras pendientes.
- [x] El disponible de cada persona equivale a sus ingresos menos sus pagos personales y la mitad de los compartidos del mes seleccionado.
- [x] Ahorro y deuda aparecen separados por persona y no cambian el cálculo del disponible.
- [x] Crear v2 conserva intactos los datos v1 y copia únicamente la moneda; no asigna titulares ni convierte gastos automáticamente.
- [x] Exportar e importar conserva el modelo v2 completo; JSON inválido o de versión incompatible no altera los datos actuales.
- [x] Las pruebas cubren cuotas, reparto, centavos, pagadores externos, cálculo mensual y validación/importación de v2.

## Decisiones

- **Sí:** crear SPEC 02 dependiente de SPEC 01; no reabrir el contrato ya implementado.
- **Sí:** mantener las categorías y los saldos de ahorro/deuda, ahora separados por persona.
- **Sí:** cada ingreso conserva su categoría y la referencia debe apuntar a una categoría de tipo `income`.
- **Sí:** registrar ingresos y cuentas por pagar, no gastos cotidianos.
- **Sí:** separar responsabilidad, comprador/tarjeta y pagador; el disponible se imputa por responsabilidad.
- **Sí:** mantener listas de tarjetas fijas y dividir pagos compartidos en partes iguales.
- **Sí:** copiar solo la moneda de v1 y preservar los demás datos v1 sin migrarlos.
- **No:** migrar automáticamente datos sin titular, usar porcentajes variables o restar al hogar pagos hechos por externos.
- **No:** incluir préstamos en esta entrega; se definen en SPEC 03.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los datos v1 no tienen titulares y no pueden asignarse sin criterio humano. | Conservar v1 intacta y comenzar v2 vacía, copiando solo la moneda. |
| El reparto exacto de centavos no siempre produce dos enteros iguales. | Asignar el centavo impar a la persona compradora y cubrirlo con pruebas. |
| Un vencimiento cae en un día inexistente del mes siguiente. | Usar el último día del mes correspondiente. |

## Qué **no** incluye esta spec

- Préstamos; se implementan mediante SPEC 03 después de esta spec.
- Gastos diarios o movimientos bancarios automáticos.
- Conversión de moneda, más integrantes, tarjetas configurables o repartos distintos de 50/50.
- Migración automática de ingresos, gastos o saldos v1.
