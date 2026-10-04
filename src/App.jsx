import { useEffect, useRef, useState } from "react";
import {
  formatMinorAmount,
  getHouseholdMonthSummaryV2,
  getMonthSummary,
  parseAmountToMinor,
  validateTransaction,
} from "./lib/finance.js";
import {
  parseFinanceBackup,
  parseHouseholdBackupV2,
  serializeFinanceBackup,
  serializeHouseholdBackupV2,
} from "./lib/backup.js";
import { cancelPaymentPlan, createPaymentPlan, editPaymentPlan, PAYMENT_CARDS } from "./lib/payments.js";
import {
  loadFinanceData,
  loadHouseholdDataV2,
  saveFinanceData,
  saveHouseholdDataV2,
} from "./lib/storage.js";

function getCurrencyOptions() {
  const codes =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency")
      : ["ARS", "CAD", "CLP", "COP", "EUR", "GBP", "JPY", "MXN", "USD"];
  const names = new Intl.DisplayNames(["es-ES"], { type: "currency" });

  return codes
    .map((code) => ({ code, label: `${code} · ${names.of(code)}` }))
    .sort((first, second) => first.label.localeCompare(second.label, "es"));
}

const currencyOptions = getCurrencyOptions();

function getCurrentDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getCurrentMonthKey() {
  return getCurrentDateKey().slice(0, 7);
}

function shiftMonth(monthKey, amount) {
  const [year, month] = monthKey.split("-").map(Number);
  const shiftedDate = new Date(Date.UTC(year, month - 1 + amount, 1));
  const shiftedMonth = String(shiftedDate.getUTCMonth() + 1).padStart(2, "0");
  return `${shiftedDate.getUTCFullYear()}-${shiftedMonth}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${label[0].toLocaleUpperCase("es-ES")}${label.slice(1)}`;
}

function getDateLabel(dateKey) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function getAmountStep(currencyCode) {
  const fractionDigits = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits;
  return String(1 / 10 ** fractionDigits);
}

function formatMinorInput(amountMinor, currencyCode) {
  const fractionDigits = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits;
  const scale = 10n ** BigInt(fractionDigits);
  const amount = BigInt(amountMinor);
  const wholePart = amount / scale;
  const fractionPart = (amount % scale).toString().padStart(fractionDigits, "0").replace(/0+$/, "");
  return fractionPart ? `${wholePart}.${fractionPart}` : wholePart.toString();
}

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

