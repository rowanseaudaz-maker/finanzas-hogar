import { useEffect, useRef, useState } from "react";
import {
  formatMinorAmount,
  getMonthSummary,
  parseAmountToMinor,
  validateTransaction,
} from "./lib/finance.js";
import { parseFinanceBackup, serializeFinanceBackup } from "./lib/backup.js";
import { loadFinanceData, saveFinanceData } from "./lib/storage.js";

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

function downloadFinanceBackup(financeData) {
  const serializedData = serializeFinanceBackup(financeData);
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

function BalanceEditor({ label, amountMinor, currencyCode, onSave }) {
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

  const inputId = `balance-${label.toLowerCase().replaceAll(" ", "-")}`;

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
  const [kind, setKind] = useState("expense");
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
              className={kind === "expense" ? "is-selected" : ""}
              type="button"
              aria-pressed={kind === "expense"}
              onClick={() => selectKind("expense")}
            >
              Gastos
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

function BackupDialog({ financeData, onClose, onImport }) {
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
    const result = parseFinanceBackup(serializedData);
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
      downloadFinanceBackup(financeData);
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

function App() {
  const [loadedState] = useState(() => loadFinanceData());
  const [financeData, setFinanceData] = useState(loadedState.data);
  const [persistenceStatus, setPersistenceStatus] = useState(loadedState.status);
  const [currencySelection, setCurrencySelection] = useState("");
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);

  useEffect(() => {
    if (persistenceStatus !== "available" || !financeData.settings.currencyCode) return;

    const result = saveFinanceData(financeData);
    if (result.status === "unavailable" || result.status === "invalid") {
      setPersistenceStatus(result.status === "invalid" ? "invalid" : "unavailable");
    }
  }, [financeData, persistenceStatus]);

  function handleCurrencySubmit(event) {
    event.preventDefault();
    if (!currencyOptions.some((option) => option.code === currencySelection)) return;

    setFinanceData((currentData) => ({
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
      {financeData.settings.currencyCode ? (
        <Dashboard
          financeData={financeData}
          setFinanceData={setFinanceData}
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