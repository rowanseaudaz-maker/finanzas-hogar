import React, { useState, useEffect } from 'react';

export default function App() {
  const [mesSeleccionado, setMesSeleccionado] = useState('2026-10');

  // ALMACENAMIENTO PERMANENTE LOCAL
  const STORAGE_KEY = 'finanzas_hogar_v2';

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error leyendo localStorage:', e);
      }
    }

    return {
      ingresos: [],
      ahorros: [],
      gastosLisandro: [],
      gastosCatriel: [],
      gastosCompartidos: [
        { id: 1, descripcion: 'Alquiler', monto: 150000, mes: '2026-10' },
        { id: 2, descripcion: 'Expensas', monto: 30000, mes: '2026-10' }
      ],
      tarjetas: [
        { id: 1, nombre: 'NACION - VISA', titular: 'Catriel' },
        { id: 2, nombre: 'NACION - Mastercard', titular: 'Lisandro' }
      ],
      consumosTarjetas: [],
      prestamos: []
    };
  });

  const [itemEditando, setItemEditando] = useState(null);

  // Forms
  const [usuarioConsumo, setUsuarioConsumo] = useState('Catriel');
  const [nuevoConsumo, setNuevoConsumo] = useState({ tarjetaId: '', descripcion: '', montoCuota: '', cuotaActual: 1, cuotasTotales: 1, quienPaga: 'Catriel', pagadorOtroTexto: '' });
  const [nuevoIngreso, setNuevoIngreso] = useState({ usuario: 'Catriel', monto: '', descripcion: '' });
  const [nuevoGastoCompartido, setNuevoGastoCompartido] = useState({ descripcion: '', monto: '' });
  const [nuevoGastoInd, setNuevoGastoInd] = useState({ usuario: 'Catriel', descripcion: '', monto: '' });
  const [nuevaTarjeta, setNuevaTarjeta] = useState({ nombre: '', titular: 'Catriel' });
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ entidad: '', montoCuota: '', cuotaActual: 1, cuotasTotales: 12, quienPaga: 'Compartido', pagadorOtroTexto: '' });

  // Guardar en localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // COPIA DE SEGURIDAD INDEPENDIENTE AL CAMBIAR DE MES
  useEffect(() => {
    const gastosComp = data.gastosCompartidos || [];
    const hayGastosEnMesActual = gastosComp.some(g => g.mes === mesSeleccionado);

    // Si el mes está totalmente vacío, busca los datos del mes anterior y los clona
    if (!hayGastosEnMesActual && gastosComp.length > 0) {
      // Obtener meses únicos ordenados
      const mesesExistentes = Array.from(new Set(gastosComp.map(g => g.mes))).sort();
      const mesesAnteriores = mesesExistentes.filter(m => m < mesSeleccionado);

      if (mesesAnteriores.length > 0) {
        const ultimoMesDisponible = mesesAnteriores[mesesAnteriores.length - 1];
        const gastosUltimoMes = gastosComp.filter(g => g.mes === ultimoMesDisponible);

        const gastosClonados = gastosUltimoMes.map((g, idx) => ({
          id: Date.now() + idx,
          descripcion: g.descripcion,
          monto: g.monto,
          mes: mesSeleccionado // Asigna el mes nuevo pero NO altera el viejo
        }));

        setData(prev => ({
          ...prev,
          gastosCompartidos: [...(prev.gastosCompartidos || []), ...gastosClonados]
        }));
      }
    }
  }, [mesSeleccionado]);

  const formatoMoneda = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);

  const calcularDiferenciaMeses = (mesInicio, mesActual) => {
    if (!mesInicio || !mesActual) return 0;
    const [a1, m1] = mesInicio.split('-').map(Number);
    const [a2, m2] = mesActual.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  };

  // --- HANDLERS ---
  const agregarIngreso = (e) => {
    e.preventDefault();
    if (!nuevoIngreso.monto || !nuevoIngreso.descripcion) return;
    const item = { id: Date.now(), usuario: nuevoIngreso.usuario, monto: parseFloat(nuevoIngreso.monto), descripcion: nuevoIngreso.descripcion, mes: mesSeleccionado };
    setData({ ...data, ingresos: [...(data.ingresos || []), item] });
    setNuevoIngreso({ ...nuevoIngreso, monto: '', descripcion: '' });
  };

  const guardarAhorro = (usuario, monto) => {
    const otrosAhorros = (data.ahorros || []).filter(a => !(a.usuario === usuario && a.mes === mesSeleccionado));
    const nuevo = { id: Date.now(), usuario, monto: parseFloat(monto) || 0, mes: mesSeleccionado };
    setData({ ...data, ahorros: [...otrosAhorros, nuevo] });
  };

  const agregarGastoCompartido = (e) => {
    e.preventDefault();
    if (!nuevoGastoCompartido.monto || !nuevoGastoCompartido.descripcion) return;
    const nuevoGasto = { id: Date.now(), descripcion: nuevoGastoCompartido.descripcion, monto: parseFloat(nuevoGastoCompartido.monto), mes: mesSeleccionado };
    setData({ ...data, gastosCompartidos: [...(data.gastosCompartidos || []), nuevoGasto] });
    setNuevoGastoCompartido({ descripcion: '', monto: '' });
  };

  const agregarGastoInd = (e) => {
    e.preventDefault();
    if (!nuevoGastoInd.monto || !nuevoGastoInd.descripcion) return;
    const item = { id: Date.now(), descripcion: nuevoGastoInd.descripcion, monto: parseFloat(nuevoGastoInd.monto), mes: mesSeleccionado };
    if (nuevoGastoInd.usuario === 'Catriel') {
      setData({ ...data, gastosCatriel: [...(data.gastosCatriel || []), item] });
    } else {
      setData({ ...data, gastosLisandro: [...(data.gastosLisandro || []), item] });
    }
    setNuevoGastoInd({ ...nuevoGastoInd, monto: '', descripcion: '' });
  };

  const agregarTarjeta = (e) => {
    e.preventDefault();
    if (!nuevaTarjeta.nombre.trim()) return;
    const nueva = { id: Date.now(), nombre: nuevaTarjeta.nombre, titular: nuevaTarjeta.titular };
    setData({ ...data, tarjetas: [...(data.tarjetas || []), nueva] });
    setNuevaTarjeta({ nombre: '', titular: 'Catriel' });
  };

  const agregarConsumoTarjeta = (e) => {
    e.preventDefault();
    if (!nuevoConsumo.tarjetaId || !nuevoConsumo.montoCuota || !nuevoConsumo.descripcion) return;
    const consumo = {
      id: Date.now(),
      tarjetaId: parseInt(nuevoConsumo.tarjetaId),
      descripcion: nuevoConsumo.descripcion,
      montoCuota: parseFloat(nuevoConsumo.montoCuota),
      cuotaInicioMes: mesSeleccionado,
      cuotaActualNumero: parseInt(nuevoConsumo.cuotaActual) || 1,
      cuotasTotales: parseInt(nuevoConsumo.cuotasTotales) || 1,
      quienPaga: nuevoConsumo.quienPaga,
      pagadorDetalle: nuevoConsumo.quienPaga === 'Otro' ? nuevoConsumo.pagadorOtroTexto : ''
    };
    setData({ ...data, consumosTarjetas: [...(data.consumosTarjetas || []), consumo] });
    setNuevoConsumo({ tarjetaId: '', descripcion: '', montoCuota: '', cuotaActual: 1, cuotasTotales: 1, quienPaga: 'Catriel', pagadorOtroTexto: '' });
  };

  const agregarPrestamo = (e) => {
    e.preventDefault();
    if (!nuevoPrestamo.entidad.trim() || !nuevoPrestamo.montoCuota) return;
    const p = {
      id: Date.now(),
      entidad: nuevoPrestamo.entidad,
      montoCuota: parseFloat(nuevoPrestamo.montoCuota),
      cuotaInicioMes: mesSeleccionado,
      cuotaActualNumero: parseInt(nuevoPrestamo.cuotaActual) || 1,
      cuotasTotales: parseInt(nuevoPrestamo.cuotasTotales) || 1,
      quienPaga: nuevoPrestamo.quienPaga,
      pagadorDetalle: nuevoPrestamo.quienPaga === 'Otro' ? nuevoPrestamo.pagadorOtroTexto : ''
    };
    setData({ ...data, prestamos: [...(data.prestamos || []), p] });
    setNuevoPrestamo({ entidad: '', montoCuota: '', cuotaActual: 1, cuotasTotales: 12, quienPaga: 'Compartido', pagadorOtroTexto: '' });
  };

  const eliminarItem = (coleccion, id) => {
    if (window.confirm('¿Seguro que querés borrar este registro?')) {
      if (coleccion === 'tarjetas') {
        setData({
          ...data,
          tarjetas: (data.tarjetas || []).filter(t => t.id !== id),
          consumosTarjetas: (data.consumosTarjetas || []).filter(c => c.tarjetaId !== id)
        });
      } else {
        setData({
          ...data,
          [coleccion]: (data[coleccion] || []).filter(i => i.id !== id)
        });
      }
    }
  };

  const guardarEdicion = (e) => {
    e.preventDefault();
    const { tipo, item } = itemEditando;
    setData({
      ...data,
      [tipo]: (data[tipo] || []).map(i => i.id === item.id ? item : i)
    });
    setItemEditando(null);
  };

  // --- FILTRADOS MES ---
  const ingresosFiltrados = (data.ingresos || []).filter(i => i.mes === mesSeleccionado);
  const gastosCompartidosFiltrados = (data.gastosCompartidos || []).filter(g => g.mes === mesSeleccionado);
  const gastosCatrielFiltrados = (data.gastosCatriel || []).filter(g => g.mes === mesSeleccionado);
  const gastosLisandroFiltrados = (data.gastosLisandro || []).filter(g => g.mes === mesSeleccionado);

  const ingresosCatriel = ingresosFiltrados.filter(i => i.usuario === 'Catriel');
  const ingresosLisandro = ingresosFiltrados.filter(i => i.usuario === 'Lisandro');

  const totalIngresosCatriel = ingresosCatriel.reduce((a, b) => a + b.monto, 0);
  const totalIngresosLisandro = ingresosLisandro.reduce((a, b) => a + b.monto, 0);

  const ahorroCatrielObj = (data.ahorros || []).find(a => a.usuario === 'Catriel' && a.mes === mesSeleccionado);
  const ahorroLisandroObj = (data.ahorros || []).find(a => a.usuario === 'Lisandro' && a.mes === mesSeleccionado);

  const ahorroCatriel = ahorroCatrielObj ? ahorroCatrielObj.monto : 0;
  const ahorroLisandro = ahorroLisandroObj ? ahorroLisandroObj.monto : 0;

  const totalCompartidoGeneral = gastosCompartidosFiltrados.reduce((a, b) => a + b.monto, 0);
  const cuotaCompartidaIndividual = totalCompartidoGeneral / 2;

  const totalIndCatriel = gastosCatrielFiltrados.reduce((a, b) => a + b.monto, 0);
  const totalIndLisandro = gastosLisandroFiltrados.reduce((a, b) => a + b.monto, 0);

  const obtenerConsumosActivosPorMes = (tarjetaId) => {
    return (data.consumosTarjetas || []).map(c => {
      if (c.tarjetaId !== tarjetaId) return null;
      const diff = calcularDiferenciaMeses(c.cuotaInicioMes, mesSeleccionado);
      const cuotaEnEsteMes = c.cuotaActualNumero + diff;
      if (cuotaEnEsteMes >= 1 && cuotaEnEsteMes <= c.cuotasTotales) {
        return { ...c, cuotaRender: cuotaEnEsteMes };
      }
      return null;
    }).filter(Boolean);
  };

  const obtenerPrestamosActivosPorMes = () => {
    return (data.prestamos || []).map(p => {
      const diff = calcularDiferenciaMeses(p.cuotaInicioMes, mesSeleccionado);
      const cuotaEnEsteMes = p.cuotaActualNumero + diff;
      if (cuotaEnEsteMes >= 1 && cuotaEnEsteMes <= p.cuotasTotales) {
        return { ...p, cuotaRender: cuotaEnEsteMes };
      }
      return null;
    }).filter(Boolean);
  };

  const prestamosActivos = obtenerPrestamosActivosPorMes();
  const prestamosLisandro = prestamosActivos.filter(p => p.quienPaga === 'Lisandro');
  const prestamosCatriel = prestamosActivos.filter(p => p.quienPaga === 'Catriel');
  const prestamosCompartidos = prestamosActivos.filter(p => p.quienPaga === 'Compartido');

  const tarjetasCatriel = (data.tarjetas || []).filter(t => t.titular === 'Catriel');
  const tarjetasLisandro = (data.tarjetas || []).filter(t => t.titular === 'Lisandro');
  const tarjetasDelUsuarioActual = (data.tarjetas || []).filter(t => t.titular === usuarioConsumo);

  // DETALLE TARJETAS COMPARTIDAS
  const consumosTarjetasCompartidosLisandro = tarjetasLisandro.reduce((total, t) => {
    const consumos = obtenerConsumosActivosPorMes(t.id).filter(c => c.quienPaga === 'Compartido');
    return total + consumos.reduce((a, b) => a + b.montoCuota, 0);
  }, 0);

  const consumosTarjetasCompartidosCatriel = tarjetasCatriel.reduce((total, t) => {
    const consumos = obtenerConsumosActivosPorMes(t.id).filter(c => c.quienPaga === 'Compartido');
    return total + consumos.reduce((a, b) => a + b.montoCuota, 0);
  }, 0);

  const totalTarjetasCompartido = consumosTarjetasCompartidosLisandro + consumosTarjetasCompartidosCatriel;
  const cuotaPagaCadaUnoTarjetas = totalTarjetasCompartido / 2;

  const diferenciaTarjetas = consumosTarjetasCompartidosCatriel - consumosTarjetasCompartidosLisandro;
  const montoAjusteTarjetas = Math.abs(diferenciaTarjetas) / 2;

  // DESGLOSE CARGO JUSTO PROPIO
  const obtenerDesgloseExclusivoPorTarjeta = (usuario) => {
    const desglose = [];
    (data.tarjetas || []).forEach(t => {
      const consumos = obtenerConsumosActivosPorMes(t.id);
      let montoPropioEnTarjeta = 0;

      consumos.forEach(c => {
        if (c.quienPaga === usuario) {
          montoPropioEnTarjeta += c.montoCuota;
        }
      });

      if (montoPropioEnTarjeta > 0) {
        const esTarjetaAjena = t.titular !== usuario;
        desglose.push({
          nombre: t.nombre,
          titular: t.titular,
          monto: montoPropioEnTarjeta,
          esTarjetaAjena
        });
      }
    });

    return desglose;
  };

  const desgloseTarjetasCatriel = obtenerDesgloseExclusivoPorTarjeta('Catriel');
  const desgloseTarjetasLisandro = obtenerDesgloseExclusivoPorTarjeta('Lisandro');

  const pagoExclusivoTarjetasCatriel = desgloseTarjetasCatriel.reduce((a, b) => a + b.monto, 0);
  const pagoExclusivoTarjetasLisandro = desgloseTarjetasLisandro.reduce((a, b) => a + b.monto, 0);

  const calcularPagoRealTarjetasBalance = (usuario) => {
    let total = 0;
    (data.tarjetas || []).forEach(t => {
      const consumos = obtenerConsumosActivosPorMes(t.id);
      consumos.forEach(c => {
        if (c.quienPaga === usuario) {
          total += c.montoCuota;
        } else if (c.quienPaga === 'Compartido') {
          total += c.montoCuota / 2;
        }
      });
    });
    return total;
  };

  const pagoBalanceTarjetasCatriel = calcularPagoRealTarjetasBalance('Catriel');
  const pagoBalanceTarjetasLisandro = calcularPagoRealTarjetasBalance('Lisandro');

  // DEUDORES / TERCEROS
  const obtenerCobrosTerceros = (titularBuscado) => {
    const deudores = {};
    const tarjetasDelTitular = (data.tarjetas || []).filter(t => t.titular === titularBuscado);

    tarjetasDelTitular.forEach(t => {
      const consumos = obtenerConsumosActivosPorMes(t.id);
      consumos.forEach(c => {
        if (c.quienPaga === 'Otro' && c.pagadorDetalle.trim() !== '') {
          const nombre = c.pagadorDetalle.trim();
          deudores[nombre] = (deudores[nombre] || 0) + c.montoCuota;
        }
      });
    });

    return deudores;
  };

  const deudoresCatriel = obtenerCobrosTerceros('Catriel');
  const deudoresLisandro = obtenerCobrosTerceros('Lisandro');

  // COMBUSTIBLE
  const obtenerCombustibleUsuario = (usuario) => {
    let total = 0;
    (data.tarjetas || []).forEach(t => {
      const consumos = obtenerConsumosActivosPorMes(t.id);
      consumos.forEach(c => {
        if (c.descripcion.toLowerCase().includes('combustible')) {
          if (c.quienPaga === usuario) total += c.montoCuota;
          else if (c.quienPaga === 'Compartido') total += c.montoCuota / 2;
        }
      });
    });

    const fijos = usuario === 'Catriel' ? gastosCatrielFiltrados : gastosLisandroFiltrados;
    fijos.forEach(g => {
      if (g.descripcion.toLowerCase().includes('combustible')) total += g.monto;
    });

    return total;
  };

  const combustibleCatriel = obtenerCombustibleUsuario('Catriel');
  const combustibleLisandro = obtenerCombustibleUsuario('Lisandro');

  const totalPrestamosCompartidos = prestamosCompartidos.reduce((a, b) => a + b.montoCuota, 0);
  const totalPrestamosPropioCatriel = prestamosCatriel.reduce((a, b) => a + b.montoCuota, 0);
  const totalPrestamosPropioLisandro = prestamosLisandro.reduce((a, b) => a + b.montoCuota, 0);

  // RESUMEN Y BALANCE NETO
  const gastosTotalesCatriel = totalIndCatriel + pagoBalanceTarjetasCatriel + cuotaCompartidaIndividual + (totalPrestamosCompartidos / 2) + totalPrestamosPropioCatriel;
  const gastosTotalesLisandro = totalIndLisandro + pagoBalanceTarjetasLisandro + cuotaCompartidaIndividual + (totalPrestamosCompartidos / 2) + totalPrestamosPropioLisandro;

  const disponibleCatriel = totalIngresosCatriel - gastosTotalesCatriel - ahorroCatriel;
  const disponibleLisandro = totalIngresosLisandro - gastosTotalesLisandro - ahorroLisandro;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '20px' }}>
      
      {/* CABECERA */}
      <header style={{ maxWidth: '1400px', margin: '0 auto 24px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
        <div>
          <h1 style={{ margin: 0, color: '#0f172a', fontSize: '24px' }}>🏡 Dashboard Financiero del Hogar</h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Vista Dividida: Lisandro (Izq) | Compartido (Centro) | Catriel (Der)</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
          <label style={{ fontWeight: 'bold', color: '#334155', fontSize: '14px' }}>📅 Período:</label>
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '14px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer' }}
          />
        </div>
      </header>

      {/* TRES COLUMNAS PRINCIPALES */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>

        {/* ================= COLUMNA 1: LISANDRO ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#e0f2fe', border: '2px solid #38bdf8', borderRadius: '16px', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px 0', color: '#0369a1', fontSize: '20px' }}>👤 LISANDRO</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #bae6fd' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0284c7', display: 'block' }}>INGRESOS</span>
                {ingresosLisandro.map(ing => (
                  <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px' }}>
                    <span>{ing.descripcion}</span>
                    <div>
                      <strong style={{ color: '#0369a1', marginRight: '4px' }}>{formatoMoneda(ing.monto)}</strong>
                      <button onClick={() => setItemEditando({ tipo: 'ingresos', item: ing })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>✏️</button>
                      <button onClick={() => eliminarItem('ingresos', ing.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '6px', paddingTop: '4px', textAlign: 'right', fontSize: '11px' }}>
                  <strong>Tot: {formatoMoneda(totalIngresosLisandro)}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: '#f0f9ff', borderRadius: '12px', padding: '12px', border: '2px solid #38bdf8' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0369a1', display: 'block' }}>🐷 AHORRO</span>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0284c7', marginTop: '4px' }}>
                  {formatoMoneda(ahorroLisandro)}
                </div>
                <input
                  type="number"
                  placeholder="Editar $"
                  onBlur={e => e.target.value !== '' && guardarAhorro('Lisandro', e.target.value)}
                  style={{ width: '80%', padding: '2px 4px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #bae6fd' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>GASTOS PROPIOS LISANDRO</span>
              {gastosLisandroFiltrados.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '13px' }}>
                  <span>{g.descripcion}</span>
                  <div>
                    <strong style={{ marginRight: '8px' }}>{formatoMoneda(g.monto)}</strong>
                    <button onClick={() => setItemEditando({ tipo: 'gastosLisandro', item: g })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => eliminarItem('gastosLisandro', g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '12px' }}>
                <span>Subtotal Propio: <strong>{formatoMoneda(totalIndLisandro)}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #bae6fd' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0369a1', fontSize: '16px' }}>💳 Tarjetas de Lisandro</h3>
            {tarjetasLisandro.map(t => {
              const consumos = obtenerConsumosActivosPorMes(t.id);
              const totalResumen = consumos.reduce((a, b) => a + b.montoCuota, 0);

              return (
                <div key={t.id} style={{ border: '1px solid #bae6fd', borderRadius: '12px', padding: '12px', marginBottom: '12px', backgroundColor: '#f0f9ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: '#0369a1' }}>💳 {t.nombre}</strong>
                    <div>
                      <button onClick={() => setItemEditando({ tipo: 'tarjetas', item: t })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                      <button onClick={() => eliminarItem('tarjetas', t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    Total Resumen Mes: <strong style={{ color: '#0369a1' }}>{formatoMoneda(totalResumen)}</strong>
                  </div>

                  {consumos.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', marginBottom: '4px' }}>
                      <div>
                        <span>{c.descripcion}</span>
                        <span style={{ color: '#0284c7', fontSize: '10px', marginLeft: '6px', fontWeight: 'bold' }}>
                          (Cuota {c.cuotaRender}/{c.cuotasTotales})
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                          Paga: <strong>{c.quienPaga === 'Otro' ? c.pagadorDetalle : c.quienPaga}</strong>
                        </span>
                      </div>
                      <div>
                        <strong style={{ marginRight: '6px' }}>{formatoMoneda(c.montoCuota)}</strong>
                        <button onClick={() => setItemEditando({ tipo: 'consumosTarjetas', item: c })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                        <button onClick={() => eliminarItem('consumosTarjetas', c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {prestamosLisandro.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '2px solid #a855f7' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#6b21a8', fontSize: '15px' }}>🏦 Préstamos de Lisandro</h3>
              {prestamosLisandro.map(p => (
                <div key={p.id} style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#6b21a8' }}>{p.entidad}</strong>
                    <div>
                      <strong style={{ marginRight: '6px' }}>{formatoMoneda(p.montoCuota)}</strong>
                      <button onClick={() => setItemEditando({ tipo: 'prestamos', item: p })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                      <button onClick={() => eliminarItem('prestamos', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                    </div>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '10px' }}>Cuota {p.cuotaRender} de {p.cuotasTotales}</span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(deudoresLisandro).length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '2px solid #38bdf8' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '15px' }}>📌 Le deben a Lisandro (Tarjetas)</h3>
              {Object.entries(deudoresLisandro).map(([nombre, monto]) => (
                <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f0f9ff', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#0369a1' }}>{nombre}</span>
                  <strong style={{ color: '#0284c7' }}>{formatoMoneda(monto)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= COLUMNA 2: CENTRO ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* GASTOS COMPARTIDOS */}
          <div style={{ backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '16px', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px 0', color: '#b45309', fontSize: '20px', textAlign: 'center' }}>🤝 GASTOS COMPARTIDOS (50 / 50)</h2>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid #fde68a', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #fef3c7', paddingBottom: '8px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', color: '#78350f' }}>Concepto</span>
                <span style={{ fontWeight: 'bold', color: '#78350f' }}>Monto Total</span>
              </div>

              {gastosCompartidosFiltrados.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fffbeb', fontSize: '14px' }}>
                  <span>{g.descripcion}</span>
                  <div>
                    <strong style={{ color: '#b45309', marginRight: '8px' }}>{formatoMoneda(g.monto)}</strong>
                    <button onClick={() => setItemEditando({ tipo: 'gastosCompartidos', item: g })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => eliminarItem('gastosCompartidos', g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>
              ))}

              <div style={{ backgroundColor: '#fffbeb', borderRadius: '8px', padding: '12px', marginTop: '12px', border: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Total Compartidos:</span>
                  <strong>{formatoMoneda(totalCompartidoGeneral)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '6px', color: '#b45309', fontWeight: 'bold' }}>
                  <span>Corresponde a CADA UNO (50%):</span>
                  <span>{formatoMoneda(cuotaCompartidaIndividual)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={agregarGastoCompartido} style={{ display: 'flex', gap: '8px', backgroundColor: '#ffffff', padding: '10px', borderRadius: '10px' }}>
              <input type="text" placeholder="Ej: Alquiler" value={nuevoGastoCompartido.descripcion} onChange={e => setNuevoGastoCompartido({ ...nuevoGastoCompartido, descripcion: e.target.value })} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="number" placeholder="$ Total" value={nuevoGastoCompartido.monto} onChange={e => setNuevoGastoCompartido({ ...nuevoGastoCompartido, monto: e.target.value })} style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
            </form>
          </div>

          {/* GASTOS TARJETAS COMPARTIDOS */}
          <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '16px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>
              💳 Gastos Tarjetas Compartidos
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f0f9ff', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#0369a1', fontWeight: '500' }}>En tarjetas de Lisandro:</span>
                <strong style={{ color: '#0369a1' }}>{formatoMoneda(consumosTarjetasCompartidosLisandro)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '8px' }}>
                <span style={{ color: '#15803d', fontWeight: '500' }}>En tarjetas de Catriel:</span>
                <strong style={{ color: '#15803d' }}>{formatoMoneda(consumosTarjetasCompartidosCatriel)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '8px', marginTop: '4px' }}>
                <span style={{ color: '#b45309', fontWeight: 'bold' }}>Corresponde pagar a CADA UNO (50%):</span>
                <strong style={{ color: '#b45309' }}>{formatoMoneda(cuotaPagaCadaUnoTarjetas)}</strong>
              </div>
            </div>

            <div style={{
              backgroundColor: diferenciaTarjetas === 0 ? '#f8fafc' : (diferenciaTarjetas > 0 ? '#f0fdf4' : '#f0f9ff'),
              border: `1.5px solid ${diferenciaTarjetas === 0 ? '#cbd5e1' : (diferenciaTarjetas > 0 ? '#86efac' : '#38bdf8')}`,
              borderRadius: '10px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block' }}>
                ⚖️ LIQUIDACIÓN DE TARJETAS COMPARTIDAS
              </span>
              {diferenciaTarjetas === 0 ? (
                <strong style={{ fontSize: '13px', color: '#475569', display: 'block', marginTop: '4px' }}>
                  ¡Las tarjetas compartidas están 100% al día!
                </strong>
              ) : diferenciaTarjetas > 0 ? (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#166534', fontWeight: 'bold' }}>
                    Lisandro le debe a Catriel:
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#15803d' }}>
                    {formatoMoneda(montoAjusteTarjetas)}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: 'bold' }}>
                    Catriel le debe a Lisandro:
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>
                    {formatoMoneda(montoAjusteTarjetas)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RECUADRO CARGO JUSTO */}
          <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px' }}>
              📊 Cargo Justo de Tarjetas (Solo Gastos Propios)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              <div style={{ backgroundColor: '#f0f9ff', padding: '10px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0369a1' }}>LISANDRO (PROPIO)</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0284c7', margin: '4px 0 8px 0' }}>
                  {formatoMoneda(pagoExclusivoTarjetasLisandro)}
                </div>
                {desgloseTarjetasLisandro.length === 0 ? (
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin consumos propios</span>
                ) : (
                  desgloseTarjetasLisandro.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #e0f2fe', padding: '4px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                        <span>{item.nombre}:</span>
                        <strong>{formatoMoneda(item.monto)}</strong>
                      </div>
                      {item.esTarjetaAjena && (
                        <span style={{ fontSize: '10px', color: '#c2410c', fontWeight: 'bold' }}>
                          ⚠️ (En tarjeta de {item.titular})
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534' }}>CATRIEL (PROPIO)</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#15803d', margin: '4px 0 8px 0' }}>
                  {formatoMoneda(pagoExclusivoTarjetasCatriel)}
                </div>
                {desgloseTarjetasCatriel.length === 0 ? (
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin consumos propios</span>
                ) : (
                  desgloseTarjetasCatriel.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #dcfce7', padding: '4px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                        <span>{item.nombre}:</span>
                        <strong>{formatoMoneda(item.monto)}</strong>
                      </div>
                      {item.esTarjetaAjena && (
                        <span style={{ fontSize: '10px', color: '#c2410c', fontWeight: 'bold' }}>
                          ⚠️ (En tarjeta de {item.titular})
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

            </div>
          </div>

          {/* COMBUSTIBLE */}
          <div style={{ backgroundColor: '#ffffff', border: '2px solid #fdba74', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#c2410c', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⛽ GASTOS DE COMBUSTIBLE
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9a3412' }}>Combustible Lisandro:</span>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#ea580c' }}>
                  {formatoMoneda(combustibleLisandro)}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff7ed', padding: '10px', borderRadius: '8px', border: '1px solid #ffedd5' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#9a3412' }}>Combustible Catriel:</span>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#ea580c' }}>
                  {formatoMoneda(combustibleCatriel)}
                </div>
              </div>
            </div>
          </div>

          {/* PRÉSTAMOS COMPARTIDOS */}
          {prestamosCompartidos.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '2px solid #a855f7' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#6b21a8', fontSize: '15px', textAlign: 'center' }}>🏦 Préstamos Compartidos (50/50)</h3>
              {prestamosCompartidos.map(p => (
                <div key={p.id} style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#6b21a8' }}>{p.entidad}</strong>
                    <div>
                      <strong style={{ marginRight: '6px' }}>{formatoMoneda(p.montoCuota)}</strong>
                      <button onClick={() => setItemEditando({ tipo: 'prestamos', item: p })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                      <button onClick={() => eliminarItem('prestamos', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                    <span>Cuota {p.cuotaRender} de {p.cuotasTotales}</span>
                    <span>Cada uno: <strong>{formatoMoneda(p.montoCuota / 2)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* BALANCE FINAL */}
          <div style={{ backgroundColor: '#ffffff', border: '2px solid #0f172a', borderRadius: '16px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '16px', textAlign: 'center' }}>
              💰 BALANCE NETO DEL MES
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: '#f0f9ff', padding: '12px', borderRadius: '10px', border: '1px solid #bae6fd', fontSize: '12px' }}>
                <strong style={{ color: '#0369a1', display: 'block', marginBottom: '6px' }}>LISANDRO</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ingresos:</span><strong>{formatoMoneda(totalIngresosLisandro)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Gastos:</span><strong>{formatoMoneda(gastosTotalesLisandro)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}><span>Ahorro:</span><strong>{formatoMoneda(ahorroLisandro)}</strong></div>
                <div style={{ borderTop: '1px solid #bae6fd', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>DISPONIBLE:</span>
                  <strong style={{ color: disponibleLisandro >= 0 ? '#16a34a' : '#dc2626' }}>{formatoMoneda(disponibleLisandro)}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '12px' }}>
                <strong style={{ color: '#15803d', display: 'block', marginBottom: '6px' }}>CATRIEL</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ingresos:</span><strong>{formatoMoneda(totalIngresosCatriel)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Gastos:</span><strong>{formatoMoneda(gastosTotalesCatriel)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}><span>Ahorro:</span><strong>{formatoMoneda(ahorroCatriel)}</strong></div>
                <div style={{ borderTop: '1px solid #86efac', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>DISPONIBLE:</span>
                  <strong style={{ color: disponibleCatriel >= 0 ? '#16a34a' : '#dc2626' }}>{formatoMoneda(disponibleCatriel)}</strong>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ================= COLUMNA 3: CATRIEL ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #4ade80', borderRadius: '16px', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px 0', color: '#15803d', fontSize: '20px' }}>👤 CATRIEL</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ backgroundColor: '#dcfce7', borderRadius: '12px', padding: '12px', border: '1px solid #86efac' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#166534', display: 'block' }}>💵 INGRESOS</span>
                {ingresosCatriel.map(ing => (
                  <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px' }}>
                    <span>{ing.descripcion}</span>
                    <div>
                      <strong style={{ color: '#15803d', marginRight: '4px' }}>{formatoMoneda(ing.monto)}</strong>
                      <button onClick={() => setItemEditando({ tipo: 'ingresos', item: ing })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>✏️</button>
                      <button onClick={() => eliminarItem('ingresos', ing.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>🗑️</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #bbf7d0', marginTop: '6px', paddingTop: '4px', textAlign: 'right', fontSize: '11px' }}>
                  <strong>Tot: {formatoMoneda(totalIngresosCatriel)}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '12px', border: '2px solid #4ade80' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#15803d', display: 'block' }}>🐷 AHORRO</span>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>
                  {formatoMoneda(ahorroCatriel)}
                </div>
                <input
                  type="number"
                  placeholder="Editar $"
                  onBlur={e => e.target.value !== '' && guardarAhorro('Catriel', e.target.value)}
                  style={{ width: '80%', padding: '2px 4px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '8px' }}>GASTOS PROPIOS CATRIEL</span>
              {gastosCatrielFiltrados.map(g => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '13px' }}>
                  <span>{g.descripcion}</span>
                  <div>
                    <strong style={{ marginRight: '8px' }}>{formatoMoneda(g.monto)}</strong>
                    <button onClick={() => setItemEditando({ tipo: 'gastosCatriel', item: g })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️️</button>
                    <button onClick={() => eliminarItem('gastosCatriel', g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '12px' }}>
                <span>Subtotal Propio: <strong>{formatoMoneda(totalIndCatriel)}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #86efac' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#15803d', fontSize: '16px' }}>💳 Tarjetas de Catriel</h3>
            {tarjetasCatriel.map(t => {
              const consumos = obtenerConsumosActivosPorMes(t.id);
              const totalResumen = consumos.reduce((a, b) => a + b.montoCuota, 0);

              return (
                <div key={t.id} style={{ border: '1px solid #86efac', borderRadius: '12px', padding: '12px', marginBottom: '12px', backgroundColor: '#f0fdf4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: '#15803d' }}>💳 {t.nombre}</strong>
                    <div>
                      <button onClick={() => setItemEditando({ tipo: 'tarjetas', item: t })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                      <button onClick={() => eliminarItem('tarjetas', t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    Total Resumen Mes: <strong style={{ color: '#15803d' }}>{formatoMoneda(totalResumen)}</strong>
                  </div>

                  {consumos.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '6px 8px', borderRadius: '6px', fontSize: '12px', marginBottom: '4px' }}>
                      <div>
                        <span>{c.descripcion}</span>
                        <span style={{ color: '#16a34a', fontSize: '10px', marginLeft: '6px', fontWeight: 'bold' }}>
                          (Cuota {c.cuotaRender}/{c.cuotasTotales})
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                          Paga: <strong>{c.quienPaga === 'Otro' ? c.pagadorDetalle : c.quienPaga}</strong>
                        </span>
                      </div>
                      <div>
                        <strong style={{ marginRight: '6px' }}>{formatoMoneda(c.montoCuota)}</strong>
                        <button onClick={() => setItemEditando({ tipo: 'consumosTarjetas', item: c })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                        <button onClick={() => eliminarItem('consumosTarjetas', c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {prestamosCatriel.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '2px solid #a855f7' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#6b21a8', fontSize: '15px' }}>🏦 Préstamos de Catriel</h3>
              {prestamosCatriel.map(p => (
                <div key={p.id} style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#6b21a8' }}>{p.entidad}</strong>
                    <div>
                      <strong style={{ marginRight: '6px' }}>{formatoMoneda(p.montoCuota)}</strong>
                      <button onClick={() => setItemEditando({ tipo: 'prestamos', item: p })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                      <button onClick={() => eliminarItem('prestamos', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                    </div>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '10px' }}>Cuota {p.cuotaRender} de {p.cuotasTotales}</span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(deudoresCatriel).length > 0 && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '2px solid #4ade80' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#15803d', fontSize: '15px' }}>📌 Le deben a Catriel (Tarjetas)</h3>
              {Object.entries(deudoresCatriel).map(([nombre, monto]) => (
                <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginTop: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: '#15803d' }}>{nombre}</span>
                  <strong style={{ color: '#16a34a' }}>{formatoMoneda(monto)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>


      {/* ================= SECCIÓN INFERIOR: FORMULARIOS ================= */}
      <div style={{ maxWidth: '1400px', margin: '32px auto 0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <section style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '2px solid #a855f7' }}>
          <h2 style={{ margin: '0 0 12px 0', color: '#6b21a8', fontSize: '18px' }}>🏦 Cargar Nuevo Préstamo / Crédito</h2>

          <form onSubmit={agregarPrestamo} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: '#f3e8ff', padding: '12px', borderRadius: '10px' }}>
            <input type="text" placeholder="Entidad (ej: Banco Hipotecario)" value={nuevoPrestamo.entidad} onChange={e => setNuevoPrestamo({ ...nuevoPrestamo, entidad: e.target.value })} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="$ Cuota" value={nuevoPrestamo.montoCuota} onChange={e => setNuevoPrestamo({ ...nuevoPrestamo, montoCuota: e.target.value })} style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Cuota Act." value={nuevoPrestamo.cuotaActual} onChange={e => setNuevoPrestamo({ ...nuevoPrestamo, cuotaActual: e.target.value })} style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Tot Cuotas" value={nuevoPrestamo.cuotasTotales} onChange={e => setNuevoPrestamo({ ...nuevoPrestamo, cuotasTotales: e.target.value })} style={{ width: '80px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <select value={nuevoPrestamo.quienPaga} onChange={e => setNuevoPrestamo({ ...nuevoPrestamo, quienPaga: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="Compartido">Compartido (Centro)</option>
              <option value="Catriel">Paga Catriel (Derecha)</option>
              <option value="Lisandro">Paga Lisandro (Izquierda)</option>
            </select>
            <button type="submit" style={{ backgroundColor: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 'bold', cursor: 'pointer' }}>+ Cargar Préstamo</button>
          </form>
        </section>

        <section style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
          <h2 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '18px' }}>🛍️ Cargar Nuevo Consumo con Tarjeta</h2>

          <form onSubmit={agregarConsumoTarjeta} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>1. ¿Quién realiza el gasto?:</label>
                <select
                  value={usuarioConsumo}
                  onChange={e => {
                    setUsuarioConsumo(e.target.value);
                    setNuevoConsumo({ ...nuevoConsumo, tarjetaId: '' });
                  }}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
                >
                  <option value="Catriel">Catriel</option>
                  <option value="Lisandro">Lisandro</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>2. Elegir Tarjeta:</label>
                <select
                  value={nuevoConsumo.tarjetaId}
                  onChange={e => setNuevoConsumo({ ...nuevoConsumo, tarjetaId: e.target.value })}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Seleccionar --</option>
                  {tarjetasDelUsuarioActual.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Descripción del gasto (ej: Repuesto / Combustible)"
                value={nuevoConsumo.descripcion}
                onChange={e => setNuevoConsumo({ ...nuevoConsumo, descripcion: e.target.value })}
                style={{ flex: 2, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />

              <input
                type="number"
                placeholder="$ Monto por cuota"
                value={nuevoConsumo.montoCuota}
                onChange={e => setNuevoConsumo({ ...nuevoConsumo, montoCuota: e.target.value })}
                style={{ width: '150px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px' }}>Cuota:</span>
                <input
                  type="number"
                  min="1"
                  value={nuevoConsumo.cuotaActual}
                  onChange={e => setNuevoConsumo({ ...nuevoConsumo, cuotaActual: e.target.value })}
                  style={{ width: '50px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '12px' }}>de</span>
                <input
                  type="number"
                  min="1"
                  value={nuevoConsumo.cuotasTotales}
                  onChange={e => setNuevoConsumo({ ...nuevoConsumo, cuotasTotales: e.target.value })}
                  style={{ width: '50px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>¿Quién paga?:</label>
                <select
                  value={nuevoConsumo.quienPaga}
                  onChange={e => setNuevoConsumo({ ...nuevoConsumo, quienPaga: e.target.value })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="Catriel">Catriel</option>
                  <option value="Lisandro">Lisandro</option>
                  <option value="Compartido">Compartido</option>
                  <option value="Otro">Otro / Tercero</option>
                </select>

                {nuevoConsumo.quienPaga === 'Otro' && (
                  <input
                    type="text"
                    placeholder="Especifique quién (ej: Papá)"
                    value={nuevoConsumo.pagadorOtroTexto}
                    onChange={e => setNuevoConsumo({ ...nuevoConsumo, pagadorOtroTexto: e.target.value })}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '180px' }}
                  />
                )}
              </div>

              <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                + Cargar Consumo
              </button>
            </div>
          </form>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <form onSubmit={agregarTarjeta} style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, color: '#0f172a' }}>💳 Crear Nueva Tarjeta</h4>
            <select value={nuevaTarjeta.titular} onChange={e => setNuevaTarjeta({ ...nuevaTarjeta, titular: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="Catriel">Para Catriel</option>
              <option value="Lisandro">Para Lisandro</option>
            </select>
            <input type="text" placeholder="Nombre (ej. NACION - VISA)" value={nuevaTarjeta.nombre} onChange={e => setNuevaTarjeta({ ...nuevaTarjeta, nombre: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button type="submit" style={{ backgroundColor: '#475569', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ Guardar Tarjeta</button>
          </form>

          <form onSubmit={agregarIngreso} style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, color: '#0f172a' }}>➕ Cargar Nuevo Ingreso</h4>
            <select value={nuevoIngreso.usuario} onChange={e => setNuevoIngreso({ ...nuevoIngreso, usuario: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="Catriel">Para Catriel</option>
              <option value="Lisandro">Para Lisandro</option>
            </select>
            <input type="text" placeholder="Descripción" value={nuevoIngreso.descripcion} onChange={e => setNuevoIngreso({ ...nuevoIngreso, descripcion: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Monto $" value={nuevoIngreso.monto} onChange={e => setNuevoIngreso({ ...nuevoIngreso, monto: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button type="submit" style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Agregar Ingreso</button>
          </form>

          <form onSubmit={agregarGastoInd} style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, color: '#0f172a' }}>➕ Cargar Gasto Propio</h4>
            <select value={nuevoGastoInd.usuario} onChange={e => setNuevoGastoInd({ ...nuevoGastoInd, usuario: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="Catriel">De Catriel</option>
              <option value="Lisandro">De Lisandro</option>
            </select>
            <input type="text" placeholder="Descripción" value={nuevoGastoInd.descripcion} onChange={e => setNuevoGastoInd({ ...nuevoGastoInd, descripcion: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <input type="number" placeholder="Monto $" value={nuevoGastoInd.monto} onChange={e => setNuevoGastoInd({ ...nuevoGastoInd, monto: e.target.value })} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button type="submit" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Agregar Gasto Propio</button>
          </form>

        </section>

      </div>

      {/* MODAL EDICIÓN */}
      {itemEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <form onSubmit={guardarEdicion} style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>✏️ Editar Registro</h3>

            {itemEditando.tipo === 'prestamos' ? (
              <>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Entidad / Préstamo:</label>
                <input
                  type="text"
                  value={itemEditando.item.entidad}
                  onChange={e => setItemEditando({ ...itemEditando, item: { ...itemEditando.item, entidad: e.target.value } })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Monto Cuota $:</label>
                <input
                  type="number"
                  value={itemEditando.item.montoCuota}
                  onChange={e => setItemEditando({ ...itemEditando, item: { ...itemEditando.item, montoCuota: parseFloat(e.target.value) || 0 } })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </>
            ) : itemEditando.tipo === 'tarjetas' ? (
              <>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nombre Tarjeta:</label>
                <input
                  type="text"
                  value={itemEditando.item.nombre}
                  onChange={e => setItemEditando({ ...itemEditando, item: { ...itemEditando.item, nombre: e.target.value } })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </>
            ) : (
              <>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Descripción:</label>
                <input
                  type="text"
                  value={itemEditando.item.descripcion}
                  onChange={e => setItemEditando({ ...itemEditando, item: { ...itemEditando.item, descripcion: e.target.value } })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Monto $:</label>
                <input
                  type="number"
                  value={itemEditando.item.monto || itemEditando.item.montoCuota}
                  onChange={e => setItemEditando({ ...itemEditando, item: { ...itemEditando.item, [itemEditando.item.monto ? 'monto' : 'montoCuota']: parseFloat(e.target.value) || 0 } })}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={() => setItemEditando(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}