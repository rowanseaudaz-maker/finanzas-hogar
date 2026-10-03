# SPEC 01 — Dashboard de finanzas del hogar

> **Estado:** Aprobado
> **Depende de:** Ninguna
> **Fecha:** 2026-10-03
> **Objetivo:** Crear una aplicación web local para registrar manualmente las finanzas de un hogar y consultar sus ingresos, gastos, balance mensual y totales de ahorro y deuda.

## Alcance

**Dentro:**

- Aplicación web de un solo hogar, creada con React y Vite.
- Registro manual de ingresos y gastos, con fecha, descripción, importe y categoría; permitir crear, editar y borrar movimientos.
- Dashboard mensual con navegación entre meses y sumas de ingresos, gastos y balance neto (ingresos menos gastos).
- Categorías iniciales diferenciadas por tipo que se pueden editar y ampliar.
- Un total agregado de ahorro y otro de deuda, actualizados manualmente y mostrados aparte del balance mensual.
- Selección de una moneda ISO 4217 durante la configuración inicial.
- Persistencia en localStorage y respaldo mediante exportación e importación JSON; importar reemplaza los datos existentes solo después de una confirmación.
- Interfaz y datos utilizables en un solo dispositivo, sin cuenta de usuario.

**Fuera de alcance:**

- Conexión bancaria, importación de extractos y registro automático.
- Acceso compartido entre miembros, cuentas de usuario o sincronización entre dispositivos.
- Conversión o seguimiento simultáneo de varias monedas.
- Desglose de ahorros y deudas en cuentas, préstamos o movimientos individuales.
- Presupuestos por categoría, notificaciones y alojamiento en servidor.

## Modelo de datos

Los importes se almacenan como enteros en unidades menores de la moneda elegida para evitar errores de redondeo. El ejemplo usa USD solo como valor ilustrativo; la aplicación solicita la moneda al iniciar. Las categorías iniciales son editables.

```js
const householdData = {
  schemaVersion: 1,
  settings: {
    currencyCode: "USD"
  },
  categories: [
    { id: "income-other", kind: "income", name: "Otros ingresos" },
    { id: "expense-other", kind: "expense", name: "Otros gastos" }
  ],
  transactions: [
    {
      id: "transaction-id",
      kind: "expense",
      date: "2026-10-03",
      description: "Compra",
      amountMinor: 1250,
      categoryId: "expense-other"
    }
  ],
  balances: {
    savingsMinor: 0,
    debtMinor: 0
  }
};
```

`kind` solo admite `income` o `expense`; los importes de movimientos y saldos son no negativos. `currencyCode` es el código ISO 4217 seleccionado. El almacenamiento versionado usa la clave `finanzas-hogar:v1`; una importación debe validar `schemaVersion` antes de reemplazar los datos.

## Plan de implementación

1. Crear el proyecto React + Vite y scripts de desarrollo, build y Vitest en `package.json`; añadir `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx` y `src/index.css`. Dejar una pantalla funcional que arranque con `npm run dev` y compile con `npm run build`.
2. Añadir `src/lib/finance.js` y `src/lib/finance.test.js` para validar movimientos y calcular las sumas del mes seleccionado, el balance neto y el formato monetario. Mantener operativa la pantalla con datos iniciales.
3. Implementar en `src/App.jsx` y `src/index.css` la navegación mensual, el resumen, el alta/edición/borrado de movimientos, la edición de categorías, la selección de moneda y los totales manuales de ahorro y deuda.
4. Añadir `src/lib/storage.js` para cargar y persistir el estado con esquema versionado en localStorage. Mostrar un aviso explícito si el navegador no permite persistir; mantener la sesión actual en memoria sin afirmar que quedó guardada. Cubrir cálculos y persistencia con Vitest.
5. Añadir `src/lib/backup.js` para exportar el estado completo a JSON y validar importaciones antes de solicitar confirmación y reemplazar los datos. Cubrir importación válida, JSON inválido y versión no compatible con Vitest.

## Criterios de aceptación

- [ ] `npm run dev` abre la aplicación sin errores en consola y `npm run build` termina correctamente.
- [ ] En el primer inicio se solicita un código ISO 4217 y se usa para mostrar y formatear importes.
- [ ] El dashboard inicia en el mes actual; navegar a otro mes cambia el periodo de las sumas sin mezclar movimientos de meses distintos.
- [ ] El total de ingresos, el total de gastos y el balance mensual se calculan como ingresos, gastos e ingresos menos gastos, respectivamente.
- [ ] Se puede crear, editar y borrar un ingreso o gasto; cada cambio actualiza el dashboard del periodo correspondiente.
- [ ] Se pueden crear y editar categorías para ingresos y gastos, y asignarlas a movimientos del mismo tipo.
- [ ] Se pueden modificar los totales agregados de ahorro y deuda; esos valores no alteran el cálculo del balance mensual.
- [ ] Al recargar la aplicación se conservan moneda, categorías, movimientos y totales cuando localStorage está disponible.
- [ ] La exportación incluye el estado completo y su versión; una importación válida requiere confirmación antes de reemplazar el estado actual.
- [ ] Una importación inválida o de versión no compatible no modifica los datos existentes y muestra un error identificable.
- [ ] Las pruebas Vitest cubren los cálculos financieros y los casos válidos e inválidos de persistencia e importación.
- [ ] Si localStorage no está disponible, la aplicación informa que los cambios no persistirán al cerrar la sesión.

## Decisiones

- **Sí:** React + Vite y Vitest para la aplicación nueva y sus pruebas enfocadas.
- **Sí:** localStorage versionado y exportación/importación JSON para conservar y respaldar datos sin servidor.
- **Sí:** un hogar, una moneda elegida al inicio y acceso desde un solo dispositivo; mantiene acotado el MVP.
- **Sí:** ahorro y deuda como totales manuales separados de ingresos y gastos; se evita inventar un historial de movimientos para esos saldos.
- **Sí:** almacenar importes como unidades menores enteras para evitar errores de coma flotante.
- **No:** conexión bancaria, sincronización, multimoneda y desglose de saldos; requieren decisiones y alcance propios.
- **No:** la importación no combina registros; reemplaza solo tras validar el archivo y confirmar la acción.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El navegador bloquea o agota localStorage. | Avisar claramente y no presentar cambios de la sesión como persistidos. |
| Un archivo de respaldo está dañado o usa un esquema incompatible. | Validarlo antes de cambiar el estado y rechazarlo sin sobrescribir los datos actuales. |

## Qué **no** incluye esta spec

- Conexión bancaria ni importación de extractos.
- Uso compartido, cuentas de usuario ni sincronización entre dispositivos.
- Conversión multimoneda.
- Historial detallado de cuentas de ahorro o deudas.
- Presupuestos, alertas o servicios de servidor.