function downloadFinanceBackup(financeData, serializer = serializeFinanceBackup) {
  const serializedData = serializer(financeData);
  const backupBlob = new Blob([serializedData], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(backupBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = `finanzas-hogar-${getCurrentDateKey()}.json`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Finanzas del hogar">
      <span className="brand-mark" aria-hidden="true">
        F
      </span>
      <span className="brand-name">
        <strong>Hogar</strong>
        <span>FINANZAS</span>
      </span>
    </a>
  );
}

function StorageNotice({ status }) {
  if (status === "available") return null;

  const message =
    status === "invalid"
      ? "Los datos guardados no se pudieron leer. Los cambios de esta sesión no se guardarán."
      : "No se pudo acceder al almacenamiento del navegador. Los cambios de esta sesión no se guardarán.";

  return (
    <div className="storage-notice" role="alert">
      {message}
    </div>
  );
}

function DialogFrame({ title, titleId, onClose, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function handleCancel(event) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button dialog-close" type="button" aria-label="Cerrar" title="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

function CurrencySetup({ selectedCurrency, onCurrencyChange, onSubmit, persistenceStatus }) {
  return (
    <main className="setup-workspace">
      <StorageNotice status={persistenceStatus} />
      <div className="setup-heading">
        <p className="eyebrow">CONFIGURACIÓN INICIAL</p>
        <h1>Moneda del hogar</h1>
      </div>
      <form className="setup-form" onSubmit={onSubmit}>
        <label className="field" htmlFor="household-currency">
          <span>Moneda ISO 4217</span>
          <select
            id="household-currency"
            autoComplete="off"
            value={selectedCurrency}
            onChange={(event) => onCurrencyChange(event.target.value)}
            required
          >
            <option value="">Selecciona una moneda</option>
            {currencyOptions.map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={!selectedCurrency}>
          Continuar
        </button>
      </form>
    </main>
  );
}

function SummaryCard({ label, amountMinor, currencyCode, tone, detail }) {
  return (
    <article className={`summary-item ${tone}`}>
      <p>{label}</p>
      <strong>{formatMinorAmount(amountMinor, currencyCode)}</strong>
      <span>{detail}</span>
    </article>
  );
}

function BalanceEditor({ label, amountMinor, currencyCode, onSave, idPrefix = label }) {
  const [amount, setAmount] = useState(() => formatMinorInput(amountMinor, currencyCode));
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount(formatMinorInput(amountMinor, currencyCode));
  }, [amountMinor, currencyCode]);

  function handleSubmit(event) {
    event.preventDefault();
    try {
      onSave(parseAmountToMinor(amount, currencyCode));
      setError("");
    } catch {
      setError("Revisa el importe y la precisión decimal de la moneda.");
    }
  }

  const inputId = `balance-${idPrefix.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <article className="balance-editor">
      <div className="balance-current">
        <p className="eyebrow">{label}</p>
        <strong>{formatMinorAmount(amountMinor, currencyCode)}</strong>
      </div>
      <form className="balance-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor={inputId}>
          <span>Actualizar total</span>
          <input
            id={inputId}
            type="number"
            min="0"
            step={getAmountStep(currencyCode)}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <button className="secondary-button" type="submit">
          Guardar
        </button>
        {error && <p className="field-error" role="alert">{error}</p>}
      </form>
    </article>
  );
}

function TransactionDialog({
  initialTransaction,
  categories,
  currencyCode,
  onClose,
  onSave,
  onManageCategories,
}) {
  const [kind, setKind] = useState(initialTransaction?.kind ?? "expense");
  const [date, setDate] = useState(initialTransaction?.date ?? getCurrentDateKey());
  const [description, setDescription] = useState(initialTransaction?.description ?? "");
  const [amount, setAmount] = useState(
    initialTransaction ? formatMinorInput(initialTransaction.amountMinor, currencyCode) : "",
  );
  const [categoryId, setCategoryId] = useState(
    initialTransaction?.categoryId ?? categories.find((category) => category.kind === kind)?.id ?? "",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!categories.some((category) => category.id === categoryId && category.kind === kind)) {
      setCategoryId(categories.find((category) => category.kind === kind)?.id ?? "");
    }
  }, [categories, categoryId, kind]);

  function handleKindChange(nextKind) {
    setKind(nextKind);
    setCategoryId(categories.find((category) => category.kind === nextKind)?.id ?? "");
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    let amountMinor;
    try {
      amountMinor = parseAmountToMinor(amount, currencyCode);
    } catch {
      setError("Introduce un importe válido con la precisión admitida por la moneda.");
      return;
    }

    const transaction = {
      id: initialTransaction?.id ?? createId("transaction"),
      kind,
      date,
      description: description.trim(),
      amountMinor,
      categoryId,
    };
    const validation = validateTransaction(transaction, categories);

    if (!validation.valid) {
      setError("Completa los campos y elige una categoría del mismo tipo.");
      return;
    }

    onSave(transaction);
  }

  const matchingCategories = categories.filter((category) => category.kind === kind);
  const amountStep = getAmountStep(currencyCode);

  return (
    <DialogFrame
      title={initialTransaction ? "Editar movimiento" : "Nuevo movimiento"}
      titleId="transaction-dialog-title"
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <div className="field">
          <span>Tipo</span>
          <div className="segmented-control" role="group" aria-label="Tipo de movimiento">
            <button
              className={kind === "income" ? "is-selected" : ""}
              type="button"
              aria-pressed={kind === "income"}
              onClick={() => handleKindChange("income")}
            >
              Ingreso
            </button>
            <button
              className={kind === "expense" ? "is-selected" : ""}
              type="button"
              aria-pressed={kind === "expense"}
              onClick={() => handleKindChange("expense")}
            >
              Gasto
            </button>
          </div>
        </div>

        <label className="field" htmlFor="transaction-description">
          <span>Descripción</span>
          <input
            id="transaction-description"
            type="text"
            maxLength="80"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>

        <div className="form-row">
          <label className="field" htmlFor="transaction-amount">
            <span>Importe ({currencyCode})</span>
            <input
              id="transaction-amount"
              type="number"
              min="0"
              step={amountStep}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="transaction-date">
            <span>Fecha</span>
            <input
              id="transaction-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="field" htmlFor="transaction-category">
          <span>Categoría</span>
          <select
            id="transaction-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {matchingCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <button className="text-button" type="button" onClick={onManageCategories}>
          Editar categorías
        </button>

        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            Guardar movimiento
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function CategoryDialog({ categories, onClose, onSave }) {
  const [kind, setKind] = useState("payment");
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const matchingCategories = categories.filter((category) => category.kind === kind);

  function selectKind(nextKind) {
    setKind(nextKind);
    setEditingId(null);
    setName("");
    setError("");
  }

  function beginNewCategory() {
    setEditingId(null);
    setName("");
    setError("");
  }

  function beginEdit(category) {
    setEditingId(category.id);
    setName(category.name);
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const normalizedName = name.trim();

    if (!normalizedName) {
      setError("Escribe un nombre para la categoría.");
      return;
    }

    const duplicate = matchingCategories.some(
      (category) => category.id !== editingId && category.name.toLocaleLowerCase("es-ES") === normalizedName.toLocaleLowerCase("es-ES"),
    );

    if (duplicate) {
      setError("Ya existe una categoría con ese nombre.");
      return;
    }

    onSave({
      id: editingId ?? createId("category"),
      kind,
      name: normalizedName,
    });
    setEditingId(null);
    setName("");
    setError("");
  }

  return (
    <DialogFrame title="Categorías" titleId="category-dialog-title" onClose={onClose}>
      <div className="category-dialog-content">
        <div className="category-toolbar">
          <div className="segmented-control" role="group" aria-label="Tipo de categoría">
            <button
              className={kind === "income" ? "is-selected" : ""}
              type="button"
              aria-pressed={kind === "income"}
              onClick={() => selectKind("income")}
            >
              Ingresos
            </button>
            <button
              className={kind === "payment" ? "is-selected" : ""}
              type="button"
              aria-pressed={kind === "payment"}
              onClick={() => selectKind("payment")}
            >
              Pagos
            </button>
          </div>
          <button className="secondary-button" type="button" onClick={beginNewCategory}>
            + Nueva
          </button>
        </div>

        <ul className="category-list">
          {matchingCategories.map((category) => (
            <li key={category.id}>
              <span>{category.name}</span>
              <button className="text-button" type="button" onClick={() => beginEdit(category)}>
                Editar
              </button>
            </li>
          ))}
        </ul>

        <form className="category-form" onSubmit={handleSubmit}>
          <label className="field" htmlFor="category-name">
            <span>{editingId ? "Nombre de categoría" : "Nueva categoría"}</span>
            <input
              id="category-name"
              type="text"
              maxLength="40"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="category-form-actions">
            {editingId && (
              <button className="text-button" type="button" onClick={beginNewCategory}>
                Cancelar edición
              </button>
            )}
            <button className="primary-button" type="submit">
              {editingId ? "Guardar cambios" : "Añadir categoría"}
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}

function BackupDialog({
  financeData,
  onClose,
  onImport,
  parser = parseFinanceBackup,
  serializer = serializeFinanceBackup,
}) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  async function handleFileChange(event) {
    const fileInput = event.currentTarget;
    const backupFile = fileInput.files?.[0];
    if (!backupFile) return;

    setError("");
    let serializedData;
    try {
      serializedData = await backupFile.text();
    } catch {
      setError("No se pudo leer el archivo seleccionado.");
      fileInput.value = "";
      return;
    }

    fileInput.value = "";
    const result = parser(serializedData);
    if (!result.valid) {
      const errorMessages = {
        "invalid-json": "El archivo no contiene JSON válido.",
        "unsupported-version": "La versión de este respaldo no es compatible.",
        "invalid-data": "La estructura del archivo no coincide con un respaldo válido.",
      };
      setError(errorMessages[result.error]);
      return;
    }

    const confirmed = window.confirm(
      "Importar este respaldo reemplazará todos los datos actuales. ¿Quieres continuar?",
    );
    if (confirmed) onImport(result.data);
  }

  function handleExport() {
    try {
      downloadFinanceBackup(financeData, serializer);
      setError("");
    } catch {
      setError("No se pudo preparar el archivo de respaldo.");
    }
  }

  return (
    <DialogFrame title="Respaldo" titleId="backup-dialog-title" onClose={onClose}>
      <div className="backup-dialog-content">
        <div className="backup-actions">
          <button className="primary-button" type="button" onClick={handleExport}>
            Exportar JSON
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            Importar JSON
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            aria-label="Archivo de respaldo JSON"
            onChange={handleFileChange}
          />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </DialogFrame>
  );
}

function Dashboard({ financeData, setFinanceData, monthKey, setMonthKey, persistenceStatus }) {
  const [transactionEditor, setTransactionEditor] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const currencyCode = financeData.settings.currencyCode;
  const monthTransactions = financeData.transactions
    .filter((transaction) => transaction.date.slice(0, 7) === monthKey)
    .sort((first, second) => second.date.localeCompare(first.date));
  const summary = getMonthSummary(financeData.transactions, monthKey);

  function saveTransaction(transaction) {
    setFinanceData((currentData) => {
      const transactionExists = currentData.transactions.some((item) => item.id === transaction.id);
      return {
        ...currentData,
        transactions: transactionExists
          ? currentData.transactions.map((item) => (item.id === transaction.id ? transaction : item))
          : [...currentData.transactions, transaction],
      };
    });
    setTransactionEditor(null);
  }

  function deleteTransaction(transaction) {
    const confirmed = window.confirm(`¿Eliminar el movimiento «${transaction.description}»?`);
    if (!confirmed) return;

    setFinanceData((currentData) => ({
      ...currentData,
      transactions: currentData.transactions.filter((item) => item.id !== transaction.id),
    }));
  }

  function saveCategory(category) {
    setFinanceData((currentData) => {
      const categoryExists = currentData.categories.some((item) => item.id === category.id);
      return {
        ...currentData,
        categories: categoryExists
          ? currentData.categories.map((item) => (item.id === category.id ? category : item))
          : [...currentData.categories, category],
      };
    });
  }

  function saveBalance(balanceKey, amountMinor) {
    setFinanceData((currentData) => ({
      ...currentData,
      balances: { ...currentData.balances, [balanceKey]: amountMinor },
    }));
  }

  function importBackup(importedData) {
    setFinanceData(importedData);
    setBackupDialogOpen(false);
    setBackupMessage("Respaldo importado correctamente.");
  }

  function updateMonth(amount) {
    setMonthKey((currentMonth) => shiftMonth(currentMonth, amount));
  }

  return (
    <>
      <main className="workspace">
        <StorageNotice status={persistenceStatus} />
        {backupMessage && (
          <div className="success-notice" role="status">
            <span>{backupMessage}</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Cerrar aviso"
              title="Cerrar aviso"
              onClick={() => setBackupMessage("")}
            >
              ×
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>
            <p className="eyebrow">FINANZAS DEL HOGAR</p>
            <h1>Resumen mensual</h1>
          </div>
          <div className="page-actions">
            <button className="secondary-button" type="button" onClick={() => setCategoryDialogOpen(true)}>
              Categorías
            </button>
            <button className="secondary-button" type="button" onClick={() => setBackupDialogOpen(true)}>
              Respaldo
            </button>
            <button className="primary-button" type="button" onClick={() => setTransactionEditor({ transaction: null })}>
              <span aria-hidden="true">+</span> Movimiento
            </button>
          </div>
        </div>

        <div className="month-switcher" aria-label="Periodo del resumen">
          <button
            className="icon-button"
            type="button"
            aria-label="Mes anterior"
            title="Mes anterior"
            onClick={() => updateMonth(-1)}
          >
            ‹
          </button>
          <strong>{getMonthLabel(monthKey)}</strong>
          <button
            className="icon-button"
            type="button"
            aria-label="Mes siguiente"
            title="Mes siguiente"
            onClick={() => updateMonth(1)}
          >
            ›
          </button>
        </div>

        <section className="summary-grid" aria-label="Resumen financiero">
          <SummaryCard
            label="Ingresos"
            amountMinor={summary.incomeMinor}
            currencyCode={currencyCode}
            tone="income-item"
            detail="Este mes"
          />
          <SummaryCard
            label="Gastos"
            amountMinor={summary.expenseMinor}
            currencyCode={currencyCode}
            tone="expense-item"
            detail="Este mes"
          />
          <SummaryCard
            label="Balance"
            amountMinor={summary.balanceMinor}
            currencyCode={currencyCode}
            tone="balance-item"
            detail="Ingresos menos gastos"
          />
        </section>

        <section className="balances-section" aria-labelledby="balances-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TOTALES MANUALES</p>
              <h2 id="balances-title">Ahorros y deudas</h2>
            </div>
          </div>
          <div className="balances-grid">
            <BalanceEditor
              label="Ahorro total"
              amountMinor={financeData.balances.savingsMinor}
              currencyCode={currencyCode}
              onSave={(amountMinor) => saveBalance("savingsMinor", amountMinor)}
            />
            <BalanceEditor
              label="Deuda total"
              amountMinor={financeData.balances.debtMinor}
              currencyCode={currencyCode}
              onSave={(amountMinor) => saveBalance("debtMinor", amountMinor)}
            />
          </div>
        </section>

        <section className="activity-section" aria-labelledby="activity-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DETALLE</p>
              <h2 id="activity-title">Movimientos</h2>
            </div>
            <span className="count-label">
              {monthTransactions.length} {monthTransactions.length === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>
          {monthTransactions.length ? (
            <ul className="transaction-list">
              {monthTransactions.map((transaction) => {
                const category = financeData.categories.find((item) => item.id === transaction.categoryId);
                const signedAmount = `${transaction.kind === "expense" ? "−" : "+"}${formatMinorAmount(
                  transaction.amountMinor,
                  currencyCode,
                )}`;

                return (
                  <li className="transaction-row" key={transaction.id}>
                    <span className={`transaction-mark ${transaction.kind}`} aria-hidden="true">
                      {transaction.kind === "expense" ? "−" : "+"}
                    </span>
                    <div className="transaction-details">
                      <strong>{transaction.description}</strong>
                      <span>
                        {getDateLabel(transaction.date)} · {category?.name ?? "Sin categoría"}
                      </span>
                    </div>
                    <strong className={`transaction-amount ${transaction.kind}`}>{signedAmount}</strong>
                    <div className="transaction-actions">
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setTransactionEditor({ transaction })}
                      >
                        Editar
                      </button>
                      <button className="text-button danger-text" type="button" onClick={() => deleteTransaction(transaction)}>
                        Eliminar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="empty-mark" aria-hidden="true">
                0
              </span>
              <p>{financeData.transactions.length ? "Sin movimientos en este mes" : "Sin movimientos registrados"}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <span>FINANZAS DEL HOGAR</span>
        <span>{currencyCode} · USO PERSONAL</span>
      </footer>

      {transactionEditor && (
        <TransactionDialog
          initialTransaction={transactionEditor.transaction}
          categories={financeData.categories}
          currencyCode={currencyCode}
          onClose={() => setTransactionEditor(null)}
          onSave={saveTransaction}
          onManageCategories={() => setCategoryDialogOpen(true)}
        />
      )}
      {categoryDialogOpen && (
        <CategoryDialog
          categories={financeData.categories}
          onClose={() => setCategoryDialogOpen(false)}
          onSave={saveCategory}
        />
      )}
      {backupDialogOpen && (
        <BackupDialog
          financeData={financeData}
          onClose={() => setBackupDialogOpen(false)}
          onImport={importBackup}
        />
      )}
    </>
  );
}

function IncomeDialog({ initialIncome, categories, currencyCode, onClose, onSave }) {
  const [memberId, setMemberId] = useState(initialIncome?.memberId ?? "lisandro");
  const [date, setDate] = useState(initialIncome?.date ?? getCurrentDateKey());
  const [description, setDescription] = useState(initialIncome?.description ?? "");
  const [amount, setAmount] = useState(
    initialIncome ? formatMinorInput(initialIncome.amountMinor, currencyCode) : "",
  );
  const [categoryId, setCategoryId] = useState(
    initialIncome?.categoryId ?? categories.find((category) => category.kind === "income")?.id ?? "",
  );
  const [error, setError] = useState("");
  const incomeCategories = categories.filter((category) => category.kind === "income");

  useEffect(() => {
    if (!incomeCategories.some((category) => category.id === categoryId)) {
      setCategoryId(incomeCategories[0]?.id ?? "");
    }
  }, [categoryId, incomeCategories]);

  function handleSubmit(event) {
    event.preventDefault();

    let amountMinor;
    try {
      amountMinor = parseAmountToMinor(amount, currencyCode);
    } catch {
      setError("Introduce un importe válido con la precisión admitida por la moneda.");
      return;
    }

    const incomeEntry = {
      id: initialIncome?.id ?? createId("income"),
      memberId,
      date,
      description: description.trim(),
      amountMinor,
      categoryId,
    };

    if (!incomeEntry.description || !incomeCategories.some((category) => category.id === categoryId)) {
      setError("Completa la descripción y selecciona una categoría de ingreso.");
      return;
    }

    onSave(incomeEntry);
  }

  return (
    <DialogFrame
      title={initialIncome ? "Editar ingreso" : "Nuevo ingreso"}
      titleId="income-dialog-title"
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="income-member">
          <span>Integrante</span>
          <select id="income-member" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="lisandro">Lisandro</option>
            <option value="catriel">Catriel</option>
          </select>
        </label>
        <label className="field" htmlFor="income-description">
          <span>Descripción</span>
          <input
            id="income-description"
            type="text"
            maxLength="80"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <div className="form-row">
          <label className="field" htmlFor="income-amount">
            <span>Importe ({currencyCode})</span>
            <input
              id="income-amount"
              type="number"
              min="0"
              step={getAmountStep(currencyCode)}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="income-date">
            <span>Fecha</span>
            <input
              id="income-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field" htmlFor="income-category">
          <span>Categoría</span>
          <select
            id="income-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {incomeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            Guardar ingreso
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function PaymentPlanDialog({ initialPlan, categories, currencyCode, onClose, onSave }) {
  const firstPending = initialPlan?.installments.find((installment) => installment.status === "pending");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    initialPlan?.categoryId ?? categories.find((category) => category.kind === "payment")?.id ?? "",
  );
  const [responsibility, setResponsibility] = useState(initialPlan?.responsibility ?? "lisandro");
  const [buyerMemberId, setBuyerMemberId] = useState(
    initialPlan?.buyerMemberId ?? "lisandro",
  );
  const [cardName, setCardName] = useState(initialPlan?.cardName ?? "");
  const [payerKind, setPayerKind] = useState(initialPlan?.payer.kind ?? "member");
  const [payerMemberId, setPayerMemberId] = useState(initialPlan?.payer.memberId ?? "lisandro");
  const [externalPayerName, setExternalPayerName] = useState(initialPlan?.payer.name ?? "");
  const [currentInstallment, setCurrentInstallment] = useState(String(firstPending?.number ?? 1));
  const [totalInstallments, setTotalInstallments] = useState(String(firstPending?.total ?? 1));
  const [firstDueDate, setFirstDueDate] = useState(firstPending?.dueDate ?? getCurrentDateKey());
  const [amount, setAmount] = useState(
    firstPending ? formatMinorInput(firstPending.amountMinor, currencyCode) : "",
  );
  const [error, setError] = useState("");
  const paymentCategories = categories.filter((category) => category.kind === "payment");
  const buyerCards = PAYMENT_CARDS[buyerMemberId] ?? [];

  useEffect(() => {
    if (!buyerCards.includes(cardName)) setCardName("");
  }, [buyerCards, cardName]);

  function handleResponsibilityChange(nextResponsibility) {
    setResponsibility(nextResponsibility);
    if (nextResponsibility !== "shared") {
      setBuyerMemberId(nextResponsibility);
      setCardName("");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    let amountMinor;
    try {
      amountMinor = parseAmountToMinor(amount, currencyCode);
    } catch {
      setError("Introduce un importe válido con la precisión admitida por la moneda.");
      return;
    }

    const payer =
      payerKind === "external"
        ? { kind: "external", name: externalPayerName.trim() }
        : { kind: "member", memberId: payerMemberId };
    const paymentInput = {
      description: description.trim(),
      categoryId,
      responsibility,
      buyerMemberId,
      cardName: cardName || null,
      payer,
      currentInstallment: Number(currentInstallment),
      totalInstallments: Number(totalInstallments),
      firstDueDate,
      amountMinor,
    };

    try {
      if (initialPlan) {
        const result = editPaymentPlan(initialPlan, paymentInput, categories);
        if (!result.valid) {
          setError("El total de cuotas no puede eliminar cuotas ya pagadas.");
          return;
        }
        onSave(result.plan);
      } else {
        onSave(createPaymentPlan(paymentInput, categories));
      }
    } catch {
      setError("Revisa los datos, la tarjeta y las cuotas del plan.");
    }
  }

  return (
    <DialogFrame
      title={initialPlan ? "Editar plan de pago" : "Nuevo plan de pago"}
      titleId="payment-plan-dialog-title"
      onClose={onClose}
    >
      <form className="dialog-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="payment-description">
          <span>Descripción</span>
          <input
            id="payment-description"
            type="text"
            maxLength="80"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <label className="field" htmlFor="payment-category">
          <span>Categoría</span>
          <select
            id="payment-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {paymentCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="payment-responsibility">
          <span>Responsable</span>
          <select
            id="payment-responsibility"
            value={responsibility}
            onChange={(event) => handleResponsibilityChange(event.target.value)}
          >
            <option value="lisandro">Lisandro</option>
            <option value="shared">Compartido · 50% cada uno</option>
            <option value="catriel">Catriel</option>
          </select>
        </label>
        <div className="form-row">
          <label className="field" htmlFor="payment-buyer">
            <span>Persona compradora</span>
            <select
              id="payment-buyer"
              value={buyerMemberId}
              disabled={responsibility !== "shared"}
              onChange={(event) => {
                setBuyerMemberId(event.target.value);
                setCardName("");
              }}
            >
              <option value="lisandro">Lisandro</option>
              <option value="catriel">Catriel</option>
            </select>
          </label>
          <label className="field" htmlFor="payment-card">
            <span>Tarjeta</span>
            <select id="payment-card" value={cardName} onChange={(event) => setCardName(event.target.value)}>
              <option value="">Sin tarjeta</option>
              {buyerCards.map((card) => (
                <option key={card} value={card}>
                  {card}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="field" htmlFor="payment-payer-kind">
            <span>Quién paga</span>
            <select id="payment-payer-kind" value={payerKind} onChange={(event) => setPayerKind(event.target.value)}>
              <option value="member">Integrante</option>
              <option value="external">Externo</option>
            </select>
          </label>
          {payerKind === "member" ? (
            <label className="field" htmlFor="payment-payer-member">
              <span>Pagador</span>
              <select
                id="payment-payer-member"
                value={payerMemberId}
                onChange={(event) => setPayerMemberId(event.target.value)}
              >
                <option value="lisandro">Lisandro</option>
                <option value="catriel">Catriel</option>
              </select>
            </label>
          ) : (
            <label className="field" htmlFor="payment-payer-name">
              <span>Nombre del pagador</span>
              <input
                id="payment-payer-name"
                type="text"
                value={externalPayerName}
                onChange={(event) => setExternalPayerName(event.target.value)}
                required
              />
            </label>
          )}
        </div>
        <div className="form-row payment-installments-row">
          <label className="field" htmlFor="payment-current-installment">
            <span>Cuota actual</span>
            <input
              id="payment-current-installment"
              type="number"
              min={firstPending?.number ?? 1}
              max={totalInstallments}
              value={currentInstallment}
              disabled={Boolean(initialPlan)}
              onChange={(event) => setCurrentInstallment(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="payment-total-installments">
            <span>Total de cuotas</span>
            <input
              id="payment-total-installments"
              type="number"
              min={currentInstallment}
              value={totalInstallments}
              onChange={(event) => setTotalInstallments(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="payment-amount">
            <span>Importe de cada cuota ({currencyCode})</span>
            <input
              id="payment-amount"
              type="number"
              min="0"
              step={getAmountStep(currencyCode)}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field" htmlFor="payment-first-due-date">
          <span>Fecha de vencimiento</span>
          <input
            id="payment-first-due-date"
            type="date"
            value={firstDueDate}
            onChange={(event) => setFirstDueDate(event.target.value)}
            required
          />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            Guardar plan
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function IncomeEntries({ entries, categories, currencyCode, onEdit, onDelete }) {
  if (entries.length === 0) {
    return <p className="panel-empty">Sin ingresos registrados este mes</p>;
  }

  return (
    <ul className="panel-entry-list income-entry-list">
      {entries.map((entry) => {
        const category = categories.find((item) => item.id === entry.categoryId);
        return (
          <li className="income-entry" key={entry.id}>
            <div className="entry-copy">
              <strong>{entry.description}</strong>
              <span>{getDateLabel(entry.date)} · {category?.name ?? "Sin categoría"}</span>
            </div>
            <strong className="income-value">{formatMinorAmount(entry.amountMinor, currencyCode)}</strong>
            <div className="entry-actions">
              <button className="text-button" type="button" onClick={() => onEdit(entry)}>
                Editar
              </button>
              <button className="text-button danger-text" type="button" onClick={() => onDelete(entry)}>
                Eliminar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PaymentEntries({ entries, categories, currencyCode, onEdit, onMarkPaid, onCancel }) {
  if (entries.length === 0) {
    return <p className="panel-empty">Sin pagos para este mes</p>;
  }

  return (
    <ul className="panel-entry-list payment-entry-list">
      {entries.map(({ plan, installment }) => {
        const category = categories.find((item) => item.id === plan.categoryId);
        const payerName =
          plan.payer.kind === "external"
            ? plan.payer.name
            : plan.payer.memberId === "lisandro"
              ? "Lisandro"
              : "Catriel";
        const hasPendingInstallments = plan.installments.some((item) => item.status === "pending");

        return (
          <li className={`payment-entry ${installment.status}`} key={installment.id}>
            <div className="entry-copy">
              <div className="payment-entry-title">
                <strong>{plan.description}</strong>
                <span className={`status-pill ${installment.status}`}>
                  {installment.status === "paid" ? "Pagada" : "Pendiente"}
                </span>
              </div>
              <span>
                {getDateLabel(installment.dueDate)} · Cuota {installment.number}/{installment.total}
              </span>
              <span>
                {category?.name ?? "Sin categoría"} · {plan.cardName ?? "Sin tarjeta"} · Paga {payerName}
              </span>
            </div>
            <strong className="payment-value">{formatMinorAmount(installment.amountMinor, currencyCode)}</strong>
            <div className="entry-actions payment-entry-actions">
              {installment.status === "pending" && (
                <button className="text-button" type="button" onClick={() => onMarkPaid(plan, installment)}>
                  Marcar pagada
                </button>
              )}
              {hasPendingInstallments && (
                <button className="text-button" type="button" onClick={() => onEdit(plan)}>
                  Editar
                </button>
              )}
              {hasPendingInstallments && (
                <button className="text-button danger-text" type="button" onClick={() => onCancel(plan)}>
                  Cancelar plan
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberPanel({
  memberId,
  data,
  summary,
  incomeEntries,
  paymentEntries,
  currencyCode,
  onAddIncome,
  onEditIncome,
  onDeleteIncome,
  onEditPayment,
  onMarkPaid,
  onCancelPlan,
  onSaveBalance,
}) {
  const memberName = memberId === "lisandro" ? "Lisandro" : "Catriel";
  const memberSummary = summary.members[memberId];

  return (
    <section className={`household-panel member-panel ${memberId}-panel`} aria-labelledby={`${memberId}-title`}>
      <header className="household-panel-header member-panel-header">
        <p className="eyebrow">FINANZAS PERSONALES</p>
        <h2 id={`${memberId}-title`}>{memberName}</h2>
        <div className="available-readout">
          <span>Disponible del mes</span>
          <strong>{formatMinorAmount(memberSummary.availableMinor, currencyCode)}</strong>
        </div>
      </header>
      <div className="member-stats">
        <div>
          <span>Ingresos</span>
          <strong>{formatMinorAmount(memberSummary.incomeMinor, currencyCode)}</strong>
        </div>
        <div>
          <span>Pagos imputados</span>
          <strong>{formatMinorAmount(memberSummary.paymentsMinor, currencyCode)}</strong>
        </div>
      </div>
      <section className="panel-section" aria-labelledby={`${memberId}-income-title`}>
        <div className="panel-section-heading">
          <h3 id={`${memberId}-income-title`}>Ingresos</h3>
          <button className="text-button" type="button" onClick={() => onAddIncome(memberId)}>
            + Añadir
          </button>
        </div>
        <IncomeEntries
          entries={incomeEntries}
          categories={data.categories}
          currencyCode={currencyCode}
          onEdit={onEditIncome}
          onDelete={onDeleteIncome}
        />
      </section>
      <section className="panel-section" aria-labelledby={`${memberId}-payments-title`}>
        <div className="panel-section-heading">
          <h3 id={`${memberId}-payments-title`}>Pagos personales</h3>
        </div>
        <PaymentEntries
          entries={paymentEntries}
          categories={data.categories}
          currencyCode={currencyCode}
          onEdit={onEditPayment}
          onMarkPaid={onMarkPaid}
          onCancel={onCancelPlan}
        />
      </section>
      <section className="panel-section member-balance-section" aria-label={`Ahorro y deuda de ${memberName}`}>
        <div className="panel-section-heading">
          <h3>Ahorro y deuda</h3>
        </div>
        <div className="member-balance-grid">
          <BalanceEditor
            label="Ahorro"
            idPrefix={`${memberId}-savings`}
            amountMinor={data.balances[memberId].savingsMinor}
            currencyCode={currencyCode}
            onSave={(amountMinor) => onSaveBalance(memberId, "savingsMinor", amountMinor)}
          />
          <BalanceEditor
            label="Deuda"
            idPrefix={`${memberId}-debt`}
            amountMinor={data.balances[memberId].debtMinor}
            currencyCode={currencyCode}
            onSave={(amountMinor) => onSaveBalance(memberId, "debtMinor", amountMinor)}
          />
        </div>
      </section>
    </section>
  );
}

function SharedPanel({ entries, categories, currencyCode, sharedCommitmentsMinor, onEdit, onMarkPaid, onCancel }) {
  return (
    <section className="household-panel shared-panel" aria-labelledby="shared-title">
      <header className="household-panel-header shared-panel-header">
        <p className="eyebrow">RESPONSABILIDAD CONJUNTA</p>
        <h2 id="shared-title">Compartido</h2>
        <div className="available-readout shared-total">
          <span>Compromisos del mes</span>
          <strong>{formatMinorAmount(sharedCommitmentsMinor, currencyCode)}</strong>
        </div>
        <p className="shared-rule">Se imputa 50% a cada uno</p>
      </header>
      <section className="panel-section shared-payment-section" aria-labelledby="shared-payments-title">
        <div className="panel-section-heading">
          <h3>Pagos compartidos</h3>
        </div>
        <PaymentEntries
          entries={entries}
          categories={categories}
          currencyCode={currencyCode}
          onEdit={onEdit}
          onMarkPaid={onMarkPaid}
          onCancel={onCancel}
        />
      </section>
    </section>
  );
}

function HouseholdDashboard({ data, setData, monthKey, setMonthKey, persistenceStatus }) {
  const [incomeEditor, setIncomeEditor] = useState(null);
  const [paymentEditor, setPaymentEditor] = useState(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const currencyCode = data.settings.currencyCode;
  const summary = getHouseholdMonthSummaryV2(data, monthKey);

  function getMonthPayments(responsibility) {
    return data.paymentPlans
      .filter((plan) => plan.responsibility === responsibility)
      .flatMap((plan) =>
        plan.installments
          .filter((installment) => installment.dueDate.slice(0, 7) === monthKey)
          .map((installment) => ({ plan, installment })),
      )
      .sort((first, second) => first.installment.dueDate.localeCompare(second.installment.dueDate));
  }

  const lisandroIncome = data.incomeEntries
    .filter((entry) => entry.memberId === "lisandro" && entry.date.slice(0, 7) === monthKey)
    .sort((first, second) => second.date.localeCompare(first.date));
  const catrielIncome = data.incomeEntries
    .filter((entry) => entry.memberId === "catriel" && entry.date.slice(0, 7) === monthKey)
    .sort((first, second) => second.date.localeCompare(first.date));
  const lisandroPayments = getMonthPayments("lisandro");
  const sharedPayments = getMonthPayments("shared");
  const catrielPayments = getMonthPayments("catriel");

  function saveIncomeEntry(incomeEntry) {
    setData((currentData) => {
      const exists = currentData.incomeEntries.some((entry) => entry.id === incomeEntry.id);
      return {
        ...currentData,
        incomeEntries: exists
          ? currentData.incomeEntries.map((entry) => (entry.id === incomeEntry.id ? incomeEntry : entry))
          : [...currentData.incomeEntries, incomeEntry],
      };
    });
    setIncomeEditor(null);
  }

  function deleteIncomeEntry(incomeEntry) {
    if (!window.confirm(`¿Eliminar el ingreso «${incomeEntry.description}»?`)) return;
    setData((currentData) => ({
      ...currentData,
      incomeEntries: currentData.incomeEntries.filter((entry) => entry.id !== incomeEntry.id),
    }));
  }

  function savePaymentPlan(paymentPlan) {
    setData((currentData) => {
      const exists = currentData.paymentPlans.some((plan) => plan.id === paymentPlan.id);
      return {
        ...currentData,
        paymentPlans: exists
          ? currentData.paymentPlans.map((plan) => (plan.id === paymentPlan.id ? paymentPlan : plan))
          : [...currentData.paymentPlans, paymentPlan],
      };
    });
    setPaymentEditor(null);
  }

  function markInstallmentPaid(paymentPlan, installment) {
    setData((currentData) => ({
      ...currentData,
      paymentPlans: currentData.paymentPlans.map((plan) =>
        plan.id !== paymentPlan.id
          ? plan
          : {
              ...plan,
              installments: plan.installments.map((item) =>
                item.id === installment.id ? { ...item, status: "paid" } : item,
              ),
            },
      ),
    }));
  }

  function cancelPlan(paymentPlan) {
    const result = cancelPaymentPlan(paymentPlan);
    const message =
      result.action === "delete"
        ? `¿Eliminar el plan «${paymentPlan.description}»?`
        : `El plan «${paymentPlan.description}» tiene pagos realizados. ¿Cancelar sus cuotas pendientes?`;
    if (!window.confirm(message)) return;

    setData((currentData) => ({
      ...currentData,
      paymentPlans:
        result.action === "delete"
          ? currentData.paymentPlans.filter((plan) => plan.id !== paymentPlan.id)
          : currentData.paymentPlans.map((plan) => (plan.id === paymentPlan.id ? result.plan : plan)),
    }));
  }

  function saveCategory(category) {
    setData((currentData) => {
      const exists = currentData.categories.some((item) => item.id === category.id);
      return {
        ...currentData,
        categories: exists
          ? currentData.categories.map((item) => (item.id === category.id ? category : item))
          : [...currentData.categories, category],
      };
    });
  }

  function saveBalance(memberId, balanceKey, amountMinor) {
    setData((currentData) => ({
      ...currentData,
      balances: {
        ...currentData.balances,
        [memberId]: { ...currentData.balances[memberId], [balanceKey]: amountMinor },
      },
    }));
  }

  function importBackup(importedData) {
    setData(importedData);
    setBackupDialogOpen(false);
    setBackupMessage("Respaldo importado correctamente.");
  }

  function updateMonth(amount) {
    setMonthKey((currentMonth) => shiftMonth(currentMonth, amount));
  }

  return (
    <>
      <main className="workspace household-workspace">
        <StorageNotice status={persistenceStatus} />
        {backupMessage && (
          <div className="success-notice" role="status">
            <span>{backupMessage}</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Cerrar aviso"
              title="Cerrar aviso"
              onClick={() => setBackupMessage("")}
            >
              ×
            </button>
          </div>
        )}
        <div className="page-heading household-heading">
          <div>
            <p className="eyebrow">FINANZAS DEL HOGAR</p>
            <h1>Control mensual</h1>
          </div>
          <div className="page-actions household-actions">
            <button className="secondary-button" type="button" onClick={() => setCategoryDialogOpen(true)}>
              Categorías
            </button>
            <button className="secondary-button" type="button" onClick={() => setBackupDialogOpen(true)}>
              Respaldo
            </button>
            <button className="secondary-button" type="button" onClick={() => setIncomeEditor({ income: null })}>
              + Ingreso
            </button>
            <button className="primary-button" type="button" onClick={() => setPaymentEditor({ plan: null })}>
              + Pago
            </button>
          </div>
        </div>

        <div className="month-switcher" aria-label="Periodo del resumen">
          <button
            className="icon-button"
            type="button"
            aria-label="Mes anterior"
            title="Mes anterior"
            onClick={() => updateMonth(-1)}
          >
            ‹
          </button>
          <strong>{getMonthLabel(monthKey)}</strong>
          <button
            className="icon-button"
            type="button"
            aria-label="Mes siguiente"
            title="Mes siguiente"
            onClick={() => updateMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="household-grid">
          <MemberPanel
            memberId="lisandro"
            data={data}
            summary={summary}
            incomeEntries={lisandroIncome}
            paymentEntries={lisandroPayments}
            currencyCode={currencyCode}
            onAddIncome={(memberId) => setIncomeEditor({ income: null, memberId })}
            onEditIncome={(income) => setIncomeEditor({ income })}
            onDeleteIncome={deleteIncomeEntry}
            onEditPayment={(plan) => setPaymentEditor({ plan })}
            onMarkPaid={markInstallmentPaid}
            onCancelPlan={cancelPlan}
            onSaveBalance={saveBalance}
          />
          <SharedPanel
            entries={sharedPayments}
            categories={data.categories}
            currencyCode={currencyCode}
            sharedCommitmentsMinor={summary.sharedCommitmentsMinor}
            onEdit={(plan) => setPaymentEditor({ plan })}
            onMarkPaid={markInstallmentPaid}
            onCancel={cancelPlan}
          />
          <MemberPanel
            memberId="catriel"
            data={data}
            summary={summary}
            incomeEntries={catrielIncome}
            paymentEntries={catrielPayments}
            currencyCode={currencyCode}
            onAddIncome={(memberId) => setIncomeEditor({ income: null, memberId })}
            onEditIncome={(income) => setIncomeEditor({ income })}
            onDeleteIncome={deleteIncomeEntry}
            onEditPayment={(plan) => setPaymentEditor({ plan })}
            onMarkPaid={markInstallmentPaid}
            onCancelPlan={cancelPlan}
            onSaveBalance={saveBalance}
          />
        </div>
      </main>

      <footer className="app-footer">
        <span>FINANZAS DEL HOGAR</span>
        <span>{currencyCode} · DATOS LOCALES</span>
      </footer>

      {incomeEditor && (
        <IncomeDialog
          key={incomeEditor.income?.id ?? `new-${incomeEditor.memberId ?? "income"}`}
          initialIncome={incomeEditor.income}
          categories={data.categories}
          currencyCode={currencyCode}
          onClose={() => setIncomeEditor(null)}
          onSave={saveIncomeEntry}
        />
      )}
      {paymentEditor && (
        <PaymentPlanDialog
          key={paymentEditor.plan?.id ?? "new-payment-plan"}
          initialPlan={paymentEditor.plan}
          categories={data.categories}
          currencyCode={currencyCode}
          onClose={() => setPaymentEditor(null)}
          onSave={savePaymentPlan}
        />
      )}
      {categoryDialogOpen && (
        <CategoryDialog
          categories={data.categories}
          onClose={() => setCategoryDialogOpen(false)}
          onSave={saveCategory}
        />
      )}
      {backupDialogOpen && (
        <BackupDialog
          financeData={data}
          onClose={() => setBackupDialogOpen(false)}
          onImport={importBackup}
          parser={parseHouseholdBackupV2}
          serializer={serializeHouseholdBackupV2}
        />
      )}
    </>
  );
}

function App() {
  const [loadedState] = useState(() => loadHouseholdDataV2());
  const [householdData, setHouseholdData] = useState(loadedState.data);
  const [persistenceStatus, setPersistenceStatus] = useState(loadedState.status);
  const [currencySelection, setCurrencySelection] = useState("");
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);

  useEffect(() => {
    if (persistenceStatus !== "available" || !householdData.settings.currencyCode) return;

    const result = saveHouseholdDataV2(householdData);
    if (result.status === "unavailable" || result.status === "invalid") {
      setPersistenceStatus(result.status === "invalid" ? "invalid" : "unavailable");
    }
  }, [householdData, persistenceStatus]);

  function handleCurrencySubmit(event) {
    event.preventDefault();
    if (!currencyOptions.some((option) => option.code === currencySelection)) return;

    setHouseholdData((currentData) => ({
      ...currentData,
      settings: { ...currentData.settings, currencyCode: currencySelection },
    }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="local-indicator">
          <span aria-hidden="true" />
          {persistenceStatus === "available" ? "Datos locales" : "Solo esta sesión"}
        </div>
      </header>
      {householdData.settings.currencyCode ? (
        <HouseholdDashboard
          data={householdData}
          setData={setHouseholdData}
          monthKey={monthKey}
          setMonthKey={setMonthKey}
          persistenceStatus={persistenceStatus}
        />
      ) : (
        <CurrencySetup
          selectedCurrency={currencySelection}
          onCurrencyChange={setCurrencySelection}
          onSubmit={handleCurrencySubmit}
          persistenceStatus={persistenceStatus}
        />
      )}
    </div>
  );
}

export default App;